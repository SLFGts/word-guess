// cloudfunctions/newGame/index.js
// 开局云函数（双模式支持）
// Mode A（vector）：加载向量 → LLM smart_pick 选词 → 算排名表 → 存数据库
// Mode B（embedding）：选词 → 调 Embedding API → 存目标词向量 → 不计算排名表
// 通过环境变量 SIMILARITY_MODE 切换，默认 'vector'

const cloud = require('wx-server-sdk')
const OpenAI = require('openai').default
const fs = require('fs')
const path = require('path')
const WORD_POOL = require('./word-pool')  // 词池数据（53219 个词）

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数超时配置（Mode A 首次需下载 41MB 向量文件，Mode B 只需调 API）
exports.config = { timeout: 60 }

// ===== 词池与 blocklist =====
// blocklist：禁用词不作出题目标词
const blocklist = new Set()
const blPath = path.join(__dirname, 'blocklist.txt')
if (fs.existsSync(blPath)) {
  fs.readFileSync(blPath, 'utf8').split('\n').forEach(l => {
    const w = l.trim()
    if (w && !w.startsWith('#')) blocklist.add(w)
  })
}
const _playable = WORD_POOL.filter(w => !blocklist.has(w))
console.log(`词池：${WORD_POOL.length} 词，可玩 ${_playable.length}，禁用 ${blocklist.size}`)

// ===== LLM 客户端 =====
function llmClient() {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey || apiKey === 'your-dashscope-api-key') return null
  return new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey, timeout: 30000 })
}

// ===== Embedding API 客户端 =====
function embeddingClient() {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey || apiKey === 'your-dashscope-api-key') return null
  return new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey, timeout: 30000 })
}

/** 获取一个词的向量（调阿里云百炼 text-embedding-v3） */
async function getEmbedding(word) {
  const client = embeddingClient()
  if (!client) return null
  const resp = await client.embeddings.create({
    model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
    input: word,
  })
  return resp.data[0].embedding
}

// ===== Mode A：向量方案（原代码） =====

// 云存储 FileID
const CLOUD_ENV = 'cloud1-d3gr2aofwe81463b1'
const CLOUD_BUCKET = '636c-cloud1-d3gr2aofwe81463b1-1310505335'
const CLOUD_BASE = `cloud://${CLOUD_ENV}.${CLOUD_BUCKET}`
const VECTOR_BIN_FILEID = `${CLOUD_BASE}/vectors/vectors-f32.bin`
const VECTOR_META_FILEID = `${CLOUD_BASE}/vectors/vectors-words.json`
const BLOCKLIST_FILEID = `${CLOUD_BASE}/vectors/blocklist.txt`
const CACHE_DIR = '/tmp'
const CACHE_BIN = path.join(CACHE_DIR, 'vectors-f32.bin')
const CACHE_META = path.join(CACHE_DIR, 'vectors-words.json')
const CACHE_BL = path.join(CACHE_DIR, 'blocklist.txt')

let _vecs = null, _words = null, _wordIndex = null, _norms = null

async function downloadFromCloud(cloudPath, localPath) {
  if (fs.existsSync(localPath)) return
  const res = await cloud.downloadFile({ fileID: cloudPath })
  fs.writeFileSync(localPath, res.fileContent)
}

async function ensureLoaded() {
  if (_vecs) return
  await downloadFromCloud(VECTOR_META_FILEID, CACHE_META)
  await downloadFromCloud(VECTOR_BIN_FILEID, CACHE_BIN)
  await downloadFromCloud(BLOCKLIST_FILEID, CACHE_BL).catch(() => {})

  const meta = JSON.parse(fs.readFileSync(CACHE_META, 'utf8'))
  _words = meta.words
  const dim = meta.dim
  const buf = fs.readFileSync(CACHE_BIN)
  _vecs = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  _wordIndex = new Map()
  for (let i = 0; i < _words.length; i++) _wordIndex.set(_words[i], i)
  console.log(`Mode A 向量加载完成：${_words.length}词 ${dim}维`)
}

function ensureNorms() {
  if (_norms) return
  const n = _words.length
  const dim = _vecs.length / n
  _norms = new Float32Array(n * dim)
  for (let i = 0; i < n; i++) {
    const off = i * dim
    let nrm = 0
    for (let k = 0; k < dim; k++) nrm += _vecs[off + k] * _vecs[off + k]
    nrm = Math.sqrt(nrm) || 1
    for (let k = 0; k < dim; k++) _norms[off + k] = _vecs[off + k] / nrm
  }
}

function computeRankings(target) {
  ensureNorms()
  const n = _words.length
  const dim = _vecs.length / n
  const ti = _wordIndex.get(target)
  const tv = new Float32Array(dim)
  let tnorm = 0
  for (let k = 0; k < dim; k++) tnorm += _vecs[ti * dim + k] * _vecs[ti * dim + k]
  tnorm = Math.sqrt(tnorm) || 1
  for (let k = 0; k < dim; k++) tv[k] = _vecs[ti * dim + k] / tnorm
  const sims = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const off = i * dim
    let dot = 0
    for (let k = 0; k < dim; k++) dot += _norms[off + k] * tv[k]
    sims[i] = dot
  }
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => sims[b] - sims[a])
  const rankings = {}
  for (let r = 0; r < n; r++) rankings[_words[order[r]]] = r + 1
  return rankings
}

function leaksTarget(text, target) {
  if (!text) return false
  if (target.length < 2) return [...text].some(c => target.includes(c))
  for (let i = 0; i < target.length - 1; i++) {
    if (text.includes(target.slice(i, i + 2))) return true
  }
  return false
}

