// 小程序入口：初始化云开发 + 安全区计算
// 字体通过 app.wxss 中的 @font-face 加载（wx.loadFontFace 不支持本地路径）
App({
  globalData: {
    statusBarHeight: 20,
    safeTop: 20,
    safeBottom: 0,
    fontsLoaded: {}        // 字体加载状态：{ ZCOOL: true/false, PressStart: true/false }
  },

  /** 预加载单个字体 */
  _loadFont(family, url) {
    wx.loadFontFace({
      family,
      source: `url("${url}")`,
      success: () => {
        this.globalData.fontsLoaded[family] = true;
      },
      fail: () => {
        this.globalData.fontsLoaded[family] = false;
        console.log(`${family} 字体加载失败，使用系统默认字体`);
      }
    });
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 或以上以支持云开发');
      return;
    }
    wx.cloud.init({ env: 'cloud1-d3gr2aofwe81463b1', traceUser: true });

    // 获取系统信息，计算全局安全区
    try {
      const info = wx.getSystemInfoSync();
      this.globalData.statusBarHeight = info.statusBarHeight || 20;

      // 胶囊按钮位置（右上角 ··· ⊙）
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      // 顶部安全区 = 胶囊按钮底部 + 4px 间距，确保内容不超过胶囊
      const menuBottom = menu ? menu.bottom + 4 : this.globalData.statusBarHeight + 44;
      this.globalData.safeTop = Math.max(this.globalData.statusBarHeight, menuBottom);

      // 底部安全区：iPhone X 系列有底部横条
      this.globalData.safeBottom = info.safeAreaInsets ? info.safeAreaInsets.bottom : 0;
    } catch (e) { /* 取不到时用默认值 */ }

    // 全局预加载所有自定义字体（启动时加载，后续页面直接使用）
    this._loadFont('ZCOOL', 'https://fenger-bucket.oss-cn-beijing.aliyuncs.com/word_guess/fonts/ZCOOLKuaiLe-Regular.woff2');
    this._loadFont('PressStart', 'https://fenger-bucket.oss-cn-beijing.aliyuncs.com/word_guess/fonts/PressStart2P-Regular.woff2');
  }
});
