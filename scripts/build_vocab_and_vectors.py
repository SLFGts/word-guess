#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
答案池与向量提取脚本（Step A3）

用途：从腾讯词向量筛 2-5 字纯中文高频词，取前 N 作答案池，
      pypinyin 算结构属性（字数/首字/拼音首字母），提取向量，
      产出 data/vocab-final.json + data/vectors.json。
      并在答案池子集上重测关键词近邻，验证"内卷/躺平"错位是否缓解。
用法：python scripts/build_vocab_and_vectors.py [答案池大小，默认5000]
"""
import sys
import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 答案池 = 白名单 ∩ 腾讯词向量表，全收交集（不取前N）
# 2-5 字纯中文词正则
CN_WORD_RE = re.compile(r'^[一-鿿]{1,5}$')


def find_vector_file():
    """查找 data/raw/ 下最大的 .txt/.vec 词向量文件（>10MB，排除 readme）"""
    raw_dir = ROOT / "data" / "raw"
    candidates = list(raw_dir.rglob("*.txt")) + list(raw_dir.rglob("*.vec"))
    candidates = [c for c in candidates if c.stat().st_size > 10 * 1024 * 1024]
    return str(max(candidates, key=lambda p: p.stat().st_size)) if candidates else None


def is_valid_word(w):
    """筛选 2-5 字纯中文词（排除单字、含英文/数字/标点的词）"""
    return bool(CN_WORD_RE.match(w))


def load_stopwords():
    """加载停用词表 + 政治排除词表 + 手动禁用词表（统一排除）"""
    sw = set()
    for fn in ["stopwords.txt", "exclude_words.txt", "blocklist.txt"]:
        p = ROOT / "data" / fn
        if p.exists():
            with open(p, encoding="utf-8") as f:
                for line in f:
                    w = line.strip()
                    if w and not w.startswith("#"):
                        sw.add(w)
    return sw


def load_whitelist():
    """
    加载白名单：Rime-Ice 高频词 + 手工新词列表。
    Rime-Ice base.dict.yaml 已合并现代汉语常用词表+THUOCL+腾讯词向量等，
    故白名单以此为主，手工新词补 2020+ 最新梗。
    """
    wl_dir = ROOT / "data" / "whitelist"
    whitelist = set()
    # Rime-Ice 提取的高频词
    rime_path = wl_dir / "rime-ice-high-freq.txt"
    if rime_path.exists():
        with open(rime_path, encoding="utf-8") as f:
            whitelist.update(line.strip() for line in f if line.strip())
    # 手工新词
    new_path = ROOT / "data" / "new_words.txt"
    if new_path.exists():
        with open(new_path, encoding="utf-8") as f:
            whitelist.update(line.strip() for line in f if line.strip())
    return whitelist


def load_whitelist_ordered():
    """
    加载白名单为有序 list：Rime高频内容词 + 成语 + 手工新词。
    build_pool 按此顺序遍历，保证答案池是输入法高频内容词+成语+新词。
    """
    wl_dir = ROOT / "data" / "whitelist"
    ordered = []
    seen = set()
    # Rime 高频内容词
    rime_path = wl_dir / "rime-ice-high-freq.txt"
    if rime_path.exists():
        with open(rime_path, encoding="utf-8") as f:
            for line in f:
                w = line.strip()
                if w and w not in seen:
                    ordered.append(w)
                    seen.add(w)
    # 成语（chinese-xinhua，30895条）
    idiom_path = wl_dir / "idiom.json"
    if idiom_path.exists():
        import json
        with open(idiom_path, encoding="utf-8") as f:
            idioms = json.load(f)
        for item in idioms:
            w = item.get("word", "").strip()
            if w and w not in seen:
                ordered.append(w)
                seen.add(w)
    # 手工新词
    new_path = ROOT / "data" / "new_words.txt"
    if new_path.exists():
        with open(new_path, encoding="utf-8") as f:
            for line in f:
                w = line.strip()
                if w and w not in seen:
                    ordered.append(w)
                    seen.add(w)
    return ordered


# 模块级加载一次
STOPWORDS = load_stopwords()
WHITELIST = load_whitelist()

# 加载 jieba 自定义新词词典，强制整词识别新词（白名单优先，此为双保险）
import jieba
_user_dict = ROOT / "data" / "user_dict.txt"
if _user_dict.exists():
    jieba.load_userdict(str(_user_dict))


def is_content_word(w):
    """
    判断是否为内容词（层2词性 + 层3白名单 组合）：
    - 层3白名单优先：在白名单（Rime-Ice高频+手工新词）直接保留，跳过词性
      避免对"内卷/躺平"等新词的 jieba 切分误判
    - 停用词黑名单排除
    - 层2 jieba 词性：整词识别为 n/v/a/i 类保留；切分多段排除（避免"也是"误留）
    """
    # 停用词黑名单优先（即使白名单也排除，防 Rime 高频含的"一个/也是"等虚词）
    if w in STOPWORDS:
        return False
    # 层3白名单优先
    if w in WHITELIST:
        return True
    # 层2 jieba 词性
    import jieba.posseg as pseg
    pairs = list(pseg.cut(w))
    if len(pairs) != 1:
        return False  # 切分多段或空，排除
    flag = pairs[0].flag
    # 名词类/动词类/形容词/成语/简称/习用语/处所名词/时间名词
    return flag.startswith(('n', 'v', 'a', 'i', 'j', 'l', 's', 't'))


def build_pool(wv):
    """
    答案池 = 白名单词全收交集 + 腾讯表前N高频词过 is_content_word 补收。
    - 白名单（Rime高频+成语+新词）全收交集：保低频但该收的词（成语/新词/白名单单字如"鸟"）；
    - 腾讯表前N高频词再过 is_content_word（白名单优先+停用词+jieba词性）补收：
      覆盖白名单外的常用多字词（朋友圈/扫码/打卡/入职/早安/晚安/外卖/聚餐/口罩等）。
      诊断发现这些词在腾讯表、jieba标n/v、但不在白名单，原版只收白名单故漏掉。
    """
    whitelist_order = load_whitelist_ordered()
    wv_keys = wv.key_to_index
    words = []
    seen = set()
    # 1. 白名单词全收交集（多字+单字，不限频率，保成语/新词/低频白名单词）
    for w in whitelist_order:
        if w in wv_keys and is_valid_word(w) and w not in STOPWORDS:
            words.append(w)
            seen.add(w)
    # 2. 腾讯表前N高频词补收（白名单外的常用词，is_content_word 过滤）
    #    腾讯表按词频降序，前N覆盖常用词；is_content_word 白名单优先+停用词+jieba词性
    SCAN_LIMIT = 100000  # 腾讯表前10万高频词
    scanned = 0
    for w in wv_keys:
        if scanned >= SCAN_LIMIT:
            break
        scanned += 1
        if w in seen or w in STOPWORDS:
            continue
        if not is_valid_word(w):
            continue
        if is_content_word(w):
            words.append(w)
            seen.add(w)
    return words


def annotate(words):
    """用 pypinyin 给每个词算字数、首字、拼音首字母（T2 提示用）"""
    from pypinyin import lazy_pinyin, Style
    result = []
    for w in words:
        try:
            # 每个字的声母首字母，拼接成拼音首字母串
            initials = lazy_pinyin(w, style=Style.FIRST_LETTER)
            pinyin_initial = ''.join(initials)
        except Exception:
            pinyin_initial = ''
        result.append({
            "word": w,
            "len": len(w),
            "first": w[0],
            "pinyin_initial": pinyin_initial,
        })
    return result


def subset_neighbors(wv, pool_words, test_words, topn=10):
    """
    在答案池子集上重测关键词近邻（NumPy 批量余弦相似度）。
    这是游戏实际会用到的排名空间——验证全表里的错位是否因子集筛选而缓解。
    """
    import numpy as np
    print(f"\n=== 答案池子集（{len(pool_words)} 词）上的近邻重测 ===")
    # 构建答案池向量矩阵并归一化
    pool_vecs = np.array([wv[w] for w in pool_words], dtype=np.float32)
    pool_norm = pool_vecs / np.linalg.norm(pool_vecs, axis=1, keepdims=True)
    pool_set = set(pool_words)

    for tw in test_words:
        if tw not in pool_set:
            print(f"\n  [{tw}] 不在答案池，跳过")
            continue
        # 目标词向量归一化后与答案池矩阵做点积，得余弦相似度
        tw_vec = wv[tw].astype(np.float32)
        tw_norm = tw_vec / np.linalg.norm(tw_vec)
        sims = pool_norm @ tw_norm
        # 降序取 topn，排除自身
        idx = np.argsort(-sims)
        print(f"\n  [{tw}] 答案池内 top{topn}：")
        count = 0
        for i in idx:
            if pool_words[i] == tw:
                continue
            print(f"    {pool_words[i]:14s} {float(sims[i]):.3f}")
            count += 1
            if count >= topn:
                break


def main():
    """主流程：定位词向量 → 加载 → 筛答案池 → 标注 → 存盘 → 子集重测"""
    vec_path = find_vector_file()
    if not vec_path:
        print("未找到词向量文件，请先下载解压到 data/raw/")
        sys.exit(1)

    print(f"加载词向量：{vec_path}（1-3 分钟）...")
    from gensim.models import KeyedVectors
    wv = KeyedVectors.load_word2vec_format(vec_path, binary=False, unicode_errors="ignore")
    print(f"加载完成。总词数：{len(wv.key_to_index):,}")

    # 筛答案池（白名单 ∩ 腾讯词向量表，全收交集）
    pool_words = build_pool(wv)
    print(f"\n答案池筛选完成：{len(pool_words)} 词（白名单∩腾讯表，全交集）")
    print(f"前 10 个示例：{pool_words[:10]}")

    # 标注结构属性
    print("\n标注字数/首字/拼音首字母...")
    vocab = annotate(pool_words)

    # 提取向量（四舍五入到 6 位小数省空间）
    print("提取向量...")
    vectors = [[round(float(x), 6) for x in wv[w]] for w in pool_words]
    dim = len(vectors[0]) if vectors else 0

    # 存盘
    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    vocab_path = data_dir / "vocab-final.json"
    vec_path_out = data_dir / "vectors.json"

    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    with open(vec_path_out, "w", encoding="utf-8") as f:
        json.dump({"dim": dim, "words": pool_words, "vectors": vectors}, f,
                   ensure_ascii=False)

    print(f"\n已存盘：")
    print(f"  {vocab_path}（{vocab_path.stat().st_size / 1024:.0f} KB）")
    print(f"  {vec_path_out}（{vec_path_out.stat().st_size / 1024 / 1024:.1f} MB，{dim}维）")

    # 子集重测：验证"内卷/躺平"错位是否因答案池筛选而缓解
    subset_neighbors(wv, pool_words,
                     ["内卷", "躺平", "苹果", "猫", "画蛇添足", "996", "社恐"])

    print("\n完成。判断：若'内卷'在答案池内近邻是 996/竞争/焦虑（非发型词），"
          "则错位缓解、腾讯可用；若仍是错位词，则答案池需排除这类词或接受中等相关。")


if __name__ == "__main__":
    main()
