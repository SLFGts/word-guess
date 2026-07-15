// pages/stats/stats.js
// 统计页：展示游戏数据概览、每日挑战、成就徽章、历史记录

Page({
  data: {
    // 顶部安全区高度(px)：胶囊按钮底部 + 间距，custom 导航栏用
    safeTop: 20,

    // 游戏概览数据
    totalGames: 0,
    winRate: 0,
    avgGuesses: 0,
    avgTimeDisplay: '0:00',   // 平均用时（格式化字符串）

    // 每日挑战
    challengeDay: 7,
    challengeCompleted: false,

    // 成就徽章
    badges: [
      { icon: '🎮', name: '初出茅庐', unlocked: true },
      { icon: '⚡', name: '直觉型选手', unlocked: true },
      { icon: '🧠', name: '逻辑大师', unlocked: true },
      { icon: '📅', name: '每日达人', unlocked: false },
      { icon: '💡', name: '提示达人', unlocked: false },
      { icon: '📚', name: '词库探索者', unlocked: false }
    ],

    // 最近游戏记录
    recentGames: [],

    // 详情弹窗
    detailOpen: false,
    detailGame: null   // 当前查看的游戏详情对象
  },

  onLoad() {
    // 顶部安全区高度（navigationStyle:custom）
    this.setData({ safeTop: getApp().globalData.safeTop || 20 });
    this.loadStats();
  },

  /** 加载统计数据 */
  loadStats() {
    const history = wx.getStorageSync('gameHistory') || [];
    const stats = wx.getStorageSync('gameStats') || {};

    // 概览数据
    const totalGames = history.length;
    const totalWins = stats.totalWins || 0;
    const winRate = stats.winRate ? parseFloat(stats.winRate) : 0;
    const avgGuesses = stats.avgGuesses || 0;
    const avgTimeSeconds = stats.avgTimeSeconds || 0;
    const avgTimeDisplay = this._formatDuration(avgTimeSeconds);

    // 最近 10 条游戏记录
    const recentGames = history.slice(0, 10).map(g => ({
      word: g.targetWord,
      date: this.formatDate(g.date),
      count: g.guessCount,
      time: g.totalTime,
      won: g.won !== false,   // 默认 true（旧数据无 won 字段）
      hintCount: g.hintCount || 0,
      // 保存原始数据供弹窗使用
      _raw: g
    }));

    this.setData({
      totalGames, winRate, avgGuesses, avgTimeDisplay,
      recentGames
    });
  },

  /** 将秒数格式化为 "M:SS" 或 "H:MM:SS" */
  _formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  /** 点击游戏行 → 弹出详情 */
  onGameTap(e) {
    const idx = e.currentTarget.dataset.idx;
    const game = this.data.recentGames[idx];
    if (!game || !game._raw) return;

    const raw = game._raw;
    // 从 scoreHistory 重建猜测记录列表（包含分数）
    const guessRecords = (raw.scoreHistory || []).map((item, i) => ({
      order: i + 1,
      score: item.score || 0
    }));

    this.setData({
      detailOpen: true,
      detailGame: {
        word: raw.targetWord || '未知',
        won: raw.won !== false,
        date: this.formatDate(raw.date),
        count: raw.guessCount || 0,
        time: raw.totalTime || '0:00',
        hintUsed: raw.hintUsed || '0/3',
        hints: raw.hints || [],          // [{type, text}]
        guessRecords                     // [{order, score}]
      }
    });
  },

  /** 关闭详情弹窗 */
  onCloseDetail() {
    this.setData({ detailOpen: false, detailGame: null });
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

  /** 查看全部（徽章/历史列表）：对应列表页待开发，暂提示 */
  onViewAll() {
    wx.showToast({ title: '功能开发中，敬请期待', icon: 'none' });
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
