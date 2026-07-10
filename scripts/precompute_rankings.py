#!/usr/bin/env python3
"""
预计算排名表脚本
为每个词预计算与其他所有词的相似度排名，生成 rankings.json

输出格式：
{
  "侵犯": {"收购": 2, "土豆": 5, ...},  // 词 -> {其他词: 排名}
  "收购": {"侵犯": 1, "土豆": 3, ...},
  ...
}

这样云函数只需加载 rankings.json，无需计算向量
"""

import numpy as np
import json
import sys
from pathlib import Path

# 数据路径
DATA_DIR = Path(__file__).parent.parent / "data"
VECTORS_BIN = DATA_DIR / "vectors-f32.bin"
WORDS_JSON = DATA_DIR / "vectors-words.json"
OUTPUT_JSON = DATA_DIR / "rankings.json"

def load_vectors():
    """加载向量数据"""
    print("加载向量数据...")

    # 加载词列表
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    words = meta['words']
    dim = meta['dim']
    n_words = len(words)

    print(f"  词数：{n_words}")
    print(f"  维度：{dim}")

    # 加载向量矩阵
    vecs = np.fromfile(VECTORS_BIN, dtype=np.float32).reshape(n_words, dim)

    # 归一化
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1  # 避免除零
    vecs_normalized = vecs / norms

    print(f"  向量矩阵：{vecs.nbytes / 1024 / 1024:.1f}MB")
    print(f"  归一化完成")

    return words, vecs_normalized

def compute_rankings(words, vecs_normalized):
    """计算每个词的排名表"""
    n = len(words)
    dim = vecs_normalized.shape[1]

    print(f"\n开始计算排名表（{n} 个词）...")
    print(f"  计算量：{n} × {n} = {n*n:,} 次点积")

    # 分批计算，避免内存爆炸
    # 每次计算 1000 个词与其他所有词的相似度
    batch_size = 1000
    rankings = {}

    for i in range(0, n, batch_size):
        batch_end = min(i + batch_size, n)
        batch_vecs = vecs_normalized[i:batch_end]

        # 计算批次内所有词与全部词的相似度
        # batch_vecs: (batch_size, dim)
        # vecs_normalized.T: (dim, n)
        # similarities: (batch_size, n)
        similarities = np.dot(batch_vecs, vecs_normalized.T)

        # 对每个词排序，得到排名
        for j in range(batch_size):
            word = words[i + j]
            sim = similarities[j]

            # 降序排序，获取排名
            # 注意：自己对自己的相似度最高（=1），排名应该是 1
            sorted_indices = np.argsort(-sim)  # 降序

            # 构建排名表 {其他词：排名}
            word_rankings = {}
            for rank, idx in enumerate(sorted_indices, 1):
                other_word = words[idx]
                if other_word != word:  # 排除自己
                    word_rankings[other_word] = rank

            rankings[word] = word_rankings

        # 进度显示
        progress = (batch_end / n) * 100
        print(f"  进度：{batch_end}/{n} ({progress:.1f}%)")
        sys.stdout.flush()

    print(f"\n排名表计算完成")
    print(f"  总词数：{len(rankings)}")

    return rankings

def save_rankings(rankings, output_path):
    """保存排名表到 JSON"""
    print(f"\n保存排名表到 {output_path}...")

    # 转换为可序列化的格式
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(rankings, f, ensure_ascii=False)

    # 检查文件大小
    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"  文件大小：{size_mb:.1f}MB")

    # 验证
    with open(output_path, 'r', encoding='utf-8') as f:
        loaded = json.load(f)

    print(f"  验证通过：{len(loaded)} 个词")

    # 示例输出
    sample_word = list(loaded.keys())[0]
    sample_rankings = loaded[sample_word]
    print(f"\n  示例（{sample_word}）：")
    print(f"    前 5 个最相关词：{list(sample_rankings.keys())[:5]}")
    print(f"    前 5 个排名：{list(sample_rankings.values())[:5]}")

def main():
    print("=" * 60)
    print("预计算排名表脚本")
    print("=" * 60)

    # 加载向量
    words, vecs_normalized = load_vectors()

    # 计算排名表
    rankings = compute_rankings(words, vecs_normalized)

    # 保存
    save_rankings(rankings, OUTPUT_JSON)

    print("\n" + "=" * 60)
    print("完成！")
    print("=" * 60)
    print(f"\n下一步：")
    print(f"1. 将 {OUTPUT_JSON.name} 上传到云存储 vectors/ 文件夹")
    print(f"2. 修改 newGame 云函数，加载 rankings.json 而非 vectors-f32.bin")
    print(f"3. 云函数只需 JSON.parse() + 查表，无需向量计算")

if __name__ == "__main__":
    main()
