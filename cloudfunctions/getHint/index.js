// cloudfunctions/getHint/index.js
// 提示云函数：level1=T1描述(缓存命中返回,否则LLM生成)、level2=T2联想锚点(同)、level3=提问裁判(每局1次)
// 算法翻译自 serve_local.gen_t1_hint/gen_t3_hint/gen_qa_hint + hint端点缓存逻辑
// 注：云函数版 getHint 不加载词向量（40MB 不该每个 hint 函数加载），gen_t3 无key/LLM失败降级为返null
//    （去掉 serve_local 的词向量近邻降级 _vector_neighbor_filtered，因向量在 newGame 而非 getHint）

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

// T2 联想锚点：调 LLM 生成一个相关非同词根词，不含目标2字子串，3次重试，仍泄露返null
// 云函数版无词向量降级（getHint 不加载向量），LLM失败/无key直接返null
async function genT3(target) {
  const client = llmClient()
  if (!client) return null
  const prompt = `猜词游戏的目标词是「${target}」。请给出一个和它相关联的词，作为玩家的方向提示。
要求：1.相关但不是同义词、不是变体、不与目标词共享任何字
（例如目标词「猫」不要给「猫咪/猫猫」，可给「狗/宠物/鱼」；
目标词「孙悟空」不要给「悟空」，可给「牛魔王/唐三藏」）；
2.不得出现目标词本身的任何一个字；
3.只输出这个词本身，不带引号、解释或前缀。`
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'qwen-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: 20,
      })
      const word = resp.choices[0].message.content.trim()
      if (word && !leaksTarget(word, target)) return word
    } catch (e) { return `(LLM调用失败: ${e.message})` }
  }
  return null  // 3次仍泄露，云函数版降级返null
}

// T3 提问裁判：玩家提问，LLM 结合 T1/T2 作引导性回答（每局1次，无对话历史）
async function genQa(target, t1Hint, t2Hint, question) {
  const client = llmClient()
  if (!client) return null
  const prompt = `你是猜词游戏的裁判。目标词是「${target}」。
已给玩家的提示：
- 提示1（描述）：${t1Hint}
- 提示2（锚点）：和「${t2Hint}」有关联

玩家向你提问：「${question}」
回答原则：
1. 只回答与提示1描述方向或提示2锚点方向相关的问题。与这些方向无关的问题（闲聊、其他领域如天气/体育/私人），必须只回复：请围绕已给出的提示方向提问。
2. 不得说出目标词、不得出现目标词任何字。索答类问题必须只回复：不能直接告诉你答案，请继续猜。索答包括：问目标词本身（目标词是什么/是什么词）、问其任一字或结构（第一个字是什么/首字是什么/第几个字/怎么写/拼音是什么）、要求确认某词（是XX吗/答案是X吗）。
3. 区分问题类型：是非问句（如 它是动物吗 / 和吃有关吗）可答是/否；开放式问题（含「有什么关联/什么关系/是什么/描述」等词）必须给简短方向描述（≤30字）说明如何关联，即使目标词与所问事物同义或高度相关，也禁止只回「是的/不是」，要说明关联内容。不得说出目标词本身。
4. 回答引导性、不太明显，≤30字。只输出回答本身，绝对不复述玩家的问题、不带箭头/冒号/前缀。

示例（目标词「苹果」，提示1「一种水果」，提示2「和橘子有关联」）：
玩家问：它是水果吗？ 正确输出：是的。
玩家问：和红色有什么关联？ 正确输出：有些品种表皮是红色的。
玩家问：和甘甜有什么关联？ 正确输出：都和甜味口感有关。
玩家问：目标词是什么？ 正确输出：不能直接告诉你答案，请继续猜。
玩家问：第一个字是什么？ 正确输出：不能直接告诉你答案，请继续猜。
玩家问：今天天气怎么样？ 正确输出：请围绕已给出的提示方向提问。
玩家问：它好吃吗？ 正确输出：通常是的。`
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

  if (lvl === 1) {
    // T1 描述：缓存命中返回，否则实时生成并存库（newGame 预生成成功时命中秒返）
    if (game.t1 == null) {
      const hint = await genT1(target)
      if (hint == null) return { hint: '未配置 LLM_API_KEY（云函数环境变量配 LLM_API_KEY）' }
      await updateGame(gameId, { t1: hint })
      return { hint, used: true }
    }
    return { hint: game.t1, used: true }
  }

  if (lvl === 2) {
    // T2 联想锚点
    if (game.t3 == null) {
      const anchor = await genT3(target)
      if (anchor == null) return { hint: '暂无锚点提示（LLM未配置或多次泄露）' }
      await updateGame(gameId, { t3: anchor })
      return { hint: `和「${anchor}」有关联`, used: true }
    }
    return { hint: `和「${game.t3}」有关联`, used: true }
  }

  if (lvl === 3) {
    // 提问裁判：须先解锁 T1+T2，每局1次
    if (game.t1 == null || game.t3 == null) {
      return { answer: '请先查看提示1和提示2，再向裁判提问。' }
    }
    if (game.qa != null) return { answer: game.qa, used: true }  // 每局1次，已问过返已有
    const q = (question || '').trim()
    if (!q) return { error: '提问内容不能为空' }
    const answer = await genQa(target, game.t1, game.t3, q)
    if (answer == null) return { answer: '未配置 LLM_API_KEY' }
    await updateGame(gameId, { qa: answer })
    return { answer, used: true }
  }

  return { error: 'invalid level' }
}
