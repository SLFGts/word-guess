#!/usr/bin/env python3
"""
提取词池：从 vectors-words.json 提取 53219 个词，生成 JS 模块 word-pool.js
运行一次即可，生成的文件可直接打包进云函数
"""

import json
from pathlib import Path

# 数据路径
DATA_DIR = Path(__file__).parent.parent / "data"
WORDS_JSON = DATA_DIR / "vectors-words.json"
OUTPUT_JS = Path(__file__).parent.parent / "cloudfunctions" / "newGame" / "word-pool.js"

def extract_word_pool():
    print("加载 vectors-words.json...")
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    words = meta['words']
    dim = meta['dim']

    print(f"  词数：{len(words)}")
    print(f"  维度：{dim}")

    # 生成 JS 模块
    js_content = f"// 自动生成的词池数据（从 vectors-words.json 提取）\n"
    js_content += f"// 共 {len(words)} 个词，{dim} 维\n"
    js_content += f"// 用于 Embedding API 模式（Mode B）的随机选词\n"
    js_content += f"module.exports = {json.dumps(words, ensure_ascii=False)};\n"

    # 写入文件
    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)

    # 检查文件大小
    size_kb = OUTPUT_JS.stat().st_size / 1024
    print(f"\n✅ 词池已生成：{OUTPUT_JS}")
    print(f"  文件大小：{size_kb:.1f}KB")
    print(f"  词数：{len(words)}")

    # 验证
    with open(OUTPUT_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查是否能正常加载
    exec_globals = {'module': {'exports': None}}
    exec(content, exec_globals)
    loaded_words = exec_globals['module']['exports']

    print(f"\n✅ 验证通过：可正常加载 {len(loaded_words)} 个词")
    print(f"  前 10 个词：{loaded_words[:10]}")
    print(f"  最后 10 个词：{loaded_words[-10:]}")

if __name__ == "__main__":
    extract_word_pool()
