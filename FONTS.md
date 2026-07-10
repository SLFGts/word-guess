# 字体部署说明（最终方案）

## 当前状态

✅ 字体已通过 `@font-face` + jsdelivr CDN 成功加载

**字体文件**：
- `ZCOOLKuaiLe-Regular.woff2` - 圆润中文字体（站酷快乐体，3.1MB）
- `PressStart2P-Regular.woff2` - 像素英文字体（115KB）

**CDN 链接**：
```
https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2
https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/PressStart2P-Regular.woff2
```

---

## 加载方案

### 最终方案：wxss @font-face + HTTPS CDN

```css
/* app.wxss */
@font-face {
  font-family: "ZCOOL";
  src: url("https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2");
}

@font-face {
  font-family: "PressStart";
  src: url("https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/PressStart2P-Regular.woff2");
}
```

**为什么不用 wx.loadFontFace？**
- ❌ 不支持本地路径（如 `url("/assets/fonts/xxx.woff2")`）
- ❌ 云存储 CDN 权限问题（`STORAGE_EXCEED_AUTHORITY`）
- ✅ `@font-face` 支持 HTTPS 链接，小程序自动加载

---

## 字体文件存储

### 方案 1：GitHub + jsdelivr CDN（当前方案）

```
字体文件位置：miniprogram/assets/fonts/
                ↓
          推送到 GitHub
                ↓
    jsdelivr CDN 自动加速
                ↓
        https://cdn.jsdelivr.net/gh/...
```

**优势**：
- ✅ 免费（GitHub 无限存储，jsdelivr 免费 CDN）
- ✅ 无需配置云存储权限
- ✅ 代码和字体同一仓库，版本管理方便

**劣势**：
- ⚠️ `ERR_CACHE_MISS` 警告（jsdelivr 缓存策略，不影响功能）
- ⚠️ jsdelivr 在中国大陆偶尔不稳定

### 方案 2：微信云存储（备选）

```
字体文件位置：云存储 fonts/ 文件夹
                ↓
          获取临时 HTTPS URL
                ↓
        wx.loadFontFace({ source: url })
```

**问题**：
- ❌ 需要修改云存储权限规则（付费功能）
- ❌ `wx.loadFontFace` 不支持本地路径

**结论**：不推荐，除非 jsdelivr 在国内完全不可用。

---

## 已知问题

### ERR_CACHE_MISS 警告

```
[渲染层网络层错误] Failed to load font https://cdn.jsdelivr.net/gh/...
net::ERR_CACHE_MISS
```

**原因**：jsdelivr CDN 首次请求时缓存未命中

**影响**：仅日志警告，字体仍正常加载和使用

**解决**：忽略（无法从代码侧消除）

---

## 验证方法

1. 编译小程序
2. 查看 Console → 应无字体相关错误
3. 检查页面 → "猜词" 标题应显示圆润字体
4. 真机预览 → 字体效果更佳

---

## 备选 CDN

如果 jsdelivr 在国内不稳定，可尝试：

```css
/* GitHub raw 直链（慢但稳定） */
src: url("https://raw.githubusercontent.com/SLFGts/word-guess/main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2");

/* ghproxy 加速 */
src: url("https://ghproxy.com/https://raw.githubusercontent.com/SLFGts/word-guess/main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2");
```

---

## 字体使用

```css
/* 中文圆润字体 */
font-family: "ZCOOL", "PingFang SC", "Microsoft YaHei", sans-serif;

/* 像素字体（数字/英文） */
font-family: "PressStart", "Courier New", monospace;
```

---

**文档最后更新**：2026-07-10
