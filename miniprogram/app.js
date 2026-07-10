// 小程序入口：初始化云开发 + 加载字体
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 或以上以支持云开发');
      return;
    }
    wx.cloud.init({ env: 'cloud1-d3gr2aofwe81463b1', traceUser: true });

    // 加载自定义字体
    this.loadFonts();
  },

  /** 加载像素字体和圆润中文字体 */
  loadFonts() {
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

    // 加载字体
    fontFiles.forEach(font => {
      wx.loadFontFace({
        family: font.family,
        source: `url("${font.url}")`,
        success: () => console.log(`${font.family} 字体加载成功`),
        fail: (err) => console.warn(`${font.family} 字体加载失败:`, err)
      });
    });
  }
});
