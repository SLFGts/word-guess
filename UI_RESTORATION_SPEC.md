# 微信小程序 UI 还原规范

> 本规范是本项目所有 UI 编写的**唯一基准**。新增页面、还原 Figma 原型、修改样式前，**必须先读本规范**并照此执行。违反规范的 PR 不予合入。

原型来源：`高保真原型设计/`（React + Tailwind + px）。目标平台：微信小程序（WXML + WXSS + rpx）。

---

## 1. 设计稿基准（铁律，禁止违背）

微信规定 **`750rpx = 屏幕宽度`**。为彻底消除换算歧义，本项目锁定基准如下：

| 项 | 值 | 说明 |
|---|---|---|
| 换算系数 | **`1px = 2rpx`** | 基于 iPhone 6 屏宽 375px，即微信官方 rpx 说明的标准基准 |
| Figma 画板宽度 | **375px** | = 设备逻辑宽度，`1px` 直接对应 `2rpx` |
| 字号/间距/圆角/阴影 | **一律 ×2** | `17px → 34rpx`、`5px → 10rpx` |

**禁止行为：**
- ❌ 手工算系数、在不同元素上试不同系数（`2x`/`1.744`/`1:1` 这种反复试错）
- ❌ 直接把原型 `px` 当 `rpx` 用（值会偏小一半）
- ❌ 在非 375px 画板上设计（如本项目原型原画布 430px，已统一按 2x 标准对齐）

**如果原型画板不是 375px：** 先在 Figma 把画板改成 375px 重出；或用 `scripts/px2rpx.mjs` 按系数 2 批量转，**不要手工换算**。

---

## 2. 设计 Token（必用，禁止裸值）

所有尺寸值统一引用 `app.wxss` 中 `page{}` 定义的 CSS 变量。**新代码禁止写裸 `rpx` 魔法数字**；旧代码在迁移时逐步替换。

### 颜色
`--color-bg` `--color-card` `--color-border` `--color-primary` `--color-pink` `--color-green` `--color-blue` `--color-purple` `--color-text` `--color-text-sub` `--color-text-dim` `--color-shadow`