function buildPickPrompt(candidateWords) {
  const cand = candidateWords.map((w, i) => `${i + 1}. ${w}`).join('\n')
  return `你是猜词游戏的设计师。下面 ${candidateWords.length} 个词是随机候选，请从中选出最适合作为「目标词」的一个，并为它生成两条提示。

候选词：
${cand}

【选词标准】
- 适合出题：词义明确、能从多个方向联想逼近、适合朋友聚会玩、有话题性
- 难度适中：避免两个极端——不要选绝大多数玩家没听过的生僻词；也不要选一眼即中、毫无挑战的词。常见具象词作为简单题是合格的。
- 多样性：候选里选综合最优，不要总偏好最简单或最难的
- 必须回避以下不适合出题的词（即使候选里有也不要选）：
  · 含生僻字或繁体字的词（如「聯合」）
  · 不常用的生僻成语（如「赳武夫」）
  · 过于口语化、像动作短语而非固定词的（如「爬起来」）
  · 特殊领域的专业术语（如「钢格板」）

【生成要求】选出目标词后，同时生成两条提示：

提示 1（描述）：
- 包含词性、领域，必要时加通俗形容
- 30 个汉字以内
- 不得出现目标词本身的任何一个字
- 不得说出目标词或其近义词；生僻词可点明「这是一个生僻词」
- 通俗直白，不文言化
- 只输出描述本身，不带「提示」前缀、引号、序号

提示 2（锚点）：
- 给一个和目标词相关联的词，作方向提示
- 相关但不是同义词、不是变体、不与目标词共享任何一个字
- 只输出这个词本身，不带引号、解释或前缀

【输出格式】严格按以下 JSON 输出，不要输出其他任何内容：
{
  "chosen": "选中的目标词（必须是上面候选之一，原样）",
  "reason": "一句话选词理由，20 字内",
  "t1": "T1 描述提示",
  "anchor": "T2 锚点词"
}`
}

async function smartPick(candidateWords) {
  const client = llmClient()
  if (!client) return null
  const prompt = buildPickPrompt(candidateWords)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'qwen-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      })
      const result = JSON.parse(resp.choices[0].message.content.trim())
      const chosen = result.chosen || ''
      if (!candidateWords.includes(chosen)) continue
      const t1 = (result.t1 && result.t1.length <= 60 && !leaksTarget(result.t1, chosen)) ? result.t1 : null
      const anchor = (result.anchor && !leaksTarget(result.anchor, chosen)) ? result.anchor : null
      return { target: chosen, t1, anchor }
    } catch (e) {
      console.log(`smart_pick attempt${attempt + 1} 异常：${e.message}`)
      continue
    }
  }
  return null
}

function sampleCandidates(n) {
  const pool = _playable
  const out = []
  const used = new Set()
  while (out.length < n && out.length < pool.length) {
    const w = pool[Math.floor(Math.random() * pool.length)]
    if (!used.has(w)) { used.add(w); out.push(w) }
  }
  return out
}

// Mode A 开局逻辑
async function newGameVector(event) {
  await ensureLoaded()

  const mode = event.mode || 'normal'
  console.log(`Mode A (vector)：${mode}`)

  const candidates = sampleCandidates(5)
  const pick = await smartPick(candidates)
  let target, preT1, preAnchor

  if (pick) {
    target = pick.target
    preT1 = pick.t1
    preAnchor = pick.anchor
  } else {
    target = _playable[Math.floor(Math.random() * _playable.length)]
    preT1 = null
    preAnchor = null
  }

  const rankings = computeRankings(target)

  const gameId = String(Math.floor(Math.random() * 90000) + 10000)
  await db.collection('games').add({
    data: {
      gameId,
      target,
      rankings,
      t1: preT1,
      t3: preAnchor,
      qa: null,
      mode,
      similarityMode: 'vector',
      createdAt: db.serverDate()
    }
  })

  return { gameId, wordCount: _words.length, len: target.length, similarityMode: 'vector' }
}

// ===== Mode B：Embedding API 方案 =====

// Mode B 开局逻辑
async function newGameEmbedding(event) {
  const mode = event.mode || 'normal'
  console.log(`Mode B (embedding)：${mode}`)

  // 从词池选目标词（纯随机，不调 LLM）
  const target = _playable[Math.floor(Math.random() * _playable.length)]
  console.log(`目标词：${target}（长度 ${target.length}）`)

  // 调 Embedding API 获取目标词向量
  let targetVec = null
  try {
    targetVec = await getEmbedding(target)
    console.log(`目标词向量维度：${targetVec ? targetVec.length : 'null'}`)
  } catch (e) {
    console.warn(`Embedding 获取失败：${e.message}，将返回空向量`)
    targetVec = null
  }

  const gameId = String(Math.floor(Math.random() * 90000) + 10000)
  await db.collection('games').add({
    data: {
      gameId,
      target,
      targetVec,          // 目标词向量（用于后续 1v1 点积）
      mode,
      similarityMode: 'embedding',
      createdAt: db.serverDate()
    }
  })

  return { gameId, len: target.length, similarityMode: 'embedding', wordCount: _playable.length }
}

// ===== 云函数入口 =====
exports.main = async (event, context) => {
  const simMode = process.env.SIMILARITY_MODE || 'vector'

  if (simMode === 'embedding') {
    return await newGameEmbedding(event)
  } else {
    return await newGameVector(event)
  }
}
