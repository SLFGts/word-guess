#!/usr/bin/env python3
"""
诊断答案池覆盖情况脚本
- 统计总词数、按字数分布
- 输出前30个词 + 随机30个词
- 测试常用词覆盖情况，列出缺失词并分析原因
"""

import json
import random
import os

# === 配置 ===
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "vocab-final.json")

# 常用词测试列表
TEST_WORDS = [
    # 日常生活
    "手机", "电脑", "吃饭", "睡觉", "工作", "学习", "游戏", "电影", "音乐", "咖啡",
    "奶茶", "外卖", "快递", "地铁", "公交", "工资", "房租", "周末", "假期", "旅行",
    "旅游", "购物", "逛街", "约会", "聚餐", "熬夜", "减肥", "健身", "跑步", "游泳",
    "篮球", "足球", "读书", "写字", "画画", "唱歌", "跳舞", "拍照", "录像", "直播",
    # 社交媒体/平台
    "朋友圈", "微博", "抖音", "淘宝", "京东", "微信", "支付", "扫码",
    # 家居/物品
    "充电", "空调", "暖气", "电梯", "阳台", "卧室", "厨房", "厕所", "沙发", "桌子",
    "椅子", "杯子", "筷子", "冰箱", "洗衣机", "电视", "耳机", "口罩", "钥匙", "钱包",
    "身份证", "护照",
    # 职场/教育
    "毕业", "开学", "考试", "面试", "入职", "辞职", "跳槽", "加班", "摸鱼", "内卷",
    "躺平", "社恐", "破防", "松弛感", "摆烂",
    # 水果/动植物/自然
    "苹果", "香蕉", "橘子", "西瓜", "葡萄", "草莓", "芒果",
    "猫", "狗", "鱼", "鸟", "花", "草", "树",
    "太阳", "月亮", "星星", "天空", "大海", "山", "河", "风", "雨", "雪",
    # 日常用语/情感
    "早安", "晚安", "你好", "谢谢", "对不起", "没关系",
    "喜欢", "讨厌", "开心", "难过", "生气", "害羞", "紧张", "放松",
    # 网络用语
    "打卡", "种草", "拔草", "安利", "避雷", "剁手", "囤货", "探店", "网红", "带货",
    # 成语
    "画蛇添足", "守株待兔", "亡羊补牢", "杯弓蛇影", "叶公好龙",
]


def analyze_missing_reason(word):
    """分析缺失词的可能原因"""
    reasons = []

    # 检查是否为多字词（>=4字）
    if len(word) >= 4:
        reasons.append(f"多字词({len(word)}字)，语料库可能收录较少")

    # 检查是否含非中文字符（英文/数字）
    has_non_chinese = any(not ('一' <= ch <= '鿿') for ch in word)
    if has_non_chinese:
        reasons.append("含非中文字符（英文/数字/符号）")

    # 网络新词/流行语判断（基于词的特征）
    internet_slang = {
        "摸鱼", "内卷", "躺平", "社恐", "破防", "松弛感", "摆烂",
        "种草", "拔草", "安利", "避雷", "剁手", "囤货", "探店", "网红", "带货",
        "打卡", "朋友圈", "微博", "抖音", "淘宝", "京东", "扫码",
    }
    if word in internet_slang:
        reasons.append("网络新词/流行语，腾讯语料可能未覆盖")

    # 品牌名/平台名
    brands = {"微信", "微博", "抖音", "淘宝", "京东"}
    if word in brands:
        reasons.append("品牌/平台名称，可能不在通用语料中")

    # 口语化/生活化词汇
    colloquial = {
        "外卖", "快递", "奶茶", "地铁", "公交", "工资", "房租", "周末", "假期",
        "逛街", "约会", "聚餐", "熬夜", "减肥", "充电", "口罩", "钥匙", "钱包",
        "厕所", "沙发", "筷子", "耳机", "空调", "暖气", "电梯", "阳台", "卧室", "厨房",
    }
    if word in colloquial:
        reasons.append("口语化/生活化词汇，正式语料可能未收录")

    if not reasons:
        reasons.append("未知")

    return "；".join(reasons)


def main():
    # === 加载数据 ===
    print(f"加载文件: {os.path.abspath(VOCAB_PATH)}")
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    total = len(vocab)
    print(f"\n{'='*60}")
    print(f"答案池总词数: {total}")
    print(f"{'='*60}")

    # === 1. 按字数分布统计 ===
    len_dist = {}
    for item in vocab:
        l = item["len"]
        len_dist[l] = len_dist.get(l, 0) + 1

    print("\n【1. 按字数分布】")
    for length in sorted(len_dist.keys()):
        count = len_dist[length]
        pct = count / total * 100
        print(f"  {length}字词: {count:>8} ({pct:5.1f}%)")

    # === 2. 前30个词 + 随机30个词 ===
    print("\n【2. 答案池样本词】")
    print("前30个词:")
    first_30 = [item["word"] for item in vocab[:30]]
    for i, w in enumerate(first_30, 1):
        print(f"  {i:>2}. {w}")

    random.seed(42)  # 固定种子保证可复现
    sampled = random.sample(vocab, 30)
    print("\n随机30个词 (seed=42):")
    for i, item in enumerate(sampled, 1):
        print(f"  {i:>2}. {item['word']} (len={item['len']}, pinyin={item['pinyin_initial']})")

    # === 3. 常用词覆盖测试 ===
    print(f"\n{'='*60}")
    print("【3. 常用词覆盖测试】")
    print(f"测试词总数: {len(TEST_WORDS)}")

    # 构建词集合用于快速查找
    word_set = {item["word"] for item in vocab}

    found_words = []
    missing_words = []

    for w in TEST_WORDS:
        if w in word_set:
            found_words.append(w)
        else:
            missing_words.append(w)

    print(f"  命中: {len(found_words)}/{len(TEST_WORDS)} ({len(found_words)/len(TEST_WORDS)*100:.1f}%)")
    print(f"  缺失: {len(missing_words)}/{len(TEST_WORDS)} ({len(missing_words)/len(TEST_WORDS)*100:.1f}%)")

    print(f"\n命中的词 ({len(found_words)}个):")
    for i, w in enumerate(found_words, 1):
        print(f"  {i:>2}. {w}")

    print(f"\n{'='*60}")
    print(f"【缺失词完整列表 ({len(missing_words)}个)】")
    print(f"{'='*60}")

    # === 4. 缺失词原因分析 ===
    print(f"\n{'序号':>4} | {'词': <6} | {'字数':>4} | 可能原因")
    print("-" * 70)
    for i, w in enumerate(missing_words, 1):
        reason = analyze_missing_reason(w)
        print(f"  {i:>2} | {w: <6} | {len(w):>4} | {reason}")

    # === 5. 总结 ===
    print(f"\n{'='*60}")
    print("【诊断总结】")
    print(f"{'='*60}")
    print(f"答案池总词数: {total}")
    print(f"常用词测试命中率: {len(found_words)}/{len(TEST_WORDS)} ({len(found_words)/len(TEST_WORDS)*100:.1f}%)")

    # 按缺失原因分组统计
    reason_groups = {}
    for w in missing_words:
        reason = analyze_missing_reason(w)
        reason_groups.setdefault(reason, []).append(w)

    print(f"\n缺失原因分布:")
    for reason, words in sorted(reason_groups.items(), key=lambda x: -len(x[1])):
        print(f"  [{len(words):>2}个] {reason}")
        print(f"        例: {', '.join(words[:5])}{'...' if len(words) > 5 else ''}")


if __name__ == "__main__":
    main()
