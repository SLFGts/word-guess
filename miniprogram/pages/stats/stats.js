// pages/stats/stats.js
// 统计页：展示游戏数据概览、每日挑战、成就徽章、历史记录

Page({
  data: {
    // 游戏概览数据
    totalGames: 36,
    winRate: 86,
    avgGuesses: 7.2,
    streakDays: 12,

    // 每日挑战
    challengeDay: 7,
    challengeCompleted: false,

    // 成就徽章
    badges: [
      { icon: '', name: '初出茅庐', unlocked: true },
      { icon: '⚡', name: '直觉型选手', unlocked: true },
      { icon: '🧠', name: '逻辑大师', unlocked: true },
      { icon: '📅', name: '每日达人', unlocked: false },
      { icon: '💡', name: '提示达人', unlocked: false },
      { icon: '📚', name: '词库探索者', unlocked: false }
    ],

    // 最近游戏记录
    recentGames: [
      { word: '苹果', date: '今天', count: 8, time: '2:30' },
      { word: '海洋', date: '昨天', count: 6, time: '1:48' },
      { word: '月亮', date: '06/08', count: 10, time: '3:12' }
    ]
  },

  onLoad() {
    // TODO: 从本地存储加载真实数据
    this.loadStats();
  },

  /** 加载统计数据 */
  loadStats() {
    const history = wx.getStorageSync('gameHistory') || [];
    const stats = wx.getStorageSync('gameStats') || {};

    if (history.length > 0) {
      this.setData({
        totalGames: history.length,
        recentGames: history.slice(0, 10).map(g => ({
          word: g.targetWord,
          date: this.formatDate(g.date),
          count: g.guessCount,
          time: g.totalTime
        }))
      });
    }

    if (stats.winRate) {
      this.setData({
        winRate: Math.round(stats.winRate),
        avgGuesses: stats.avgGuesses || 0,
        streakDays: stats.streakDays || 0
      });
    }
  },

  /** 格式化日期 */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return '今天';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨天';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  /** 返回首页 */
  onGoBack() {
    wx.navigateBack();
  },

  /** 去挑战每日挑战 */
  onChallenge() {
    wx.navigateTo({
      url: '/pages/game/game?mode=daily'
    });
  },

  /** 清除记录 */
  onClearHistory() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有游戏记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('gameHistory');
          wx.removeStorageSync('gameStats');
          wx.showToast({ title: '已清除', icon: 'success' });
          this.loadStats();
        }
      }
    });
  }
});
