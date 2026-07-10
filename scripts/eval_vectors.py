#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词向量质量实测脚本（Step A2 —— 定生死）

用途：加载腾讯词向量，诊断关键词是否在词表、近义词是否符合直觉，
      据此决定腾讯 v0.2.0 是否胜任主力词向量。
用法：python scripts/eval_vectors.py [词向量文件路径]
      不传路径则自动查找 data/raw/ 下最大的 .txt 词向量文件。
"""
import sys
import os
from pathlib import Path

# 项目根目录（脚本在 scripts/ 下，上一级即根目录）
ROOT = Path(__file__).resolve().parent.parent


def find_vector_file(custom=None):
    """
    查找词向量文件路径。
    优先使用命令行传入的路径；否则在 data/raw/ 下找体积最大的 .txt/.vec
    （词向量文件通常是目录里最大的文本文件）。
    """
    if custom and os.path.exists(custom):
        return custom
    raw_dir = ROOT / "data" / "raw"
    if not raw_dir.exists():
        return None
    candidates = list(raw_dir.rglob("*.txt")) + list(raw_dir.rglob("*.vec"))
    if not candidates:
        return None
    # 按文件大小降序，取最大那个
    return str(max(candidates, key=lambda p: p.stat().st_size))


def diagnose_membership(wv, words):
    """诊断1：检查关键词是否在词表中（在表才有向量，不在则 OOV）"""
    print("\n=== 诊断1：关键词是否在词表 ===")
    for w in words:
        present = w in wv.key_to_index
        print(f"  {w:14s} {'在 ✓' if present else '不在 ✗'}")


def diagnose_neighbors(wv, words):
    """诊断2：对每个测试词输出 most_similar top10 近义词，看是否符合直觉"""
    print("\n=== 诊断2：most_similar 近义词（top10）===")
    for w in words:
        if w not in wv.key_to_index:
            print(f"\n  [{w}] 不在词表，跳过")
            continue
        try:
            sims = wv.most_similar(w, topn=10)
            print(f"\n  [{w}]")
            for word, score in sims:
                print(f"    {word:14s} {score:.3f}")
        except Exception as e:
            print(f"\n  [{w}] 计算失败：{e}")


def diagnose_pairs(wv, pairs):
    """
    诊断3：词对余弦相似度对比。
    预期：同类/相关词相似度应明显高于不相关词。
    """
    print("\n=== 诊断3：词对余弦相似度（同类应 > 不相关）===")
    for a, b in pairs:
        if a in wv.key_to_index and b in wv.key_to_index:
            sim = wv.similarity(a, b)
            print(f"  {a:6s} ↔ {b:6s}  {sim:.3f}")
        else:
            miss = [x for x in (a, b) if x not in wv.key_to_index]
            print(f"  {a:6s} ↔ {b:6s}  （{miss} 不在词表）")


def main():
    """主流程：定位词向量文件 → 加载 → 跑三项诊断 → 给判断标准"""
    vec_path = find_vector_file(sys.argv[1] if len(sys.argv) > 1 else None)
    if not vec_path:
        print("未找到词向量文件。请先下载并解压腾讯词向量到 data/raw/")
        print("下载：curl -L -o data/raw/tencent-d200-v0.2.0-s.tar.gz \\")
        print("  https://ailab.tencent.com/ailab/nlp/en/data/tencent-ailab-embedding-zh-d200-v0.2.0-s.tar.gz")
        print("解压：tar -xzf data/raw/tencent-d200-v0.2.0-s.tar.gz -C data/raw/")
        sys.exit(1)

    print(f"加载词向量：{vec_path}")
    print("（1.5GB 文件首次加载需 30秒-2分钟，请稍候）...")

    # 延迟导入 gensim：避免未安装依赖时报错信息混乱
    from gensim.models import KeyedVectors
    # 腾讯词向量为文本格式（非二进制），unicode_errors 兜底个别异常字符
    wv = KeyedVectors.load_word2vec_format(vec_path, binary=False, unicode_errors="ignore")
    print(f"\n加载完成。总词数：{len(wv.key_to_index):,}")

    # 三个诊断维度
    diagnose_membership(wv, ["内卷", "躺平", "emo", "显眼包", "city不city",
                             "苹果", "画蛇添足", "996", "社恐", "松弛感"])
    diagnose_neighbors(wv, ["内卷", "躺平", "苹果", "猫", "画蛇添足", "996"])
    diagnose_pairs(wv, [
        ("苹果", "香蕉"),   # 同类，应较高
        ("苹果", "汽车"),   # 不相关，应较低
        ("内卷", "996"),    # 联想相关
        ("内卷", "竞争"),   # 联想相关
        ("猫", "狗"),       # 同类
        ("猫", "地铁"),     # 不相关
    ])

    print("\n诊断完成。判断标准：")
    print("- 内卷/躺平 在表，且近义词是 竞争/996/卷（非学术义）→ 腾讯胜任主力 ✓")
    print("- 若近义词是学术义/字面义错位 → 评估改用 Chinese-Word-Vectors 或混合")


if __name__ == "__main__":
    main()
