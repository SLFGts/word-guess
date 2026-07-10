// 小程序入口：初始化云开发 + 加载字体
App({
  // 字体加载完成标志
  _fontsLoaded: false,
  _fontResolve: null,
  _fontPromise: null,

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 或以上以支持云开发');
      return;
    }
    wx.cloud.init({ env: 'cloud1-d3gr2aofwe81463b1', traceUser: true });

    // 加载自定义字体（返回 Promise）
    this._fontPromise = this.loadFonts();
    this._fontPromise.then(() => {
      this._fontsLoaded = true;
    });
  },

  /** 加载像素字体和圆润中文字体 */
  loadFonts() {
    return new Promise((resolve) => {
      // 字体文件的 CDN URL（GitHub + jsdelivr）
      const fontFiles = [
        {
          family: 'ZCOOL',
          url: 'https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2'
        },
        {
          family: 'PressStart',
          url: 'https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/PressStart2P-Regular.woff2'
        }
      ];

      let loaded = 0;
      const total = fontFiles.length;

      const onDone = () => {
        loaded++;
        if (loaded === total) resolve();
      };

      // 加载字体
      fontFiles.forEach(font => {
        wx.loadFontFace({
          family: font.family,
          source: `url("${font.url}")`,
          success: () => {
            console.log(`${font.family} 字体加载成功`);
            onDone();
          },
          fail: (err) => {
            console.warn(`${font.family} 字体加载失败:`, err);
            onDone();  // 失败也计数，避免阻塞
          }
        });
      });
    });
  },

  /** 获取字体加载 Promise（供页面 await） */
  getFontPromise() {
    if (this._fontsLoaded) {
      return Promise.resolve();  // 已加载，立即 resolve
    }
    return this._fontPromise || Promise.resolve();
  }
});
