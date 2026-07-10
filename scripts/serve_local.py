#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地玩法原型 HTTP 服务（Step A4）

用途：加载 vectors.json + vocab-final.json，提供猜词 API + 静态页，
      浏览器打开 http://localhost:8000 直接玩，验证核心玩法。
端点：
  GET  /            → 返回 prototype/index.html
  POST /new_game    → 随机选目标词，返回 gameId
  POST /guess       → 入参 {gameId, word}，返回 {score, won}
  POST /hint        → 入参 {gameId, level(1/2/3)}，返回 {hint}
"""
import json
import random
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import os

ROOT = Path(__file__).resolve().parent.parent
VEC_PATH = ROOT / "data" / "vectors.json"
VOCAB_PATH = ROOT / "data" / "vocab-final.json"
HTML_PATH = ROOT / "prototype" / "index.html"

# 加载答案池向量
print("加载答案池向量（106MB，十几秒）...")
with open(VEC_PATH, encoding="utf-8") as f:
    data = json.load(f)
WORDS = data["words"]
VECTORS = data["vectors"]
DIM = data["dim"]
print(f"加载完成：{len(WORDS)} 词，{DIM} 维")

# 加载词汇属性（T2 提示用）
with open(VOCAB_PATH, encoding="utf-8") as f:
    VOCAB = json.load(f)
WORD_META = {item["word"]: item for item in VOCAB}

# 词到向量索引
WORD_INDEX = {w: i for i, w in enumerate(WORDS)}

# 用户手动禁用词表（测试中遇到不想出现的词；重启即时屏蔽目标词选择+猜词，重跑构建物理删除）
BLOCKLIST = set()
_blocklist_path = ROOT / "data" / "blocklist.txt"
if _blocklist_path.exists():
    with open(_blocklist_path, encoding="utf-8") as _f:
        BLOCKLIST = {_l.strip() for _l in _f if _l.strip() and not _l.startswith("#")}
WORDS_PLAYABLE = [w for w in WORDS if w not in BLOCKLIST]  # 可作目标词的池
print(f"禁用词 {len(BLOCKLIST)} 个，可玩目标词 {len(WORDS_PLAYABLE)} 个")

# 转 numpy 矩阵并预归一化（余弦相似度用）
import numpy as np
VECS = np.array(VECTORS, dtype=np.float32)
NORMS = VECS / np.linalg.norm(VECS, axis=1, keepdims=True)

# 游戏状态（内存，原型用）
games = {}  # gameId -> {target, rankings}

# LLM 配置（T1 类别提示用，从 .env 加载 qwen-turbo 走阿里云百炼 OpenAI 兼容模式）
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass
LLM_BASE_URL = os.getenv("LLM_BASE_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen-turbo")

def _llm_client():
    """构造 OpenAI 兼容客户端（qwen-turbo 走阿里云百炼），未配置 key 时返回 None。
    抽出供 T1/T3 复用，避免各自重复构造客户端。"""
    if not LLM_API_KEY or LLM_API_KEY == "your-dashscope-api-key":
        return None
    from openai import OpenAI
    return OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY, timeout=30.0)


def _leaks_target(text, target):
    """检查文本是否泄露目标词：含 target 的 2 字及以上连续子串算泄露。
    单字重叠（水/电/山等常用字）不剧透、放过；2 字子串（雪山/经济/麻绳）开始剧透才拦。
    prompt 的"不得出现目标词任何字"是软约束尽量让 LLM 避字，此处硬校验兜底放过避不开的单字。"""
    if len(target) < 2:
        # 单字目标词：该字本身即剧透，回退到严格"含任何字"判定
        return any(c in target for c in text)
    # target 所有 2 字连续子串，任一出现在 text 即算泄露
    return any(target[i:i+2] in text for i in range(len(target) - 1))


def gen_t1_hint(target):
    """T1 描述提示：每局点击时实时调 LLM 生成（不缓存，保证不同局结果新颖）。
    返回一句话含词性/领域/简单形容，≤30字，不得出现目标词任何字。
    LLM 软约束不可靠，生成后校验是否泄露目标词字，最多重试3次，仍泄露则直接返回原文不遮罩（保持可读）。"""
    client = _llm_client()
    if client is None:
        return None  # 未配置 key，由调用方给降级提示
    prompt = (
        f"你是猜词游戏的提示生成专家，非常善于引导玩家逐步猜中目标词。目标词是「{target}」。"
        f"请给出一句提示，包含该词的词性、领域以及简单形容（如果必要）："
        f"词性包括名词/动词/形容词/成语/网络用语等，"
        f"领域可以说和动物/食物/植物/情感/通信/金融/体育/建筑/自然/文化/生活等有关，"
        f"如果该词太难太生僻，可以用通俗的话形容，进一步指出方向但不能太明显。"
        f"要求：1.共30个汉字以内；2.不得说出目标词或其近义词；"
        f"3.不得出现目标词本身的任何一个字；"
        f"4.对于一些明显生僻的词，可以直接点明这是一个生僻词；"
        f"5.形容必须通俗直白，不得文言化或生僻；"
        f"6.只输出提示本身，不得带「提示」等前缀、不得带引号序号。"
        f"示例：「宠物店」——「一个名词，表示一类场所，和小动物有关。」"
        f"示例：「平壤」——「一个名词，一个城市，是某个国家的首都。」"
    )
    last = None
    for _ in range(3):  # 最多3次，软约束不保证，重试提高命中率
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
                max_tokens=40,
            )
            last = resp.choices[0].message.content.strip()
            if not _leaks_target(last, target):
                return last  # 不含目标字，采用
        except Exception as e:
            return f"(LLM调用失败: {e})"
    # 3次仍含目标字：直接返回 LLM 原始输出，不做遮罩改写（保持提示可读，宁可泄露目标字也不要特殊符号）
    return last if last else "(LLM未返回)"


def gen_t3_hint(target):
    """T3 联想锚点：调 LLM 生成一个相关联想词作方向提示（不在答案池也行，玩家只作方向参考）。
    要求相关但非同词根/变体/同义词、不含目标词任何字；LLM 软约束不可靠，生成后校验，
    最多重试3次，仍泄露则降级用词向量过滤同词根取首个近邻（保证不含目标字）。"""
    client = _llm_client()
    if client is None:
        return _vector_neighbor_filtered(target)  # 无 key 直接降级
    prompt = (
        f"猜词游戏的目标词是「{target}」。请给出一个和它相关联的词，作为玩家的方向提示。"
        f"要求：1.相关但不是同义词、不是变体、不与目标词共享任何字"
        f"（例如目标词「猫」不要给「猫咪/猫猫」，可给「狗/宠物/鱼」；"
        f"目标词「孙悟空」不要给「悟空」，可给「牛魔王/唐三藏」）；"
        f"2.不得出现目标词本身的任何一个字；"
        f"3.只输出这个词本身，不带引号、解释或前缀。"
    )
    for _ in range(3):
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
                max_tokens=20,
            )
            word = resp.choices[0].message.content.strip()
            if word and not _leaks_target(word, target):
                return word
        except Exception as e:
            return f"(LLM调用失败: {e})"
    return _vector_neighbor_filtered(target)  # 3次仍泄露，降级词向量（保证不含目标字）


def _vector_neighbor_filtered(target):
    """降级 T3：词向量取近邻，过滤与目标词共享任意字的变体，返回首个联想词。"""
    t_idx = WORD_INDEX[target]
    t_norm = VECS[t_idx] / np.linalg.norm(VECS[t_idx])
    sims = NORMS @ t_norm
    order = np.argsort(-sims)
    for pos in range(1, len(order)):
        w = WORDS[order[pos]]
        if not any(c in w for c in target):  # 排除同词根变体（共享任意字）
            return w
    return WORDS[order[1]]  # 兜底：全部共享字时取首个近邻


def gen_qa_hint(target, t1_hint, t2_hint, question):
    """提问裁判：玩家提一个问题，LLM 结合已揭示的 T1描述/T2锚点 作引导性回答。
    只答与提示方向相关的问题；不直接给答案、不出现目标词字；每局一次（无对话历史）。"""
    client = _llm_client()
    if client is None:
        return None
    prompt = (
        f"你是猜词游戏的裁判。目标词是「{target}」。\n"
        f"已给玩家的提示：\n- 提示1（描述）：{t1_hint}\n- 提示2（锚点）：和「{t2_hint}」有关联\n\n"
        f"玩家向你提问：「{question}」\n"
        f"回答原则：\n"
        f"1. 只回答与提示1描述方向或提示2锚点方向相关的问题。与这些方向无关的问题"
        f"（闲聊、其他领域如天气/体育/私人），必须只回复：请围绕已给出的提示方向提问。\n"
        f"2. 不得说出目标词、不得出现目标词任何字。索答类问题必须只回复：不能直接告诉你答案，请继续猜。"
        f"索答包括：问目标词本身（目标词是什么/是什么词）、问其任一字或结构"
        f"（第一个字是什么/首字是什么/第几个字/怎么写/拼音是什么）、要求确认某词（是XX吗/答案是X吗）。\n"
        f"3. 区分问题类型：是非问句（如 它是动物吗 / 和吃有关吗）可答是/否；"
        f"开放式问题（含「有什么关联/什么关系/是什么/描述」等词）必须给简短方向描述（≤30字）说明如何关联，"
        f"即使目标词与所问事物同义或高度相关，也禁止只回「是的/不是」，要说明关联内容。不得说出目标词本身。\n"
        f"4. 回答引导性、不太明显，≤30字。只输出回答本身，绝对不复述玩家的问题、不带箭头/冒号/前缀。\n\n"
        f"示例（目标词「苹果」，提示1「一种水果」，提示2「和橘子有关联」）：\n"
        f"玩家问：它是水果吗？ 正确输出：是的。\n"
        f"玩家问：和红色有什么关联？ 正确输出：有些品种表皮是红色的。\n"
        f"玩家问：和甘甜有什么关联？ 正确输出：都和甜味口感有关。\n"
        f"玩家问：目标词是什么？ 正确输出：不能直接告诉你答案，请继续猜。\n"
        f"玩家问：第一个字是什么？ 正确输出：不能直接告诉你答案，请继续猜。\n"
        f"玩家问：今天天气怎么样？ 正确输出：请围绕已给出的提示方向提问。\n"
        f"玩家问：它好吃吗？ 正确输出：通常是的。"
    )
    try:
        resp = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
            max_tokens=60,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"(LLM调用失败: {e})"


def _build_pick_prompt(candidate_words):
    """构造"选词 + 生成 T1/T2"合并调用的 prompt。
    只给候选词本身（不给拼音首字母——对选词评判无帮助、反分散注意力），
    要求 LLM 选最适合出题的词并生成 T1描述/T2锚点，严格输出 JSON。"""
    # 候选词编号列表
    cand_list = "\n".join(f"{i+1}. {w}" for i, w in enumerate(candidate_words))
    return (
        f"你是猜词游戏的设计师。下面 {len(candidate_words)} 个词是随机候选，"
        f"请从中选出最适合作为「目标词」的一个，并为它生成两条提示。\n\n"
        f"候选词：\n{cand_list}\n\n"
        f"【选词标准】\n"
        f"- 适合出题：词义明确、能从多个方向联想逼近、适合朋友聚会玩、有话题性\n"
        f"- 难度适中：避免两个极端——不要选绝大多数玩家没听过的生僻词；"
        f"也不要选一眼即中、毫无挑战的词。常见具象词作为简单题是合格的。\n"
        f"- 多样性：候选里选综合最优，不要总偏好最简单或最难的\n"
        f"- 必须回避以下不适合出题的词（即使候选里有也不要选）：\n"
        f"  · 含生僻字或繁体字的词（如「聯合」）\n"
        f"  · 不常用的生僻成语（如「赳赳武夫」）\n"
        f"  · 过于口语化、像动作短语而非固定词的（如「爬起来」）\n"
        f"  · 特殊领域的专业术语（如「钢格板」）\n\n"
        f"【生成要求】选出目标词后，同时生成两条提示：\n\n"
        f"提示1（描述）：\n"
        f"- 包含词性、领域，必要时加通俗形容\n"
        f"- 30 个汉字以内\n"
        f"- 不得出现目标词本身的任何一个字\n"
        f"- 不得说出目标词或其近义词；生僻词可点明「这是一个生僻词」\n"
        f"- 通俗直白，不文言化\n"
        f"- 只输出描述本身，不带「提示」前缀、引号、序号\n\n"
        f"提示2（锚点）：\n"
        f"- 给一个和目标词相关联的词，作方向提示\n"
        f"- 相关但不是同义词、不是变体、不与目标词共享任何一个字\n"
        f"- 只输出这个词本身，不带引号、解释或前缀\n\n"
        f"【输出格式】严格按以下 JSON 输出，不要输出其他任何内容：\n"
        "{\n"
        '  "chosen": "选中的目标词（必须是上面候选之一，原样）",\n'
        '  "reason": "一句话选词理由，20字内",\n'
        '  "t1": "T1描述提示",\n'
        '  "anchor": "T2锚点词"\n'
        "}"
    )


def smart_pick_target(candidate_words):
    """一次 LLM 调用：选最适合出题的词 + 生成 T1 描述 + T2 锚点。
    返回 (target, t1, anchor) 或 None（全部失败走纯随机）。
    t1/anchor 各自可能为 None（泄露/空时），不影响选词成功——
    点提示时若该级缓存为 None，走原 gen_t1_hint/gen_t3_hint 实时生成兜底。"""
    client = _llm_client()
    if client is None:
        return None  # 未配置 key → 调用方走纯随机（即现状）
    prompt = _build_pick_prompt(candidate_words)
    for _ in range(2):  # 失败降级为纯随机即现状，非致命，2 次足够
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=300,  # 合并输出 chosen+reason+t1+anchor，200 偏紧会截断
                response_format={"type": "json_object"},  # qwen-turbo 经百炼兼容模式支持
            )
            result = json.loads(resp.choices[0].message.content.strip())
            chosen = result.get("chosen", "")
            if chosen not in candidate_words:
                continue  # chosen 不在候选（幻觉），重试
            # t1/anchor 各自独立校验：泄露目标字/空/超长 → 置 None，点提示时走原 gen 函数兜底
            t1 = result.get("t1", "")
            t1 = t1 if (t1 and len(t1) <= 60 and not _leaks_target(t1, chosen)) else None
            anchor = result.get("anchor", "")
            anchor = anchor if (anchor and not _leaks_target(anchor, chosen)) else None
            return chosen, t1, anchor
        except Exception:
            continue
    return None  # 2 次失败 → 调用方走纯随机


def compute_rankings(target_word):
    """算目标词与全部词的余弦相似度，降序得排名表"""
    t_idx = WORD_INDEX[target_word]
    t_vec = VECS[t_idx]
    t_norm = t_vec / np.linalg.norm(t_vec)
    sims = NORMS @ t_norm  # (N,) 与全部词的相似度
    order = np.argsort(-sims)  # 降序索引
    # 排名：第 i 个的排名为 i+1
    rankings = {WORDS[order[i]]: i + 1 for i in range(len(order))}
    return rankings


def score_for(guess, rankings):
    """猜词分数：对数排名映射 0-100，保留两位小数
    用 1-log(rank)/log(N) 拉开头部梯度——线性映射下 top20 全挤在 100 分无区分度，
    对数压缩尾部无关词区间、放大头部差异：rank=1→100、rank=10→77、rank=100→55、rank=1000→32。
    保留两位小数：尾部高 rank 区间相邻排名的整数分易相同（如 rank 100-106 都 57-58），
    玩家多猜后历史同分无区分度，两位小数拉开相邻词差异。
    """
    if guess not in rankings:
        return None  # 不在词库
    rank = rankings[guess]
    n = len(rankings)
    if rank <= 1:
        return 100.0  # 猜中（目标词自身 rank=1）
    import math
    return round((1 - math.log(rank) / math.log(n)) * 100, 2)


class Handler(BaseHTTPRequestHandler):
    """HTTP 请求处理：GET 返回静态页，POST 处理游戏 API"""

    def _send_json(self, obj, code=200):
        """发送 JSON 响应"""
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(obj, ensure_ascii=False).encode())

    def do_GET(self):
        """GET / 返回原型页；GET /answer?gameId= 调试用查看目标词"""
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ("/", "/index.html"):
            if HTML_PATH.exists():
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(HTML_PATH.read_bytes())
            else:
                self._send_json({"error": "index.html not found"}, 404)
        elif path == "/answer":
            # 调试用：查看当前局目标词（正式版上线前移除）
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            game_id = (qs.get("gameId") or [""])[0]
            if game_id in games:
                self._send_json({"target": games[game_id]["target"]})
            else:
                self._send_json({"error": "invalid gameId"}, 400)
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        """POST 处理 new_game / guess / hint"""
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode() if length else "{}"
        try:
            params = json.loads(body) if body else {}
        except json.JSONDecodeError:
            params = {}

        if path == "/new_game":
            # 智能选词：抽 5 候选 → 一次 LLM 调用选最适合出题的词 + 预生成 T1/T2
            # 失败/无 key 降级为纯随机（即原行为）；预生成的 t1/t3 存缓存供点提示时秒返
            candidates = random.sample(WORDS_PLAYABLE, min(5, len(WORDS_PLAYABLE)))
            pick = smart_pick_target(candidates)
            if pick is not None:
                target, pre_t1, pre_anchor = pick
            else:
                target, pre_t1, pre_anchor = random.choice(WORDS_PLAYABLE), None, None
            rankings = compute_rankings(target)
            game_id = str(random.randint(10000, 99999))
            # t1/t3 预生成成功则填入（点提示命中缓存秒返）；失败保持 None，点提示走原 gen 函数兜底
            games[game_id] = {"target": target, "rankings": rankings,
                              "t1": pre_t1, "t3": pre_anchor, "qa": None}
            # 字数开局默认给出（原 T2 结构提示前置到开局基础信息）
            meta = WORD_META.get(target, {})
            self._send_json({"gameId": game_id, "wordCount": len(WORDS), "len": meta.get("len", "?")})

        elif path == "/guess":
            game_id = params.get("gameId")
            guess = params.get("word", "").strip()
            if game_id not in games:
                self._send_json({"error": "invalid gameId"}, 400)
                return
            game = games[game_id]
            target = game["target"]
            rankings = game["rankings"]
            if guess in BLOCKLIST:
                self._send_json({"score": None, "message": "该词已被禁用"})
                return
            if guess not in WORD_INDEX:
                self._send_json({"score": None, "message": "词库里没有这个词"})
                return
            score = score_for(guess, rankings)
            won = (guess == target)
            self._send_json({"score": score, "won": won})

        elif path == "/hint":
            game_id = params.get("gameId")
            level = params.get("level")
            if game_id not in games:
                self._send_json({"error": "invalid gameId"}, 400)
                return
            game = games[game_id]
            target = game["target"]
            # level 语义：1=描述提示(T1)、2=联想锚点(T3，原三级里的 T3 重定义为 2)
            # 每局每级只生成一次：首次调用生成并回填 game，重复调用直接返回已存结果（防直接 POST 重复调 LLM）
            if level == 1:
                # T1 描述：每局一次，首次实时调 LLM 生成（不缓存跨局，保证新颖）
                if game["t1"] is None:
                    game["t1"] = gen_t1_hint(target)
                hint_text = game["t1"]
                if hint_text is None:
                    self._send_json({"hint": "未配置 LLM_API_KEY（复制 .env.example 为 .env 填 key 后重启）"})
                else:
                    self._send_json({"hint": hint_text, "used": True})
            elif level == 2:
                # T3 联想锚点：每局一次，首次调 LLM 生成联想方向词（不在答案池也行）
                if game["t3"] is None:
                    game["t3"] = gen_t3_hint(target)
                self._send_json({"hint": f"和「{game['t3']}」有关联", "used": True})
            elif level == 3:
                # 提问裁判：须先解锁 T1描述+T2锚点，每局一次（玩家只有1次提问机会）
                if game["t1"] is None or game["t3"] is None:
                    self._send_json({"answer": "请先查看提示1和提示2，再向裁判提问。"})
                    return
                if game.get("qa") is not None:
                    # 每局一次，已提问过：返回已有回答，不再调 LLM
                    self._send_json({"answer": game["qa"], "used": True})
                    return
                question = (params.get("question") or "").strip()
                if not question:
                    self._send_json({"error": "提问内容不能为空"}, 400)
                    return
                answer = gen_qa_hint(target, game["t1"], game["t3"], question)
                if answer is None:
                    self._send_json({"answer": "未配置 LLM_API_KEY（复制 .env.example 为 .env 填 key 后重启）"})
                else:
                    game["qa"] = answer
                    self._send_json({"answer": answer, "used": True})
            else:
                self._send_json({"error": "invalid level"}, 400)
        else:
            self._send_json({"error": "not found"}, 404)

    def log_message(self, *args):
        """静默默认日志"""
        pass


if __name__ == "__main__":
    port = 8000
    print(f"\n原型服务启动：http://localhost:{port}")
    print("浏览器打开上面地址，开始猜词（输入词看相关度，100=猜中）")
    HTTPServer(("localhost", port), Handler).serve_forever()
