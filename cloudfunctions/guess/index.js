// cloudfunctions/guess/index.js
// 猜词云函数（双模式支持）
// Mode A（vector）：查排名表 → 对数映射 → 返回分数
// Mode B（embedding）：调 Embedding API → 1v1 余弦相似度 → 返回原始相似度
// 从数据库读 similarityMode 字段自动识别模式

const cloud = require('wx-server-sdk')
const OpenAI = require('openai').default

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== Embedding API 客户端 =====
function embeddingClient() {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey || apiKey === 'your-dashscope-api-key') return null
  return new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey, timeout: 30000 })
}

/** 获取一个词的向量 */
async function getEmbedding(word) {
  const client = embeddingClient()
  if (!client) return null
  const resp = await client.embeddings.create({
    model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
    input: word,
  })
  return resp.data[0].embedding
}

/** 余弦相似度（两向量点积） */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  normA = Math.sqrt(normA) || 1
  normB = Math.sqrt(normB) || 1
  return dot / (normA * normB)
}

// ===== Mode A：向量方案（原代码） =====

// 对数排名映射 0-100：rank=1→100(猜中)，rank=10→77，rank=100→55
function scoreFor(rank, n) {
  if (rank <= 1) return 100.0
  return Math.round((1 - Math.log(rank) / Math.log(n)) * 10000) / 100
}

async function guessVector(game, wordTrim) {
  // OOV：不在词库
  if (!game.rankings || !(wordTrim in game.rankings)) {
    return { score: null, message: '词库里没有这个词' }
  }
  const rank = game.rankings[wordTrim]
  const n = Object.keys(game.rankings).length
  const score = scoreFor(rank, n)
  const won = (wordTrim === game.target)
  return { score, won }
}

// ===== Mode B：Embedding API 方案 =====

async function guessEmbedding(game, wordTrim) {
  // 获取目标词向量（已在 newGame 时存到数据库）
  const targetVec = game.targetVec
  if (!targetVec) {
    return { error: '目标词向量缺失，请重新开局' }
  }

  // 调 Embedding API 获取猜测词向量
  let guessVec = null
  try {
    guessVec = await getEmbedding(wordTrim)
  } catch (e) {
    return { error: `Embedding API 调用失败：${e.message}` }
  }

  if (!guessVec) {
    return { error: 'Embedding API 返回空向量，请检查配置' }
  }

  // 1v1 余弦相似度
  const similarity = cosineSimilarity(targetVec, guessVec)

  // 猜中判定：相似度极高（> 0.99）或严格等于目标词
  const won = (similarity > 0.99) || (wordTrim === game.target)

  return { similarity, won }
}

// ===== 云函数入口 =====
exports.main = async (event, context) => {
  const { gameId, word } = event
  if (!gameId || !word) return { error: 'invalid params' }

  const wordTrim = (word || '').trim()
  if (!wordTrim) return { error: 'empty word' }

  const result = await db.collection('games').doc(gameId).get().catch(() => null)
  if (!result) return { error: 'invalid gameId' }
  const game = result.data

  // 根据 similarityMode 字段自动识别模式
  const mode = game.similarityMode || 'vector'

  if (mode === 'embedding') {
    return await guessEmbedding(game, wordTrim)
  } else {
    return await guessVector(game, wordTrim)
  }
}
