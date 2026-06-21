"""In-memory Store for unit tests. Mirrors DynamoStore semantics, no AWS."""


class FakeStore:
    def __init__(self):
        self.keys = {}      # (etype,kname,val) -> cid
        self.entities = {}  # cid -> entity dict

    def resolve_alias(self, cid):
        seen = set()
        while cid in self.entities and self.entities[cid].get("merged_into"):
            if cid in seen:
                break
            seen.add(cid)
            cid = self.entities[cid]["merged_into"]
        return cid

    def get_keys(self, triples):
        out = {}
        for t in triples:
            if t in self.keys:
                out[t] = self.resolve_alias(self.keys[t])
        return out

    def put_key(self, etype, kname, value, cid):
        t = (etype, kname, value)
        if t in self.keys:
            return False
        self.keys[t] = cid
        return True

    def get_entity(self, cid):
        return self.entities.get(cid)

    def put_entity(self, cid, entity):
        cur = self.entities.get(cid)
        if cur is None:
            self.entities[cid] = {**entity,
                                  "sources": dict(entity.get("sources", {})),
                                  "keys": dict(entity.get("keys", {})),
                                  "aliases": list(entity.get("aliases", [])),
                                  "links": list(entity.get("links", []))}
            return
        cur["sources"].update(entity.get("sources", {}))
        cur["keys"].update(entity.get("keys", {}))
        cur["aliases"] = sorted(set(cur["aliases"]) | set(entity.get("aliases", [])))
        cur["links"] = list({(l.get("rel"), l.get("target")): l
                             for l in cur["links"] + list(entity.get("links", []))}.values())
        cur["fuzzy_pending"] = cur.get("fuzzy_pending") or entity.get("fuzzy_pending", False)

    def merge(self, survivor, loser):
        survivor = self.resolve_alias(survivor)
        loser = self.resolve_alias(loser)
        if survivor == loser:
            return
        le = self.entities.get(loser, {})
        for t, c in list(self.keys.items()):
            if self.resolve_alias(c) == loser:
                self.keys[t] = survivor
        self.put_entity(survivor, {k: le.get(k) for k in
                                   ("sources", "keys", "aliases", "links", "entity_type")
                                   if le.get(k)})
        if le.get("fuzzy_pending"):
            self.entities[survivor]["fuzzy_pending"] = True
        self.entities[loser] = {"merged_into": survivor}

    def clear_fuzzy_pending(self, cid):
        e = self.entities.get(self.resolve_alias(cid))
        if e is not None:
            e["fuzzy_pending"] = False

    def iter_fuzzy_pending(self):
        for cid, e in list(self.entities.items()):
            if e.get("fuzzy_pending"):
                yield cid, e
