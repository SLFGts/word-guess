// cloudfunctions/getHint/index.js
// 提示云函数：4层递进提示系统
// T1 类别（直接展示，预生成）→ T2 范围（按钮1）→ T3 特征（按钮2）→ T4 问答（按钮3）
// 注：云函数版 getHint 不加载词向量，LLM 失败降级为返 null

const cloud = require('wx-server-sdk')
const OpenAI = require('openai').default
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// LLM 客户端（qwen-turbo 走阿里云百炼）；无 key 返回 null
function llmClient() {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey || apiKey === 'your-dashscope-api-key') return null
  return new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey, timeout: 30000 })
}

// 泄露判定：含 target 的 2 字及以上连续子串算泄露（单字如水/电/鱼不剧透放过）
function leaksTarget(text, target) {
  if (!text) return false
  if (target.length < 2) return [...text].some(c => target.includes(c))
  for (let i = 0; i < target.length - 1; i++) {
    if (text.includes(target.slice(i, i + 2))) return true
  }
  return false
}

// T1 描述：调 LLM 生成≤30字描述，不含目标2字子串，3次重试，仍泄露返原文不遮罩
async function genT1(target) {
  const client = llmClient()
  if (!client) return null
  const prompt = `你是猜词游戏的提示生成专家，非常善于引导玩家逐步猜中目标词。目标词是「${target}」。
请给出一句提示，包含该词的词性、领域以及简单形容（如果必要）：
词性包括名词/动词/形容词/成语/网络用语等，
领域可以说和动物/食物/植物/情感/通信/金融/体育/建筑/自然/文化/生活等有关，
如果该词太难太生僻，可以用通俗的话形容，进一步指出方向但不能太明显。
要求：1.共30个汉字以内；2.不得说出目标词或其近义词；
3.不得出现目标词本身的任何一个字；
4.对于一些明显生僻的词，可以直接点明这是一个生僻词；
5.形容必须通俗直白，不得文言化或生僻；
6.只输出提示本身，不得带「提示」等前缀、不得带引号序号。
示例：「宠物店」——「一个名词，表示一类场所，和小动物有关。」
示例：「平壤」——「一个名词，一个城市，是某个国家的首都。」`
  let last = null
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'qwen-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: 40,
      })
      last = resp.choices[0].message.content.trim()
      if (!leaksTarget(last, target)) return last  // 不含目标2字子串，采用
    } catch (e) { return `(LLM调用失败: ${e.message})` }
  }
  return last || '(LLM未返回)'  // 3次仍泄露，返原文不遮罩（保持提示可读）
}

// T2 范围缩小：在类别基础上进一步限定范围（产地/体型/颜色/功能/时代等）
// 云函数版无词向量降级，LLM 失败直接返 null
async function genT2(target, category) {
  const client = llmClient()
  if (!client) return null
  const ctx = category ? `目标词属于「${category}」。` : ''
  const prompt = `猜词游戏的目标词是「${target}」。${ctx}请给出一句进一步缩小范围的提示，从产地、体型、颜色、材质、功能、时代、使用场景等任一角度切入，帮助玩家在知道类别后进一步缩小猜测范围。
要求：1. 20 个汉字以内；2. 不得出现目标词本身的任何一个字；3. 不得说出目标词或其近义词；4. 只输出提示本身，不带引号、前缀。
示例：「常见于热带地区」「属于犬科」「多用于厨房」「诞生于唐朝」`
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'qwen-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: 30,
      })
      const hint = resp.choices[0].message.content.trim()
      if (hint && !leaksTarget(hint, target)) return hint
    } catch (e) { return `(LLM调用失败: ${e.message})` }
  }
  return null
}

// T3 特征形容：给出一个鲜明、具体、有辨识度的特征或细节
// 云函数版无词向量降级，LLM 失败直接返 null
async function genT3(target) {
  const client = llmClient()
  if (!client) return null
  const prompt = `猜词游戏的目标词是「${target}」。请给出一句描述其鲜明特征或细节的提示，让已经知道类别和范围的玩家可以锁定答案。
要求：1. 20 个汉字以内；2. 不得出现目标词本身的任何一个字；3. 不得说出目标词或其近义词；4. 只输出特征描述本身，不带引号、前缀。
示例：「果皮有刺且气味浓烈」「尾巴蓬松会竖起来」「可以拉出四种不同音高」「以竹子为食」`
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'qwen-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: 30,
      })
      const hint = resp.choices[0].message.content.trim()
      if (hint && !leaksTarget(hint, target)) return hint
    } catch (e) { return `(LLM调用失败: ${e.message})` }
  }
  return null
}

