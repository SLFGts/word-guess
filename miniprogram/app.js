// 小程序入口：初始化云开发 + 加载字体
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3 或以上以支持云开发');
      return;
    }
    wx.cloud.init({ env: 'cloud1-d3gr2aofwe81463b1', traceUser: true });

    // 加载自定义字体（需先获取临时 HTTPS URL）
    this.loadFonts();
  },

  /** 加载像素字体和圆润中文字体 */
  loadFonts() {
    // 字体文件的云存储 FileID
    const fontFiles = [
      {
        family: 'ZCOOL',
        fileID: 'cloud://cloud1-d3gr2aofwe81463b1.636c-cloud1-d3gr2aofwe81463b1-1310505335/fonts/ZCOOLKuaiLe-Regular.woff2'
      },
      {
        family: 'PressStart',
        fileID: 'cloud://cloud1-d3gr2aofwe81463b1.636c-cloud1-d3gr2aofwe81463b1-1310505335/fonts/PressStart2P-Regular.woff2'
      }
    ];

    // 先获取临时 HTTPS URL（wx.loadFontFace 不支持 cloud:// 协议）
    wx.cloud.getTempFileURL({
      fileList: fontFiles.map(f => f.fileID),
      success: (res) => {
        res.fileList.forEach((file, index) => {
          if (file.code === 0 && file.tempFileURL) {
            wx.loadFontFace({
              family: fontFiles[index].family,
              source: `url("${file.tempFileURL}")`,
              success: () => console.log(`${fontFiles[index].family} 字体加载成功`),
              fail: (err) => console.warn(`${fontFiles[index].family} 字体加载失败:`, err)
            });
          } else {
            console.warn(`获取字体临时URL失败:`, file);
          }
        });
      },
      fail: (err) => {
        console.error('获取字体临时URL失败:', err);
      }
    });
  }
});
