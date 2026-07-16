// cloudfunctions/getAnswer/index.js
// 调试用：根据 gameId 返回目标词答案

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { gameId } = event
  if (!gameId) return { error: 'invalid gameId' }

  const result = await db.collection('games').doc(gameId).get().catch(() => null)
  if (!result) return { error: 'game not found' }
  const game = result.data
  return {
    target: game.target,
    similarityMode: game.similarityMode || 'vector'
  }
}
