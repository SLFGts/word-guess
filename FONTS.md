# 字体部署说明

## 当前状态

字体文件已复制到 `miniprogram/assets/fonts/` 目录：
- `ZCOOLKuaiLe-Regular.woff2` - 圆润中文字体（站酷快乐体）
- `PressStart2P-Regular.woff2` - 像素英文字体

## 部署步骤

### 方案 A：上传到云存储（推荐）

1. 打开微信开发者工具，进入「云开发」控制台
2. 点击「存储」标签
3. 创建 `fonts` 文件夹
4. 上传两个 woff2 文件
5. 获取文件的 fileID（格式：`cloud://env-id.xxx/fonts/xxx.woff2`）
6. 修改 `app.js` 中的 `source` URL 为 fileID：

```javascript
wx.loadFontFace({
  family: 'ZCOOL',
  source: 'url("cloud://your-env-id.xxx/fonts/ZCOOLKuaiLe-Regular.woff2")',
  // ...
});
```

### 方案 B：使用外部 CDN

1. 将字体文件上传到你的 CDN（如阿里云 OSS、腾讯云 COS）
2. 获取公开访问 URL
3. 修改 `app.js` 中的 `source` URL

### 方案 C：本地加载（测试用）

小程序不支持直接加载包内字体文件作为 `wx.loadFontFace` 的 source，
必须使用网络 URL 或云存储 fileID。

## 注意事项

- 字体文件较大（约 5-10MB），建议压缩后上传
- 首次加载需要网络，建议在 `onLaunch` 中预加载
- 如果加载失败，会自动降级到系统默认字体
- 真机调试时需要确保网络可达

## 验证方法

在微信开发者工具中：
1. 打开「调试器」→「Console」
2. 查看是否有 "ZCOOL 字体加载成功" 和 "PressStart 字体加载成功" 日志
3. 如果有 "加载失败" 警告，检查 URL 是否正确
