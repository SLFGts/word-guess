#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""查答案池里有哪些常见外国音译名，输出供加 blocklist
加载 vocab-final.json（4.9MB，秒级），对常见外国名列表求交集。"""
import json
from pathlib import Path

ROOT = Path("/Users/slfg/Code/word_guess")
vocab = {item["word"] for item in json.load(
    open(ROOT / "data" / "vocab-final.json", encoding="utf-8"))}

# 常见外国音译名（男+女，2-4字，避免与中文常用词冲突的单字如"简/让"）
NAMES = """约翰 汤姆 杰克 迈克尔 大卫 丹尼尔 安东尼 理查德 罗伯特 威廉 查理 乔治 亨利
爱德华 詹姆斯 保罗 马克 彼得 史蒂夫 亚历山大 克里斯 亚当 安德烈 尼古拉 伊万
弗拉基米尔 安东尼奥 卡洛斯 胡安 何塞 路易 皮埃尔 雅克 汉斯 卡尔 阿尔伯特 维克多
奥斯卡 弗兰克 路易斯 阿尔弗雷德 查尔斯 弗雷德 凯文 杰森 马修 托尼 马丁 安迪 杰瑞
汤姆斯 沃尔特 巴里 加里 罗伊 杰夫 道格 艾伦 布鲁斯 丹尼斯 蒂姆 托马斯 摩西
亚伯拉罕 诺亚 玛丽 安娜 伊丽莎白 凯瑟琳 苏珊 丽莎 艾米 艾玛 萨拉 露西 海伦 朱莉
艾丽斯 玛格丽特 维多利亚 南希 芭芭拉 杰西卡 珍妮弗 莫妮卡 索菲亚 黛安娜 卡罗尔
琳达 安吉拉 克里斯汀 露丝 玛莎 朱迪斯 蒂娜 海蒂 娜塔莎 安妮 卡伦 黛安 帕梅拉
艾莉森 梅根 露娜 莎拉 苏菲 玛雅 莉莉 艾娃 佐伊 克洛伊 伊莎贝拉 斯黛拉""".split()

in_pool = sorted(set(w for w in NAMES if w in vocab))
print(f"答案池 {len(vocab)} 词中，命中 {len(in_pool)} 个外国名：")
for w in in_pool:
    print(w)