**扩展色**（原型用色按语义补充，2026-07-11 迁移硬编码 hex 时新增）：
`--color-green-deep`(#75C875 高分绿) `--color-green-mid`(#87CA87 中绿) `--color-mint`(#D4F5D0 浅薄荷) `--color-blue-deep`(#6F9FE4 深天蓝) `--color-link`(#638CC8 链接蓝) `--color-orange-deep`(#F49C2A 深橙) `--color-orange-dark`(#E38B1E 暗橙) `--color-tag`(#FFCF81 标签橙) `--color-hot`(#FF9E40 热橙) `--color-danger`(#AA5970 危险红) `--color-bar-track`(#E6E0D3 轨道灰) `--color-path-line`(#D7CDBB 虚线灰) `--color-cream`(#FFE8CC 浅奶油) `--color-sky`(#D0E4F7 浅天蓝) `--color-disabled`(#E8E0D0 禁用底)

### 间距阶梯
`--space-1`(8rpx) `--space-2`(16rpx) `--space-3`(24rpx) `--space-4`(28rpx) `--space-5`(34rpx,卡片padding) `--space-6`(40rpx) `--space-7`(56rpx) `--space-8`(88rpx)

> 注：原型间距含 9/13/17/19px 等值（→18/26/34/38rpx），不在上述阶梯。此类精确值保留裸 rpx 并注释 `原型 Npx ×2`，不强转最近 token（避免视觉偏移），后续按需扩充阶梯。

### 字号阶梯
`--text-2xs`(16rpx) `--text-xs`(18rpx,tag) `--text-sm`(22rpx) `--text-base`(24rpx,desc) `--text-md`(28rpx,默认) `--text-lg`(30rpx) `--text-xl`(34rpx) `--text-2xl`(40rpx,title) `--text-3xl`(50rpx,modal标题) `--text-4xl`(60rpx,icon) `--text-5xl`(84rpx) `--text-6xl`(144rpx,logo) `--text-7xl`(180rpx,首页大标题)

### 圆角阶梯
`--radius-xs`(10rpx) `--radius-sm`(16rpx) `--radius-md`(20rpx) `--radius-lg`(26rpx,button) `--radius-xl`(36rpx,card) `--radius-2xl`(40rpx,modal)

### 阴影阶梯（涂鸦风：纯偏移、无模糊、硬边）
`--shadow-xs`(4rpx) `--shadow-sm`(6rpx) `--shadow-md`(8rpx) `--shadow-lg`(12rpx,card) `--shadow-xl`(16rpx,modal)

### 边框 / 行高
`--border-w`(6rpx,标准) `--border-w-thick`(8rpx) · `--leading-none`(1) `--leading-tight`(1.2) `--leading-snug`(1.3) `--leading-normal`(1.5)

> 用法：`padding: var(--space-5); box-shadow: var(--shadow-lg); font-size: var(--text-2xl);`

---

## 3. 原子组件库（优先复用，禁止重写）

已抽取的全局组件（定义在 `app.wxss`），新页面优先组合，不要再造同类样式：

| 组件类 | 用途 | 关键样式 |
|---|---|---|
| `.doodle-card` | 卡片容器 | 奶油底 + 6rpx 黑边 + 36rpx 圆角 + 12rpx 硬阴影 |
| `.doodle-button` | 涂鸦按钮 | 透明默认底，由具体按钮加背景色；按压位移 |
| `.doodle-button--disabled` | 禁用态 | opacity 0.4 + 浅灰底 |
| `.modal-bg` / `.modal-card` | 弹窗遮罩+卡片 | 固定居中，自带出入场动画 |
| `.nav` / `.nav-back` | 自定义导航栏 | 返回箭头 |
| `.wave` | 波浪装饰 | 粉色紧排字符 |
| `.star` | 旋转装饰星 | 绝对定位 + twirl 动画 |
| `.pixel` | 像素字体 | PressStart，字间距 -2rpx |

待补充原子化：`mode-card`、`guess-item`、`badge`、`game-row`（目前仍是页面内样式，后续抽成自定义组件）。

---

## 4. 原生组件坑位表（踩过必记，违者返工）

微信小程序原生组件与标准 CSS 行为不一致的高频坑，**编写时必须主动规避**：

### 4.1 scroll-view 的 padding 不渲染子元素阴影
- **现象**：`scroll-view` 设 `padding` 想给子卡片阴影留空间，但子元素 `box-shadow` 落到 padding 区域会被裁掉。
- **正解**：阴影空间改用**子元素的 `margin`**（margin 在 scroll-view 的 content 区内，阴影正常显示）。
  ```css
  /* ❌ 错 */ .mode-scroll { padding-bottom: 28rpx; }
  /* ✅ 对 */ .mode-card { margin-bottom: 20rpx; }
  ```

### 4.2 scroll-view 的 gap 不稳定
- **现象**：`scroll-view` + `enable-flex` + `gap` 在部分基础库不生效，卡片紧贴，相邻卡片背景盖住阴影。
- **正解**：用子元素 `margin-right` 代替 `gap`。

### 4.3 button 的 ::after 默认带边框
- **现象**：`<button>` 默认 `::after` 伪元素有一条边框线，`border:0` 去不掉。
- **正解**：显式 `button::after { display: none; }`，或在按钮类上加 `.xxx::after { display:none }`。

### 4.9 button 的 margin:auto 在 flex 容器内导致居中（UA 级样式，CSS 覆盖不了）
- **现象**：`<button>` 在 flex 容器内被强制居中，`justify-content` 失效，`margin: 0` 甚至 `!important` 都盖不住。
- **根因**：微信基础库给 button 注入了 UA 级 `margin: auto`，优先级高于页面/全局样式，普通 CSS 无法覆盖。
- **正解**：**纯 `bindtap` 点击元素（无 `open-type`/`form-type`）统一用 `<view>`**，不要用 `<button>`。`<view>` + `bindtap` 与 `<button>` + `bindtap` 行为完全等价，且无默认样式干扰。
- **适用范围**：所有不需要平台能力（分享/客服/登录/表单提交）的可点击元素。
- **例外**：需要 `open-type="share/contact/getUserInfo"` 或 `form-type="submit/reset"` 时仍用 `<button>`。
- **本项目已全局修正**：所有纯 bindtap 元素已改为 `<view>`，仅保留语义化链接用 `<navigator>`。

### 4.4 position:fixed 在 overflow:hidden / transform 父级失效
- **现象**：弹窗组件（`modal-bg` 用 fixed）放在 `.page` 内，`.page` 有 `overflow:hidden` + `animation`（含 `transform`），导致 fixed 被裁剪或变成相对定位，弹窗不显示/被裁。
- **正解**：**弹窗组件移到 `.page` 外层**，作为页面根的直接子节点，不要嵌在 `.page` 里。

### 4.5 min-height 被 page 全局 line-height:1.5 撑开
- **现象**：`page { line-height: 1.5 }` 让文字元素行高放大，内容总高超过 `min-height`，导致 `min-height` 失效（被内容撑大）。
- **正解**：给内容元素显式设较小 `line-height`（`1`/`1.2`/`1.3`），或改用固定 `height` + `box-sizing:border-box` + `overflow:hidden`。

### 4.6 SVG 标签不支持
- **现象**：WXML 直接写 `<svg>/<path>/<circle>` 不渲染。
- **正解**：用 `<canvas type="2d">` + `getContext('2d')` 绘制（见 `pages/result/result.js` 的 `drawScoreChart`）。

### 4.7 字体 letter-spacing 需手动翻倍
- 原型 `letter-spacing:-1px` → `-2rpx`，`.pixel` 类已统一。

### 4.8 自定义组件默认样式隔离，app.wxss 全局样式不应用 ⚠️（高频坑）
- **现象**：自定义组件（`Component`）默认 `styleIsolation: isolated`，**app.wxss 的全局类（`.modal-bg`/`.modal-card`/`.doodle-button` 等）不会应用到组件内部**。组件内 `.modal-bg` 无 `position:fixed`，弹窗退化成普通 view，内容 inline 追加在页面下方，无遮罩、无居中、无 fixed——表现就是"点规则按钮后规则内容追加在下方"而非弹窗。
- **官方原文**：*"isolated 表示启用样式隔离……除继承样式外，app.wxss 中的样式、组件所在页面的样式对自定义组件无效（除非更改组件样式隔离选项）"*。默认值即 isolated。
- **正解**：在 Component 的 `options` 里设 `styleIsolation: 'apply-shared'`（等价旧 `addGlobalClass: true`），让 app.wxss 全局样式应用到组件：
  ```js
  Component({
    options: { styleIsolation: 'apply-shared' },
    properties: { /* ... */ },
    methods: { /* ... */ }
  })
  ```
  也可在组件 JSON 里设（基础库 2.10.1+）：`{ "styleIsolation": "apply-shared" }`
- **本项目已修复**：`rules-modal`/`quit-modal`/`giveup-modal` 均加了 `options.styleIsolation: 'apply-shared'`。**新建任何用到 app.wxss 全局类的自定义组件必须照此设置**，否则全局样式失效。

---

## 5. 还原 Checklist（每个组件还原完逐项核对）

- [ ] **尺寸**：宽高、min-width/height 用 `box-sizing:border-box`，值 = 原型 px ×2
- [ ] **间距**：padding/margin/gap 引用 `--space-*`，卡片阴影空间用 margin 不用父 padding
- [ ] **圆角**：引用 `--radius-*`
- [ ] **阴影**：涂鸦风纯偏移无模糊，引用 `--shadow-*`；scroll-view 内用子元素 margin 留空
- [ ] **边框**：6rpx 标准，引用 `--border-w`
- [ ] **字号**：引用 `--text-*`，含 line-height 显式设定（防被全局 1.5 撑开）
- [ ] **字重**：`font-weight` 与原型 `<b>`/`<strong>` 一致
- [ ] **颜色**：引用 `--color-*`，禁硬编码
- [ ] **对齐**：flex/grid 对齐方式与原型一致
- [ ] **交互态**：`:active` 位移阴影（`.doodle-button` 已统一）
- [ ] **动效**：引用全局 keyframes（`page-in`/`modal-up`/`slide-in`/`twirl`/`pulse`）
- [ ] **原生坑**：fixed 弹窗在 .page 外；scroll-view 用 margin 不用 padding/gap；button 去 ::after；无 SVG；**纯 bindtap 元素用 view 不用 button**（坑 4.9）
- [ ] **真机核对**：开发者工具 + 真机预览，截图叠加对比原型

---

## 6. 标准工作流

```
Figma 标注(375px画板)
   ↓
scripts/px2rpx.mjs 批量转 px→rpx(系数2)
   ↓
套用 Token（var(--space-*) / --text-* / --radius-* / --shadow-*）
   ↓
组合原子组件（doodle-card / doodle-button / modal-*）
   ↓
原生坑规避（弹窗外置 / margin代gap / button去::after / canvas代SVG）
   ↓
Checklist 逐项核对
   ↓
真机预览 + 截图对比原型
```

---

## 7. 版本与维护

- 首版：2026-07-11，基于首页 mode-card 多轮试错沉淀
- 新增 token / 组件 / 原生坑时，**同步更新本规范**，并在提交信息注明
- 规范与代码冲突时，以规范为准；规范需变更时，先改规范再改代码
