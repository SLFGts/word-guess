#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""T1 提示端到端测试：new_game → 查target → T1计时(首次+缓存) → T2 → T3
验证 T1 接入 qwen-turbo 后的延迟、描述质量、缓存生效。"""
import json
import time
import urllib.request

BASE = "http://localhost:8000"


def post(path, data=None):
    """POST JSON 请求"""
    body = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(
        BASE + path, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def get(path):
    """GET 请求"""
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return json.loads(r.read())


def main():
    """主测试流程"""
    # 开新局
    ng = post("/new_game")
    gid = ng["gameId"]
    print(f"new_game: gameId={gid} wordCount={ng['wordCount']}")
    # 调试查 target（看 T1 描述是否贴切）
    ans = get(f"/answer?gameId={gid}")
    target = ans["target"]
    print(f"target={target}\n")

    # T1 首次调用（调 LLM，计时）
    t0 = time.time()
    h1 = post("/hint", {"gameId": gid, "level": 1})
    dt = time.time() - t0
    print(f"T1 首次 ({dt:.2f}s): {h1['hint']}")

    # T1 再次调用（应走缓存，秒回）
    t0 = time.time()
    h1b = post("/hint", {"gameId": gid, "level": 1})
    dt = time.time() - t0
    print(f"T1 缓存 ({dt:.2f}s): {h1b['hint']}")

    # T2 结构 / T3 锚点
    h2 = post("/hint", {"gameId": gid, "level": 2})
    print(f"T2: {h2['hint']}")
    h3 = post("/hint", {"gameId": gid, "level": 3})
    print(f"T3: {h3['hint']}")

    # 换一个目标词再测 T1（验证不同词的描述质量）
    print("\n--- 第二局 ---")
    ng2 = post("/new_game")
    gid2 = ng2["gameId"]
    t2w = get(f"/answer?gameId={gid2}")["target"]
    t0 = time.time()
    h = post("/hint", {"gameId": gid2, "level": 1})
    dt = time.time() - t0
    print(f"target={t2w} | T1 ({dt:.2f}s): {h['hint']}")


if __name__ == "__main__":
    main()
