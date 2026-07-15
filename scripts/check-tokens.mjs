#!/usr/bin/env node
// DESIGN_TOKEN_CONTRACT.md 验收脚本
// 扫描 miniprogram/ 下所有 wxss/wxml 文件，检查契约约束条款 1-4 条

import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MINI_ROOT = join(__dirname, '..', 'miniprogram');

// Token 变量名列表（来自 app.wxss page{}）
const TOKEN_VARS = [
  '--color-bg', '--color-card', '--color-border', '--color-primary',
  '--color-pink', '--color-green', '--color-blue', '--color-purple',
  '--color-text', '--color-text-sub', '--color-text-dim', '--color-shadow',
  '--color-green-deep', '--color-green-mid', '--color-mint',
  '--color-blue-deep', '--color-link', '--color-orange-deep', '--color-orange-dark',
  '--color-tag', '--color-hot', '--color-danger', '--color-bar-track',
  '--color-path-line', '--color-cream', '--color-sky', '--color-disabled',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5',
  '--space-6', '--space-7', '--space-8',
  '--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-md',
  '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl',
  '--text-5xl', '--text-6xl', '--text-7xl',
  '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl',
  '--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl',
  '--border-w', '--border-w-thick',
  '--leading-none', '--leading-tight', '--leading-snug', '--leading-normal',
];

// 收集所有 wxss 文件
function collectWxss(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) collectWxss(full, files);
    else if (extname(full) === '.wxss') files.push(full);
  }
  return files;
}

// 判断是否是 app.wxss（Token 定义文件，豁免检查）
function isAppWxss(f) { return f.endsWith(join('miniprogram', 'app.wxss')); }

// 契约约束条款 1：间距/字号/圆角/阴影/描边必须用 Token，禁止裸 rpx 魔法数字
//   允许：var(--space-*)、var(--text-*)、var(--radius-*)、var(--shadow-*)、var(--border-w)
//   允许：app.wxss page{} 里的 Token 定义行
//   禁止：裸 rpx（如 24rpx、36rpx）出现在业务 wxss 里
function check1_rawRpx(files) {
  const violations = [];
  const rpxRegex = /\b\d+rpx\b/g;
  // 允许出现在 Token 定义行（如 --space-5: 34rpx;）
  const tokenDefRegex = /^\s*--(?:space|text|radius|shadow|border-w|leading)/;

  for (const f of files) {
    if (isAppWxss(f)) continue; // app.wxss 是 Token 定义文件，豁免
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // 跳过注释行
      if (line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
      // 跳过 Token 定义行（在业务文件里也可能有局部变量，但本契约暂不禁止）
      if (tokenDefRegex.test(line)) return;
      // 跳过含 var( 的行（已走 Token）
      if (line.includes('var(')) return;

      const matches = line.match(rpxRegex);
      if (matches) {
        // 过滤掉 box-shadow 里的 rpx（如 box-shadow: 12rpx 12rpx 0 ...）
        // 但 shadow 也应该用 var(--shadow-*)，所以这里也报
        for (const m of matches) {
          // 允许某些已知的例外：
          // - line-height 1/1.2/1.3 不是 rpx
          // - 0rpx 无意义
          if (m === '0rpx') return;
          violations.push({ file: f, line: i + 1, col: line.indexOf(m), value: m, content: line.trim() });
        }
      }
    });
  }
  return violations;
}

// 契约约束条款 2：颜色必须用 --color-*，禁止裸 hex 进 wxss
function check2_rawHex(files) {
  const violations = [];
  const hexRegex = /#[0-9A-Fa-f]{6}\b/g;
  // 允许的例外：rgba 半透明遮罩（如 loading-overlay）无法用 Token
  const rgbaRegex = /rgba?\(/;

  for (const f of files) {
    if (isAppWxss(f)) continue;
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
      if (line.includes('var(--color-')) return; // 已走 Token
      if (rgbaRegex.test(line)) return; // rgba 半透明豁免

      const matches = line.match(hexRegex);
      if (matches) {
        for (const m of matches) {
          // 过滤掉 background: transparent 等（不含 hex）
          violations.push({ file: f, line: i + 1, col: line.indexOf(m), value: m, content: line.trim() });
        }
      }
    });
  }
  return violations;
}

// 契约约束条款 3：阴影必须为 Xrpx Xrpx 0 硬阴影，禁止模糊
function check3_blurShadow(files) {
  const violations = [];
  const shadowRegex = /box-shadow\s*:\s*([^;]+);/g;

  for (const f of files) {
    if (isAppWxss(f)) continue;
    const src = readFileSync(f, 'utf8');
    let m;
    while ((m = shadowRegex.exec(src)) !== null) {
      const val = m[1];
      if (val.includes('var(--shadow-')) continue; // 已走 Token
      // 检查是否有第三个非零值（模糊半径）
      const parts = val.trim().split(/\s+/);
      if (parts.length >= 3 && parts[2] !== '0' && !parts[2].startsWith('var')) {
        const lineNo = src.substring(0, m.index).split('\n').length;
        violations.push({ file: f, line: lineNo, value: val, content: m[0] });
      }
    }
  }
  return violations;
}

// 契约约束条款 4：描边粗细统一 --border-w / --border-w-thick
function check4_customBorder(files) {
  const violations = [];
  const borderRegex = /border[^:]*:\s*(\d+rpx)/g;

  for (const f of files) {
    if (isAppWxss(f)) continue;
    const src = readFileSync(f, 'utf8');
    let m;
    while ((m = borderRegex.exec(src)) !== null) {
      const val = m[1];
      // 允许 0（border: 0）
      if (val === '0rpx' || val === '0') continue;
      const lineNo = src.substring(0, m.index).split('\n').length;
      violations.push({ file: f, line: lineNo, value: val, content: m[0] });
    }
  }
  return violations;
}

// 主流程
const wxssFiles = collectWxss(MINI_ROOT);
console.log(`📁 扫描 ${wxssFiles.length} 个 wxss 文件（app.wxss 豁免）\n`);

const v1 = check1_rawRpx(wxssFiles);
const v2 = check2_rawHex(wxssFiles);
const v3 = check3_blurShadow(wxssFiles);
const v4 = check4_customBorder(wxssFiles);

function report(name, v) {
  if (v.length === 0) {
    console.log(`✅ ${name}：通过`);
  } else {
    console.log(`❌ ${name}：${v.length} 处违约`);
    v.forEach(x => {
      console.log(`   ${x.file.split('miniprogram/')[1]}:${x.line}  ${x.content}`);
    });
  }
  console.log();
}

report('约束 1：禁止裸 rpx 魔法数字', v1);
report('约束 2：禁止裸 hex 颜色', v2);
report('约束 3：禁止模糊阴影', v3);
report('约束 4：禁止自定义描边粗细', v4);

const total = v1.length + v2.length + v3.length + v4.length;
if (total === 0) {
  console.log('🎉 全部通过！契约验收合格。');
  process.exit(0);
} else {
  console.log(`⚠️  共 ${total} 处违约，请逐项修复。`);
  process.exit(1);
}
