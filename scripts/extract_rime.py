#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rime-Ice 高频词提取脚本

用途：从 Rime-Ice 的 base.dict.yaml 提取高频词列表，作白名单。
      base.dict.yaml 格式：前部注释 + --- + YAML头(name/version/sort) + ... + 码表。
      码表每行：词\t拼音\t权重（Tab 分隔，权重=词频）。
      提取码表，按权重降序取高频，筛 2-5 字纯中文，输出词列表。
用法：python scripts/extract_rime.py [取词数量，默认20000]
"""
import sys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DICT_PATH = ROOT / "data" / "whitelist" / "base.dict.yaml"
OUT_PATH = ROOT / "data" / "whitelist" / "rime-ice-high-freq.txt"
TOP_N = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
# 2-5 字纯中文词正则
CN_WORD_RE = re.compile(r'^[一-鿿]{2,5}$')


def parse_rime_dict(path):
    """
    解析 Rime .dict.yaml：跳过注释和 YAML 头，提取码表行的 (词, 权重)。
    码表行格式：词\t拼音\t权重（Tab 分隔，权重可省略默认 100）。
    """
    entries = []
    in_code = False  # 是否进入码表区（--- 之后）
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            # YAML 文档分隔符 --- 标志码表区开始
            if line.startswith("---"):
                in_code = True
                continue
            if not in_code:
                continue
            # 跳过码表区内的 YAML 头（name:/version:/sort:/... ）与注释
            if line.startswith("#"):
                continue
            if ":" in line and "\t" not in line:
                continue
            # 码表行：按 Tab 分隔
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            word = parts[0].strip()
            # 权重在第三列，可省略
            try:
                weight = int(parts[2]) if len(parts) >= 3 else 100
            except ValueError:
                weight = 100
            entries.append((word, weight))
    return entries


def load_stopwords():
    """加载停用词表（与 build_vocab 共用）"""
    sw_path = ROOT / "data" / "stopwords.txt"
    if not sw_path.exists():
        return set()
    with open(sw_path, encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def main():
    """
    主流程：解析 → 筛纯中文2-5字 → 按权重降序 → 取候选 → jieba词性过滤
    （排除虚词/功能词）→ 停用词排除 → 输出内容词列表。
    在提取阶段就过滤，保证白名单文件本身只含内容词，build_vocab 直接用。
    """
    if not DICT_PATH.exists():
        print(f"未找到 {DICT_PATH}，请先下载 Rime-Ice base.dict.yaml")
        sys.exit(1)

    print(f"解析 {DICT_PATH}...")
    entries = parse_rime_dict(DICT_PATH)
    print(f"码表总词条：{len(entries)}")

    # 筛 2-5 字纯中文
    filtered = [(w, wt) for w, wt in entries if CN_WORD_RE.match(w)]
    print(f"2-5 字纯中文词：{len(filtered)}")

    # 按权重降序排序
    filtered.sort(key=lambda x: -x[1])

    # 取候选高频（预留 jieba 过滤损耗，取 1.5 倍）
    candidates = filtered[:int(TOP_N * 1.5)]
    print(f"候选高频 {len(candidates)} 词（权重范围 {candidates[-1][1]}~{candidates[0][1]}）")

    # jieba 词性过滤 + 停用词排除，只留内容词（n/v/a/i 类）
    import jieba
    import jieba.posseg as pseg
    user_dict = ROOT / "data" / "user_dict.txt"
    if user_dict.exists():
        jieba.load_userdict(str(user_dict))
    stopwords = load_stopwords()

    content_words = []
    for w, wt in candidates:
        if w in stopwords:
            continue
        pairs = list(pseg.cut(w))
        # 整词识别为内容词性保留；切分多段排除（防"也是"等组合词误留）
        if len(pairs) == 1 and pairs[0].flag.startswith(('n', 'v', 'a', 'i', 'j', 'l', 's', 't')):
            content_words.append(w)
        if len(content_words) >= TOP_N:
            break
    print(f"jieba 过滤后内容词：{len(content_words)}")
    print(f"前 20 示例：{content_words[:20]}")

    # 输出词列表（每行一词）
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        for w in content_words:
            f.write(w + "\n")
    print(f"已输出：{OUT_PATH}")


if __name__ == "__main__":
    main()
