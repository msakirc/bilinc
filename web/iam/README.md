# `bilinc-deploy` — scoped deploy principal

Dedicated, deploy-only IAM user for running `sst deploy` (web today; backend/scraper IaC later).
**Not** embedded in any app. Runtime stays on Cognito unauth + per-Lambda exec roles; `bilinc-serverless`
remains the scoped runtime/data credential. Account: **515614487420**, region **eu-central-1**.

`bilinc-deploy-policy.json` is a least-privilege policy (no `AdministratorAccess`). It is scoped to:
SST state/bootstrap (`/sst/*` params, `sst-*` + `bilinc-*` S3 buckets), the stack's Lambda
(`bilinc-*`), per-Lambda IAM roles (`role/bilinc-*`, `PassRole` to `lambda.amazonaws.com` only),
CloudFront, `/aws/lambda/bilinc-*` log groups, the OpenNext ISR DynamoDB table + SQS revalidation
queue (`bilinc-*`).

## Create the user (needs Console root or an admin — `bilinc-serverless` has no IAM perms)

Console → IAM:
1. **Policies → Create policy → JSON** → paste `bilinc-deploy-policy.json` → name `bilinc-deploy`.
2. **Users → Create user** → name `bilinc-deploy`, no console access.
3. Attach the `bilinc-deploy` policy.
4. **Security credentials → Create access key** → "Application running outside AWS" → save key id + secret.

Or, if you have a temporary admin session on the CLI:
```bash
aws iam create-policy --policy-name bilinc-deploy \
  --policy-document file://web/iam/bilinc-deploy-policy.json
aws iam create-user --user-name bilinc-deploy
aws iam attach-user-policy --user-name bilinc-deploy \
  --policy-arn arn:aws:iam::515614487420:policy/bilinc-deploy
aws iam create-access-key --user-name bilinc-deploy
```

## Configure the profile (run yourself with `!`)
```
! aws configure --profile bilinc-deploy
```
Region `eu-central-1`, output `json`. Paste the new key id + secret.

## Then redeploy
```
AWS_PROFILE=bilinc-deploy npx sst deploy            # disposable dev stage smoke test
AWS_PROFILE=bilinc-deploy npx sst deploy --stage prod
```

## If first deploy hits AccessDenied
The error names the exact `service:Action` + resource. Add it to the matching statement in
`bilinc-deploy-policy.json`, update the policy version, re-run. Known candidates SST/OpenNext
*might* additionally want: `lambda:PublishLayerVersion` (layer ARN), `cloudfront:*` OAC tagging
(already covered by `cloudfront:*`), `ssm:*` on extra `/sst/` paths (covered). This iteration is
the cost of least-privilege vs `AdministratorAccess` — expect 0-2 rounds.
