#!/usr/bin/env python3
"""Host-side probe of the bilinc-search-proxy Lambda using guest Cognito creds,
to reproduce the in-app [search] HTTP 400 outside the app. Tests each op shape."""
import json, urllib.request, urllib.error, datetime, hashlib, hmac

REGION = "eu-central-1"
POOL = "eu-central-1:cf66e6b8-e288-46b1-8f74-e9f32bf497d5"
URL = "https://2ljm4c7rf7y5gkwsaqy6qpfm5e0skqtj.lambda-url.eu-central-1.on.aws/"
HOST = "2ljm4c7rf7y5gkwsaqy6qpfm5e0skqtj.lambda-url.eu-central-1.on.aws"


def cog(target, body):
    req = urllib.request.Request(
        f"https://cognito-identity.{REGION}.amazonaws.com/",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/x-amz-json-1.1",
                 "x-amz-target": f"AWSCognitoIdentityService.{target}"},
        method="POST")
    return json.load(urllib.request.urlopen(req, timeout=20))


def creds():
    iid = cog("GetId", {"IdentityPoolId": POOL})["IdentityId"]
    c = cog("GetCredentialsForIdentity", {"IdentityId": iid})["Credentials"]
    return c["AccessKeyId"], c["SecretKey"], c["SessionToken"]


def sign(ak, sk, st, payload):
    body = json.dumps(payload)
    amzdate = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    datestamp = amzdate[:8]
    cr_headers = f"content-type:application/json\nhost:{HOST}\nx-amz-date:{amzdate}\nx-amz-security-token:{st}\n"
    signed_h = "content-type;host;x-amz-date;x-amz-security-token"
    payload_hash = hashlib.sha256(body.encode()).hexdigest()
    creq = f"POST\n/\n\n{cr_headers}\n{signed_h}\n{payload_hash}"
    scope = f"{datestamp}/{REGION}/lambda/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amzdate}\n{scope}\n{hashlib.sha256(creq.encode()).hexdigest()}"

    def hm(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
    kdate = hm(("AWS4" + sk).encode(), datestamp)
    kreg = hm(kdate, REGION); ksvc = hm(kreg, "lambda"); ksign = hm(ksvc, "aws4_request")
    sig = hmac.new(ksign, sts.encode(), hashlib.sha256).hexdigest()
    auth = (f"AWS4-HMAC-SHA256 Credential={ak}/{scope}, "
            f"SignedHeaders={signed_h}, Signature={sig}")
    return body, {"content-type": "application/json", "host": HOST,
                  "x-amz-date": amzdate, "x-amz-security-token": st, "Authorization": auth}


def call(ak, sk, st, payload):
    body, headers = sign(ak, sk, st, payload)
    req = urllib.request.Request(URL, data=body.encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            d = r.read().decode()
            return r.status, d[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


ak, sk, st = creds()
print("got guest creds:", ak[:8])
tests = {
    "search":  {"op": "search", "q": "Test Kafe", "limit": 20, "offset": 0},
    "nearby":  {"op": "nearby", "lat": 39.93, "lng": 32.85, "radiusKm": 10, "limit": 5},
    "suggest": {"op": "suggest", "q": "Test", "limit": 10},
}
for name, p in tests.items():
    st_code, resp = call(ak, sk, st, p)
    print(f"\n== {name} == HTTP {st_code}\n{resp}")
