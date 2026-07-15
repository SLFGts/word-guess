# 风格 Token 契约 — 猜词小程序（doodle 风）

> **单一事实源**。Figma Make 生成原型、Claude 生成小程序代码、真机验收 checklist 均引用本契约。
> 提取自 `miniprogram/app.wxss` 第 17–95 行。若 `app.wxss` 新增/修改 Token，**必须同步更新本契约**，否则工作流各环节会失配。

---

## 0. 基准

| 项 | 值 |
|---|---|
| 画板宽度 | **375px**（iPhone6） |
| 换算系数 | **1px = 2rpx**（`node scripts/px2rpx.mjs <文件> 2`） |
| 风格特征 | 暖橙 + 米色 + **黑色硬描边** + **无模糊硬阴影** + 大圆角 |

---

## 1. 颜色

### 基底色
| Token | 值 | 语义 |
|---|---|---|
| `--color-bg` | `#F5F0E1` | 暖米色背景 |
| `--color-card` | `#FFF8EE` | 奶油卡片底 |
| `--color-border` | `#3A3A3A` | 黑色描边 ★doodle 核心 |
| `--color-primary` | `#FFB347` | 暖橙强调（按钮/重点） |
| `--color-shadow` | `#3A3A3A` | 阴影色 |

### 文字色
| Token | 值 | 语义 |
|---|---|---|
| `--color-text` | `#3A3A3A` | 主文字 |
| `--color-text-sub` | `#8A8578` | 副文字 |
| `--color-text-dim` | `#6D6A61` | 深灰副文（rules-trigger 等） |

### 语义 / 状态色
| Token | 值 | 语义 |
|---|---|---|
| `--color-pink` | `#FF9EBB` | 柔粉 |
| `--color-green` | `#A8E6A3` | 薄荷绿 |
| `--color-blue` | `#A3C4F3` | 天蓝 |
| `--color-purple` | `#C9A8E8` | 淡紫 |
| `--color-green-deep` | `#75C875` | 高分绿（score-num / 胜率） |
| `--color-green-mid` | `#87CA87` | 中绿（result word-card-2） |
| `--color-mint` | `#D4F5D0` | 浅薄荷底（challenge / 普通模式底） |
| `--color-blue-deep` | `#6F9FE4` | 深天蓝（指标 / score 蓝） |
| `--color-link` | `#638CC8` | 链接蓝（section-link） |
| `--color-orange-deep` | `#F49C2A` | 深橙（result 标题） |
| `--color-orange-dark` | `#E38B1E` | 暗橙（praise 文字） |
| `--color-tag` | `#FFCF81` | 标签橙（game-count-tag） |
| `--color-hot` | `#FF9E40` | 高分热橙（.hot 状态） |
| `--color-danger` | `#AA5970` | 危险红（清除记录按钮） |
| `--color-bar-track` | `#E6E0D3` | 进度条轨道灰 |
| `--color-path-line` | `#D7CDBB` | 逼近路径虚线灰 |
| `--color-cream` | `#FFE8CC` | 浅奶油橙（普通模式底） |
| `--color-sky` | `#D0E4F7` | 浅天蓝（主题专场底） |
| `--color-disabled` | `#E8E0D0` | 禁用态底色 |

---

## 2. 间距

> **必须从 `--space-*` 取，禁止裸 rpx。**

| Token | rpx | (px) | 语义 |
|---|---|---|---|
| `--space-1` | 8rpx | 4px | 紧凑内间距 |
| `--space-2` | 16rpx | 8px | |
| `--space-3` | 24rpx | 12px | |
| `--space-4` | 28rpx | 14px | |
| `--space-5` | 34rpx | 17px | **卡片 padding 基准** |
| `--space-6` | 40rpx | 20px | |
| `--space-7` | 56rpx | 28px | |
| `--space-8` | 88rpx | 44px | 首页 padding-top |

---

## 3. 字号

