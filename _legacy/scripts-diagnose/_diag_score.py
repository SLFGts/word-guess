#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分数分布诊断：输出目标词 top 相关词 (rank, cos, 线性score, 对数score) 看梯度"""
import json
import numpy as np
from pathlib import Path
ROOT = Path("/Users/slfg/Code/word_guess")
print("加载 vectors.json（55MB）...")
with open(ROOT / "data" / "vectors.json", encoding="utf-8") as f:
    d = json.load(f)
WORDS = d["words"]
VECS = np.array(d["vectors"], dtype=np.float32)
NORMS = VECS / np.linalg.norm(VECS, axis=1, keepdims=True)
N = len(WORDS)
WI = {w: i for i, w in enumerate(WORDS)}
def score_lin(rank):
    return round((1 - (rank - 1) / (N - 1)) * 100)
def score_log(rank):
    return round((1 - np.log10(rank) / np.log10(N)) * 100)
for target in ["苹果", "电影", "内卷", "猫"]:
    if target not in WI:
        print(f"\n[{target}] 不在池")
        continue
    ti = WI[target]
    tn = VECS[ti] / np.linalg.norm(VECS[ti])
    sims = NORMS @ tn
    order = np.argsort(-sims)
    print(f"\n=== [{target}] top20 (rank, cos, 线性score, 对数score) ===")
    for i in range(20):
        idx = order[i]
        w = WORDS[idx]
        r = i + 1
        c = float(sims[idx])
        print(f"  r={r:5d} cos={c:.3f} lin={score_lin(r):3d} log={score_log(r):3d}  {w}")
    print("  --- 中段 ---")
    for r in [50, 100, 500, 1000, 3000, 5000, 10000, 15000, 20000, 25000]:
        if r > N:
            continue
        idx = order[r - 1]
        w = WORDS[idx]
        c = float(sims[idx])
        print(f"  r={r:5d} cos={c:.3f} lin={score_lin(r):3d} log={score_log(r):3d}  {w}")
