# 项目说明 — 猜词小程序（word_guess）

## 项目概述
语义相似度猜词微信小程序。前端在 `miniprogram/`（原生 WXML/WXSS/JS），后端为 `cloudfunctions/`（云函数）。高保真原型在 `高保真原型设计/`（React+Vite+Tailwind）。

## ⚠️ UI 开发铁律（改任何样式前必读）

**修改/新增任何 UI 前，必须先读 [`UI_RESTORATION_SPEC.md`](./UI_RESTORATION_SPEC.md) 并照此执行。** 该规范是 UI 唯一基准，每次都必须参考。

核心三条，违反不予合入：

1. **换算基准锁死 `1px = 2rpx`**（iPhone6 屏宽 375px）。禁止手工试系数、禁止把原型 px 直接当 rpx。原型 px 值统一用 `node scripts/px2rpx.mjs <文件> 2` 批量转，不手算。
2. **新代码必须用设计 Token**（`app.wxss` 的 `page{}` 变量）：`--space-*` / `--text-*` / `--radius-*` / `--shadow-*` / `--color-*` / `--border-w`。**禁止写裸 `rpx` 魔法数字**。旧代码迁移时逐步替换。
3. **规避原生组件坑**（详见规范第 4 节）：
   - **自定义组件（Component）必须设 `options: { styleIsolation: 'apply-shared' }`**，否则 app.wxss 全局样式（.modal-bg/.doodle-button 等）不应用到组件内，弹窗会退化成 inline 追加而非覆盖弹窗（坑 4.8，高频！）
   - 弹窗组件（`modal-bg` 用 fixed）移到 `.page` 外层，别嵌在 `overflow:hidden` 的 `.page` 里
   - `scroll-view` 内子元素阴影空间用子元素 `margin`，不用父 `padding`；间距用 `margin-right` 不用 `gap`
   - `<button>` 加 `::after { display:none }` 去默认边框（全局已加）
   - 不支持 `<svg>`，曲线/图形用 `<canvas type="2d">` 绘制
   - `min-height` 可能被全局 `line-height:1.5` 撑开，给子元素显式设 `line-height` 或改 `height`+`box-sizing`

## 目录结构
- `miniprogram/` — 小程序源码（前端，**UI 改动主要在这里**）
  - `app.wxss` — 全局样式 + 设计 Token + 原子组件（doodle-card/button/modal-*）
  - `pages/` — index/game/result/stats 四个页面
  - `components/` — rules-modal / quit-modal / giveup-modal 弹窗组件
  - `assets/images/` — 图片资源（本地引用，**不要**用 CDN）
- `高保真原型设计/src/` — 原型（UI 还原的视觉基准，只读不改）
- `cloudfunctions/` — 云函数（后端，**改 UI 时不要动**）
- `scripts/px2rpx.mjs` — px→rpx 批量转换脚本
- `UI_RESTORATION_SPEC.md` — UI 还原规范（基准/Token/组件/坑位/checklist/工作流）

## 还原工作流
```
Figma 标注(375px画板) → px2rpx.mjs 批量转 → 套 Token → 组合原子组件 → 规避原生坑 → checklist 核对 → 真机预览
```

## 常用命令
```bash
# 原型 CSS 批量转 rpx（系数 2）
node scripts/px2rpx.mjs 高保真原型设计/src/index.css 2 > out.wxss

# 本地起后端调试（验证逻辑，勿改 UI 时用）
python scripts/serve_local.py
```

## 边界
- **改 UI 时不要动 `cloudfunctions/` 后端逻辑**——前端还原只碰 `miniprogram/` 的 wxml/wxss/wxss/json
- 原型 `高保真原型设计/` 是只读视觉基准，不在此目录改代码
