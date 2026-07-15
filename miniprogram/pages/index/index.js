// pages/index/index.js
// 卡通刺猬风格首页：简洁清爽

Page({
  data: {
    rulesOpen: false,
  },

  /** 快速开始：普通模式 */
  onQuickStart() {
    wx.navigateTo({ url: '/pages/game/game?mode=normal' });
  },

  /** 查看历史战绩 */
  onGoStats() {
    wx.navigateTo({ url: '/pages/stats/stats' });
  },

  /** 打开规则弹窗 */
  onOpenRules() {
    this.setData({ rulesOpen: true });
  },

  /** 关闭规则弹窗 */
  onCloseRules() {
    this.setData({ rulesOpen: false });
  }
});
