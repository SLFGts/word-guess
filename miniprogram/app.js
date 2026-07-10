// 小程序入口：初始化云开发
// 字体通过 app.wxss 中的 @font-face 加载（wx.loadFontFace 不支持本地路径）
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 或以上以支持云开发');
      return;
    }
    wx.cloud.init({ env: 'cloud1-d3gr2aofwe81463b1', traceUser: true });
  }
});
