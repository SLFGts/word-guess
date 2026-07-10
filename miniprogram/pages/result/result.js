// pages/result/result.js
// 结算页：展示猜中后的成绩和庆祝动画

Page({
  data: {
    // 游戏成绩数据（从游戏页传入）
    targetWord: '苹果',        // 目标词
    guessCount: 8,             // 猜测次数
    maxScore: 100,             // 最高相关度
    totalTime: '2:30',         // 总用时
    hintUsed: '1/3',           // 提示使用
    praise: '⭐ 逻辑大师！',    // 趣味评价
    scoreHistory: [            // 分数曲线数据
      { x: 5, y: 86, score: 14 },
      { x: 55, y: 72, score: 28 },
      { x: 112, y: 67, score: 33 },
      { x: 170, y: 42, score: 58 },
      { x: 230, y: 34, score: 66 },
      { x: 295, y: 10, score: 90 }
    ]
  },

  onLoad(options) {
    // 从游戏页接收数据
    if (options.data) {
      const gameData = JSON.parse(decodeURIComponent(options.data));
      this.setData({
        targetWord: gameData.targetWord || '苹果',
        guessCount: gameData.guessCount || 8,
        maxScore: gameData.maxScore || 100,
        totalTime: gameData.totalTime || '2:30',
        hintUsed: gameData.hintUsed || '1/3',
        praise: this.getPraise(gameData.guessCount || 8)
      });
    }
  },

  /** 根据猜测次数返回趣味评价 */
  getPraise(count) {
    if (count <= 3) return '⚡ 直觉型选手！';
    if (count <= 6) return '⭐ 逻辑大师！';
    if (count <= 10) return ' 不错不错~';
    return ' 坚持就是胜利！';
  },

  /** 再来一局：重置游戏 */
  onPlayAgain() {
    wx.redirectTo({
      url: '/pages/game/game'
    });
  },

  /** 返回首页 */
  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
