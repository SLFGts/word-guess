// 本地单局游戏状态（P0 单人模式）
// P1 多人时预留同步接口位（store 可改为与服务端同步，不动调用方）
const store = {
  gameId: null,
  len: null,            // 目标词字数（开局返回）
  guesses: [],          // [{word, score, order}] 猜测历史
  orderCounter: 0,      // 有效猜测序号（重复词不消耗）
  maxScore: -1,         // 当前局最高分（新高提示+最高分高亮）
  hints: { t1: null, t2: null, qa: null },  // 已解锁提示
}

// 开新局重置状态
function reset(gameId, len) {
  store.gameId = gameId
  store.len = len
  store.guesses = []
  store.orderCounter = 0
  store.maxScore = -1
  store.hints = { t1: null, t2: null, qa: null }
}

// 记一次猜测（去重：重复词不消耗序号），返回是否新增
function addGuess(word, score) {
  if (store.guesses.find(g => g.word === word)) return false
  store.orderCounter++
  store.guesses.push({ word, score, order: store.orderCounter })
  if (score > store.maxScore) store.maxScore = score
  return true
}

module.exports = { store, reset, addGuess }
