#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""缺失词诊断：查 19 个试玩缺失词在腾讯表/停用词/白名单/jieba词性的情况，定位过滤原因
用途：判断每个缺失词是"腾讯表无"（V1.1 FastText 兜底）还是"在表但被过滤"（改过滤逻辑可救）。
"""
import json
from pathlib import Path

ROOT = Path("/Users/slfg/Code/word_guess")

# 加载停用词（含政治排除词，统一黑名单）
stopwords = set()
for fn in ["stopwords.txt", "exclude_words.txt"]:
    p = ROOT / "data" / fn
    if p.exists():
        with open(p, encoding="utf-8") as f:
            stopwords.update(line.strip() for line in f if line.strip())

# 加载白名单（Rime 高频 + 成语 + 手工新词，build_pool 用此集合白名单优先保留）
whitelist = set()
rime = ROOT / "data" / "whitelist" / "rime-ice-high-freq.txt"
if rime.exists():
    with open(rime, encoding="utf-8") as f:
        whitelist.update(line.strip() for line in f if line.strip())
idiom = ROOT / "data" / "whitelist" / "idiom.json"
if idiom.exists():
    with open(idiom, encoding="utf-8") as f:
        for item in json.load(f):
            w = item.get("word", "").strip()
            if w:
                whitelist.add(w)
new = ROOT / "data" / "new_words.txt"
if new.exists():
    with open(new, encoding="utf-8") as f:
        whitelist.update(line.strip() for line in f if line.strip())

# jieba 加载自定义新词词典（强制整词识别新词）
import jieba
jieba.load_userdict(str(ROOT / "data" / "user_dict.txt"))
import jieba.posseg as pseg

# 定位腾讯词向量文件（data/raw 下最大的 .txt/.vec）
raw = ROOT / "data" / "raw"
cands = list(raw.rglob("*.txt")) + list(raw.rglob("*.vec"))
cands = [c for c in cands if c.stat().st_size > 10 * 1024 * 1024]
vec_path = max(cands, key=lambda p: p.stat().st_size)
print(f"加载腾讯词向量：{vec_path.name}（1-3 分钟）...")
from gensim.models import KeyedVectors
wv = KeyedVectors.load_word2vec_format(str(vec_path), binary=False, unicode_errors="ignore")
print(f"加载完成，总词数 {len(wv.key_to_index):,}\n")

# 试玩反馈缺失的 19 词
MISSING = "朋友圈 扫码 打卡 避雷 剁手 囤货 探店 网红 带货 微博 抖音 京东 外卖 聚餐 口罩 入职 鸟 早安 晚安".split()

# 逐词诊断：在腾讯表？在停用词？在白名单？jieba 词性/切分段数？
print(f"{'词':6s} {'在腾讯表':7s} {'停用词':6s} {'白名单':6s} {'jieba词性':10s} {'切分段':5s} 诊断")
for w in MISSING:
    in_wv = w in wv
    in_sw = w in stopwords
    in_wl = w in whitelist
    pairs = list(pseg.cut(w))
    flags = "/".join(p.flag for p in pairs)
    segs = len(pairs)
    # 按过滤链路顺序定位原因
    if not in_wv:
        diag = "腾讯表无→FastText兜底(V1.1)"
    elif in_sw:
        diag = "被停用词误杀→从stopwords删"
    elif in_wl:
        diag = "白名单内应保留→build_pool有bug?"
    elif segs != 1:
        diag = f"jieba切{segs}段→补user_dict整词识别"
    elif not pairs[0].flag.startswith(('n', 'v', 'a', 'i', 'j', 'l', 's', 't')):
        diag = f"词性{flags}被滤→补new_words(白名单优先)"
    else:
        diag = "应入池?查build_pool逻辑"
    print(f"{w:6s} {str(in_wv):7s} {str(in_sw):6s} {str(in_wl):6s} {flags:10s} {segs:<5d} {diag}")
