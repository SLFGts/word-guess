#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验证 blocklist 生效：开新局 → guess 安德鲁（应已禁用）→ guess 苹果（对照正常）"""
import json
import urllib.request

BASE = "http://localhost:8000"


def post(path, data=None):
    """POST JSON"""
    body = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(
        BASE + path, data=body, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


ng = post("/new_game")
gid = ng["gameId"]
print(f"new_game: gameId={gid} wordCount={ng['wordCount']}")
for w in ["约翰", "安德鲁", "玛丽", "苹果"]:
    print(f"guess {w}:", post("/guess", {"gameId": gid, "word": w}))
