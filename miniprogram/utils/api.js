// 云函数调用封装（newGame/guess/getHint）
// 兼容两种模式返回格式：
// Mode A (vector): { score: 78.8, won: false }
// Mode B (embedding): { similarity: 0.7234, won: false }

/** 通用云函数调用 */
function callCloud(name, data, timeout) {
  const config = {};
  if (timeout) config.timeout = timeout;
  return wx.cloud.callFunction({ name, data, config }).then(res => {
    const result = res.result;
    if (result && result.error) {
      throw new Error(result.error);
    }
    return result;
  });
}

module.exports = {
  // 开局：返回 { gameId, len, similarityMode }
  // Mode A 还返回 wordCount，Mode B 不返回
  newGame: (mode) => callCloud('newGame', { mode }, 60000),

  // 猜词：返回两种格式之一
  // Mode A: { score: 78.8, won: false } 或 { score: null, message: '词库里没有这个词' }
  // Mode B: { similarity: 0.7234, won: false } 或 { error: '...' }
  guess: (gameId, word) => callCloud('guess', { gameId, word }),

  // 提示：level1=T1描述/2=T2锚点 返回 {hint}；level3=提问裁判 返回 {answer}
  getHint: (gameId, level, question) => callCloud('getHint', { gameId, level, question }),

  // 调试用：获取目标词答案
  getAnswer: (gameId) => callCloud('getAnswer', { gameId }),
};
