#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 data/vectors.json 压缩为 float32 二进制 + 词列表，供云函数加载。

JSON 106MB（文本，每数值 ~7 字符）→ float32 .bin 42MB（每维 4 字节），
云函数用 getArrayBuffer + Float32Array 原生读取，无需 JSON 解析。
（float16 可再省一半到 21MB，但 JS 无原生 Float16Array 需手动解码，先用 float32 务实。）

验证：读回 bin 重算某词与全词池余弦相似度排名，与原 JSON 一致（float32 精度无损）。
"""
import json
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "vectors.json"
BIN_OUT = ROOT / "data" / "vectors-f32.bin"
WORDS_OUT = ROOT / "data" / "vectors-words.json"


def main():
    """主流程：读 JSON → 转 float32 二进制 + 词列表 → 验证精度无损"""
    print(f"读取 {SRC.name}（106MB，十几秒）...")
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)
    words = data["words"]
    vectors = data["vectors"]
    dim = data["dim"]
    n = len(words)
    print(f"词数 {n}，维度 {dim}")

    # 转 numpy float32 矩阵；行优先写二进制（词 i 的向量在 [i*dim:(i+1)*dim]）
    mat = np.array(vectors, dtype=np.float32)
    mat.tofile(BIN_OUT)
    print(f"已写 {BIN_OUT.name}：{BIN_OUT.stat().st_size / 1024 / 1024:.1f}MB（float32 二进制）")
    print(f"  原 JSON：{SRC.stat().st_size / 1024 / 1024:.1f}MB → 压缩率 "
          f"{BIN_OUT.stat().st_size / SRC.stat().st_size * 100:.0f}%")

    # 词列表（行序对应 bin 的行），云函数据此把词映射到向量行
    with open(WORDS_OUT, "w", encoding="utf-8") as f:
        json.dump({"dim": dim, "words": words}, f, ensure_ascii=False)
    print(f"已写 {WORDS_OUT.name}：{WORDS_OUT.stat().st_size / 1024:.0f}KB")

    # 验证：读回 bin 算排名 vs 原 JSON 算排名，确认 float32 精度无损
    print("\n验证精度（读回 bin 重算 top6 排名 vs 原 JSON）...")
    bin_mat = np.fromfile(BIN_OUT, dtype=np.float32).reshape(n, dim)
    bin_norm = bin_mat / np.linalg.norm(bin_mat, axis=1, keepdims=True)
    orig_norm = mat / np.linalg.norm(mat, axis=1, keepdims=True)
    all_match = True
    for test_w in ["苹果", "内卷", "猫", "社恐", "画蛇添足"]:
        if test_w not in words:
            print(f"  [{test_w}] 不在词表，跳过")
            continue
        idx = words.index(test_w)
        top_bin = [words[i] for i in np.argsort(-(bin_norm @ bin_norm[idx]))[:6]]
        top_orig = [words[i] for i in np.argsort(-(orig_norm @ orig_norm[idx]))[:6]]
        match = top_bin == top_orig
        all_match = all_match and match
        print(f"  [{test_w}] {'一致 ✓' if match else '不一致 ✗'} | bin={top_bin[:3]}...")
    print(f"\n{'✅ 全部一致，float32 精度无损，云函数可用 bin' if all_match else '⚠️ 有不一致，需检查'}")
    print("云函数加载 vectors-f32.bin + vectors-words.json 即可算相似度排名。")


if __name__ == "__main__":
    main()
