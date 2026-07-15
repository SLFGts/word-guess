#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""smart_pick 端到端测试：多局验证 LLM 选词 + T1/T2 预生成。
统计：new_game 延迟、target 选题分布、T1/T2 预生成命中率（点提示秒回）、泄露检查。
用法：先启动 serve_local.py，再跑本脚本（自带等服务 ready）。"""
import json
import time
import socket
import urllib.request
from collections import Counter

BASE = "http://localhost:8000"
ROUNDS = 12  # 测试局数（每局 new_game 含 1 次 LLM 选词，约 1-2s/局）


def wait_ready():
    """等待本地服务端口就绪（serve_local 加载 vectors.json 需十几秒）"""
    for _ in range(90):
        try:
            with socket.create_connection(("localhost", 8000), timeout=1):
                return
        except OSError:
            time.sleep(1)
    raise RuntimeError("服务未在 90s 内就绪")


def post(path, data=None):
    """POST JSON 请求"""
    body = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(
        BASE + path, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def get(path):
    """GET 请求"""
    with urllib.request.urlopen(BASE + path, timeout=60) as r:
        return json.loads(r.read())


def leaks(text, target):
    """检查文本是否真剧透目标词：含 target 的 2 字及以上连续子串算泄露。
    与服务的 _leaks_target 一致——单字重叠（水/电/鱼）不剧透放过，2 字子串（雪山/经济）才拦。"""
    if len(target) < 2:
        # 单字目标词：该字本身即剧透
        return any(c in target for c in text)
    return any(target[i:i+2] in text for i in range(len(target) - 1))


def main():
    """主测试流程：多局循环统计 smart_pick 效果"""
    wait_ready()
    print("服务就绪，开始测试...\n")

    targets = []
    ng_times = []
    t1_times = []
    t2_times = []
    pre_hits = 0      # T1 预生成命中数（点提示秒回 < 0.3s）
    t1_leaks = 0
    t2_leaks = 0
    no_key = False

    for i in range(ROUNDS):
        # 开新局（含 LLM 选词+预生成，计时）
        t0 = time.time()
        ng = post("/new_game")
        dt_ng = time.time() - t0
        ng_times.append(dt_ng)
        gid = ng["gameId"]
        target = get(f"/answer?gameId={gid}")["target"]
        targets.append(target)

        # T1 点提示：预生成命中则秒回，未命中走 gen_t1_hint 实时 LLM
        t0 = time.time()
        h1 = post("/hint", {"gameId": gid, "level": 1})
        dt1 = time.time() - t0
        t1_times.append(dt1)
        hint1 = h1.get("hint", "")
        if dt1 < 0.3:
            pre_hits += 1
        if "未配置 LLM_API_KEY" in hint1:
            no_key = True
        if hint1 and leaks(hint1, target):
            t1_leaks += 1

        # T2 锚点
        t0 = time.time()
        h2 = post("/hint", {"gameId": gid, "level": 2})
        dt2 = time.time() - t0
        t2_times.append(dt2)
        hint2 = h2.get("hint", "")
        if hint2 and leaks(hint2, target):
            t2_leaks += 1

        print(f"[{i+1:2d}/{ROUNDS}] ng={dt_ng:.2f}s t1={dt1:.3f}s t2={dt2:.3f}s "
              f"| target={target} | T1={hint1[:30]} | T2={hint2}")

    # 统计
    print("\n" + "=" * 60)
    print("统计")
    print("=" * 60)
    print(f"局数: {ROUNDS}")
    print(f"new_game 平均延迟: {sum(ng_times)/len(ng_times):.2f}s （含 LLM 选词+预生成）")
    print(f"T1 点提示平均延迟: {sum(t1_times)/len(t1_times):.3f}s （<0.3s = 预生成命中）")
    print(f"T2 点提示平均延迟: {sum(t2_times)/len(t2_times):.3f}s")
    print(f"T1 预生成命中率: {pre_hits}/{ROUNDS} ({pre_hits/ROUNDS*100:.0f}%)")
    print(f"T1 泄露目标字次数: {t1_leaks}")
    print(f"T2 泄露目标字次数: {t2_leaks}")
    if no_key:
        print("⚠️ 检测到未配置 LLM_API_KEY，smart_pick 退化为纯随机选词")
    # 选题分布
    print(f"\n目标词列表: {targets}")
    lens = Counter(len(t) for t in targets)
    print(f"字数分布: {dict(sorted(lens.items()))}")
    dups = [w for w, c in Counter(targets).items() if c > 1]
    print(f"重复词: {dups if dups else '无'}")


if __name__ == "__main__":
    main()