// T4 提问裁判：玩家基于前三条提示提问，LLM 作引导性回答（每局1次）
async function genQa(target, category, range, feature, question) {
  const client = llmClient()
  if (!client) return null
  const prompt = `你是猜词游戏的裁判。目标词是「${target}」。
已给玩家的提示：
- 类别：${category}
- 范围：${range}
- 特征：${feature}

玩家向你提问：「${question}」
回答原则：
1. 只回答与已有提示方向相关的问题。与这些方向无关的问题（闲聊、其他领域如天气/体育/私人），必须只回复：请围绕已给出的提示方向提问。
2. 不得说出目标词、不得出现目标词任何字。索答类问题必须只回复：不能直接告诉你答案，请继续猜。索答包括：问目标词本身（目标词是什么/是什么词）、问其任一字或结构（第一个字是什么/首字是什么/第几个字/怎么写/拼音是什么）、要求确认某词（是XX吗/答案是X吗）。
3. 区分问题类型：是非问句（如 它是动物吗 / 和吃有关吗）可答是/否；开放式问题（含「有什么关联/什么关系/是什么/描述」等词）必须给简短方向描述（≤30字）说明如何关联，即使目标词与所问事物同义或高度相关，也禁止只回「是的/不是」，要说明关联内容。不得说出目标词本身。
4. 回答引导性、不太明显，≤30字。只输出回答本身，绝对不复述玩家的问题、不带箭头/冒号/前缀。

示例（目标词「榴莲」，类别「一种水果」，范围「常见于热带地区」，特征「果皮有刺且气味浓烈」）：
玩家问：它是水果吗？ 正确输出：是的。
玩家问：和红色有什么关联？ 正确输出：果肉通常是金黄色的。
玩家问：它好吃吗？ 正确输出：爱的人觉得香甜，怕的人觉得刺鼻。
玩家问：目标词是什么？ 正确输出：不能直接告诉你答案，请继续猜。
玩家问：第一个字是什么？ 正确输出：不能直接告诉你答案，请继续猜。
玩家问：今天天气怎么样？ 正确输出：请围绕已给出的提示方向提问。`
  try {
    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || 'qwen-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9, max_tokens: 60,
    })
    return resp.choices[0].message.content.trim()
  } catch (e) { return `(LLM调用失败: ${e.message})` }
}

// 更新 game 文档指定字段（缓存生成结果，每局每级只生成一次）
async function updateGame(gameId, patch) {
  await db.collection('games').where({ gameId }).update({ data: patch })
}

exports.main = async (event, context) => {
  const { gameId, level, question } = event
  if (!gameId) return { error: 'invalid gameId' }
  const { data } = await db.collection('games').where({ gameId }).get()
  if (!data.length) return { error: 'invalid gameId' }
  const game = data[0]
  const target = game.target
  const lvl = Number(level)  // 前端传的是字符串，统一转数字

  // === 新 4 层提示系统 ===
  // T1 类别：直接展示在 UI（预生成），不通过此接口
  // Level 1 → T2 范围提示（按钮1）
  // Level 2 → T3 特征提示（按钮2）
  // Level 3 → T4 问答（按钮3，进入提问模式）

  if (lvl === 1) {
    // T2 范围缩小（兼容旧数据：game.t3 旧锚点 → 不兼容，旧 t3 是锚点词不是范围描述）
    if (game.t2 == null) {
      const hint = await genT2(target, game.t1)
      if (hint == null) return { hint: '暂无范围提示（LLM未配置或多次泄露）' }
      await updateGame(gameId, { t2: hint })
      return { hint, used: true }
    }
    return { hint: game.t2, used: true }
  }

  if (lvl === 2) {
    // T3 特征形容
    if (game.t3 == null) {
      const hint = await genT3(target)
      if (hint == null) return { hint: '暂无特征提示（LLM未配置或多次泄露）' }
      await updateGame(gameId, { t3: hint })
      return { hint, used: true }
    }
    return { hint: game.t3, used: true }
  }

  if (lvl === 3) {
    // T4 提问裁判：须先有 T1+T2+T3 三条提示，每局1次
    if (game.t1 == null || game.t2 == null || game.t3 == null) {
      return { answer: '请先查看全部提示，再向裁判提问。' }
    }
    if (game.qa != null) return { answer: game.qa, used: true }  // 每局1次，已问过返已有
    const q = (question || '').trim()
    if (!q) return { error: '提问内容不能为空' }
    const answer = await genQa(target, game.t1, game.t2, game.t3, q)
    if (answer == null) return { answer: '未配置 LLM_API_KEY' }
    await updateGame(gameId, { qa: answer })
    return { answer, used: true }
  }

  return { error: 'invalid level' }
}
