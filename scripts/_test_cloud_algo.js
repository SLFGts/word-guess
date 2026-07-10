// scripts/_test_cloud_algo.js
// 单测云函数算法翻译（不依赖 wx-server-sdk）：leaksTarget / scoreFor / computeRankings
// 验证 JS 翻译与 Python serve_local 等价。用 data/vectors-f32.bin + vectors-words.json
const fs = require('fs')
const path = require('path')

const DATA = path.join(__dirname, '..', 'data')

// --- 复制核心算法（与 cloudfunctions/newGame/index.js 逻辑一致，用于离线单测）---
function leaksTarget(text, target) {
  if (!text) return false
  if (target.length < 2) return [...text].some(c => target.includes(c))
  for (let i = 0; i < target.length - 1; i++) {
    if (text.includes(target.slice(i, i + 2))) return true
  }
  return false
}
function scoreFor(rank, n) {
  if (rank <= 1) return 100.0
  return Math.round((1 - Math.log(rank) / Math.log(n)) * 10000) / 100
}

// 加载向量
let _vecs, _words, _wordIndex
function loadVectors() {
  const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'vectors-words.json'), 'utf8'))
  _words = meta.words
  const dim = meta.dim
  const buf = fs.readFileSync(path.join(DATA, 'vectors-f32.bin'))
  _vecs = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  _wordIndex = new Map()
  for (let i = 0; i < _words.length; i++) _wordIndex.set(_words[i], i)
  return { n: _words.length, dim }
}

// 算排名表（重算每词norm，单测用；云函数版有ensureNorms缓存，逻辑等价）
function computeRankings(target) {
  const n = _words.length
  const dim = _vecs.length / n
  const ti = _wordIndex.get(target)
  const tv = new Float32Array(dim)
  let tnorm = 0
  for (let k = 0; k < dim; k++) tnorm += _vecs[ti * dim + k] * _vecs[ti * dim + k]
  tnorm = Math.sqrt(tnorm) || 1
  for (let k = 0; k < dim; k++) tv[k] = _vecs[ti * dim + k] / tnorm
  const sims = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const off = i * dim
    let nrm = 0
    for (let k = 0; k < dim; k++) nrm += _vecs[off + k] * _vecs[off + k]
    nrm = Math.sqrt(nrm) || 1
    let dot = 0
    for (let k = 0; k < dim; k++) dot += (_vecs[off + k] / nrm) * tv[k]
    sims[i] = dot
  }
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => sims[b] - sims[a])
  const rankings = {}
  for (let r = 0; r < n; r++) rankings[_words[order[r]]] = r + 1
  return rankings
}

// --- 测试 ---
console.log('=== leaksTarget 2字子串判定 ===')
const cases = [
  ['盛水容器', '水缸', false],   // 单字"水"不剧透放过
  ['雪山闻名', '玉龙雪山', true], // 2字"雪山"剧透
  ['家用电器', '电视机', false], // 单字"电"不剧透
  ['经济领域', '宏观经济', true], // 2字"经济"剧透
  ['相似之处', '相像', false],   // 单字"相"不剧透
  ['一个名词', '苹果', false],   // 无关
]
let pass = 0
for (const [text, target, expected] of cases) {
  const got = leaksTarget(text, target)
  const ok = got === expected
  if (ok) pass++
  console.log(`  ${ok ? '✓' : '✗'} leaks("${text}","${target}")=${got} 期望${expected}`)
}

console.log('\n=== scoreFor 对数排名映射 ===')
const N = 53219
console.log(`  rank=1 → ${scoreFor(1, N)} (期望100)`)
console.log(`  rank=10 → ${scoreFor(10, N)} (期望~78)`)
console.log(`  rank=100 → ${scoreFor(100, N)} (期望~57)`)
console.log(`  rank=1000 → ${scoreFor(1000, N)} (期望~36)`)

console.log('\n=== computeRankings JS（加载40MB向量，对比Python）===')
const { n, dim } = loadVectors()
console.log(`加载 ${n}词 ${dim}维`)
const t0 = Date.now()
const rankings = computeRankings('苹果')
console.log(`computeRankings 耗时: ${Date.now() - t0}ms`)
const top5 = Object.entries(rankings).filter(([w]) => w !== '苹果').sort((a, b) => a[1] - b[1]).slice(0, 5).map(([w]) => w)
console.log(`苹果 top5(排除自身): ${top5.join(', ')}`)
console.log(`（Python pack_vectors 验证过 苹果→橘子/梨/... 应一致）`)

console.log(`\n${pass}/${cases.length} leaksTarget 用例通过`)