| Token | rpx | (px) | 语义 |
|---|---|---|---|
| `--text-2xs` | 16rpx | 8px | |
| `--text-xs` | 18rpx | 9px | tag |
| `--text-sm` | 22rpx | 11px | |
| `--text-base` | 24rpx | 12px | desc |
| `--text-md` | 28rpx | 14px | **page 默认** |
| `--text-lg` | 30rpx | 15px | |
| `--text-xl` | 34rpx | 17px | |
| `--text-2xl` | 40rpx | 20px | title |
| `--text-3xl` | 50rpx | 25px | modal 标题 |
| `--text-4xl` | 60rpx | 30px | icon |
| `--text-5xl` | 84rpx | 42px | result 标题 |
| `--text-6xl` | 144rpx | 72px | logo |
| `--text-7xl` | 180rpx | 90px | **首页大标题** |

---

## 4. 圆角

| Token | rpx | (px) | 语义 |
|---|---|---|---|
| `--radius-xs` | 10rpx | 5px | tag / quit-btn |
| `--radius-sm` | 16rpx | 8px | score-bar-fill |
| `--radius-md` | 20rpx | 10px | mini-bar |
| `--radius-lg` | 26rpx | 13px | doodle-button |
| `--radius-xl` | 36rpx | 18px | doodle-card |
| `--radius-2xl` | 40rpx | 20px | modal-card |

---

## 5. 阴影

> **doodle 标志：硬阴影，禁止模糊**（`box-shadow` 的 blur-radius 恒为 0）。

| Token | 值 | (px) | 语义 |
|---|---|---|---|
| `--shadow-xs` | `4rpx 4rpx 0 var(--color-shadow)` | 2px | |
| `--shadow-sm` | `6rpx 6rpx 0 var(--color-shadow)` | 3px | |
| `--shadow-md` | `8rpx 8rpx 0 var(--color-shadow)` | 4px | |
| `--shadow-lg` | `12rpx 12rpx 0 var(--color-shadow)` | 6px | doodle-card |
| `--shadow-xl` | `16rpx 16rpx 0 var(--color-shadow)` | 8px | modal-card |

---

## 6. 描边

| Token | rpx | (px) | 语义 |
|---|---|---|---|
| `--border-w` | 6rpx | 3px | **全局标准** |
| `--border-w-thick` | 8rpx | 4px | 加粗 |

---

## 7. 行高

| Token | 值 | 语义 |
|---|---|---|
| `--leading-none` | 1 | |
| `--leading-tight` | 1.2 | |
| `--leading-snug` | 1.3 | |
| `--leading-normal` | 1.5 | page 默认（注意可能撑开 min-height，见规范坑位） |

---

## 8. 约束条款（验收用，可机检）

1. **间距 / 字号 / 圆角 / 阴影 / 描边** 必须用 Token 变量，**禁止裸 rpx 魔法数字**。
2. **颜色** 必须用 `--color-*`，**禁止裸 hex 进 wxss**。
3. **阴影** 必须为 `Xrpx Xrpx 0 ...` 硬阴影格式，**禁止模糊**（blur-radius ≠ 0 即违约）。
4. **描边** 粗细统一 `--border-w` / `--border-w-thick`，禁止自定义。
5. 画板 375px，**px→rpx 系数恒为 2**（`px2rpx.mjs 2`）。
6. **自定义组件必须设** `options: { styleIsolation: 'apply-shared' }`，否则全局样式不进组件（规范坑 4.8）。
7. 弹窗 `modal-bg` 用 fixed 且移到 `.page` 外层；`scroll-view` 阴影空间用子元素 `margin` 不用父 `padding`；`<button>` 加 `::after{display:none}`。

> 违反任一条 = 不予合入。Step 6 用 `scripts/check-tokens.mjs` 自动扫前 4 条。

---

## 9. 工作流引用方式

| 步骤 | 如何用本契约 |
|---|---|
| **Step 3 喂 Figma Make** | 把「第 0 节基准 + 第 1~6 节表格」复制进提示词，要求原型**画板 375px、用这些 px 值、硬阴影不模糊** |
| **Step 5 生成代码** | 每个 px 值映射到对应 Token 变量名（如 18px→`--radius-xl`），**不写裸 rpx** |
| **Step 6 真机验收** | checklist 逐条核对 + 跑 `check-tokens.mjs` 扫裸 rpx / 裸 hex / 模糊阴影 |
