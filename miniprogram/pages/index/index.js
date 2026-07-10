// pages/index/index.js
// 首页：认知与决策，让玩家 3 秒内理解游戏并做出选择

Page({
  data: {
    // 模式选择卡片
    modes: [
      { icon: '️', title: '普通模式', text: '随机词库，自由猜词', color: '#FFE8CC', mode: 'normal' },
      { icon: '⭐', title: '每日挑战', text: '每天一题，和全世界比', color: '#D4F5D0', mode: 'daily', tag: 'TODAY' },
      { icon: '🎯', title: '主题专场', text: '成语/热词/影视分类', color: '#D0E4F7', mode: 'theme', tag: 'NEW' }
    ],

    // 最近一局战绩（蔡加尼克效应钩子）
    recentGame: null,

    // 规则弹窗
    rulesOpen: false,

    // 游戏规则
    rules: [
      { icon: '️', text: '输入任意中文词，系统返回相关度 0-100 分' },
      { icon: '💡', text: '分数越高越接近答案，100 分 = 猜中！' },
      { icon: '🎯', text: '可以用提示辅助，但每局每级只能用一次' }
    ]
  },

  onLoad() {
    this.loadRecentGame();
  },

  onShow() {
    // 每次显示时刷新最近战绩
    this.loadRecentGame();
  },

  /** 加载最近一局战绩 */
  loadRecentGame() {
    const history = wx.getStorageSync('gameHistory') || [];
    if (history.length > 0) {
      const last = history[0];
      this.setData({
        recentGame: {
          word: last.targetWord,
          count: last.guessCount,
          time: last.totalTime
        }
      });
    }
  },

  /** 快速开始游戏 */
  onQuickStart() {
    wx.navigateTo({
      url: '/pages/game/game?mode=normal'
    });
  },

  /** 选择模式开始游戏 */
  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode;
    wx.navigateTo({
      url: `/pages/game/game?mode=${mode}`
    });
  },

  /** 打开规则弹窗 */
  onOpenRules() {
    this.setData({ rulesOpen: true });
  },

  /** 关闭规则弹窗 */
  onCloseRules() {
    this.setData({ rulesOpen: false });
  },

  /** 跳转统计页 */
  onGoStats() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    });
  }
});
