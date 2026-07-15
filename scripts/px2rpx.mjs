#!/usr/bin/env node
/**
 * px2rpx.mjs — 把 CSS 里的 px 批量转成 rpx，杜绝手工换算。
 *
 * 用法:
 *   node scripts/px2rpx.mjs <input.css> [scale=2] [output.wxss]
 *
 * 参数:
 *   input    源 CSS/WXSS 文件路径
 *   scale    换算系数，默认 2（微信小程序 1px=2rpx，基于 iPhone6 屏宽 375px）
 *   output   输出路径；省略则打印到 stdout
 *
 * 规则:
 *   - 匹配 Npx（含负数、小数），替换为 N×scale rpx
 *   - 0px → 0rpx（无副作用，统一单位）
 *   - 不触碰 %、vh、vw、em、rem、deg 等其他单位
 *
 * 示例:
 *   node scripts/px2rpx.mjs 高保真原型设计/src/index.css 2 > out.wxss
 *   node scripts/px2rpx.mjs 高保真原型设计/src/components/HomePage.tsx 2 page.wxss
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const [, , input, scaleArg = '2', output] = argv;

if (!input) {
  console.error('用法: node scripts/px2rpx.mjs <input.css> [scale=2] [output.wxss]');
  exit(1);
}

const scale = Number(scaleArg) || 2;

let css;
try {
  css = readFileSync(input, 'utf8');
} catch (e) {
  console.error(`读取失败: ${input}\n${e.message}`);
  exit(1);
}

// 匹配 数字px（含负数/小数），词边界保证不误伤 px 出现在标识符里的情况
const out = css.replace(/(-?\d*\.?\d+)px\b/g, (m, n) => `${Number(n) * scale}rpx`);

if (output) {
  writeFileSync(output, out);
  const count = (css.match(/(-?\d*\.?\d+)px\b/g) || []).length;
  console.log(`✓ ${input} → ${output}  (scale=${scale}, ${count} 处 px 已转换)`);
} else {
  process.stdout.write(out);
}
