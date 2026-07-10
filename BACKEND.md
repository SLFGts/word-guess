# 后端部署说明（双模式架构）

## 云函数列表

| 云函数 | 功能 | 依赖 | 状态 |
|--------|------|------|------|
| `newGame` | 开局：双模式支持（向量/Embedding） | `openai`, `wx-server-sdk` | ✅ 已部署 |
| `guess` | 猜词：双模式支持（查表/API 计算） | `openai`, `wx-server-sdk` | ✅ 已部署 |
| `getHint` | 提示：T1描述/T2锚点/T3提问裁判 | `openai`, `wx-server-sdk` | ✅ 已部署 |
| `getAnswer` | 调试用：获取目标词答案 | `wx-server-sdk` | ✅ 已部署 |

---

## 双模式架构

### Mode A：向量方案（正式环境）

```
newGame:
  1. 从云存储下载 41MB 向量文件（首次冷启动 10-20 秒）
  2. LLM smart_pick 选词 + 预生成 T1/T2
  3. 计算目标词与全词池排名表
  4. 存数据库 games 集合

guess:
  1. 查数据库 rankings 表
  2. 对数排名映射 → score (0-100)
  3. 返回 { score, won }
```

**优势**：分数精准（基于 53219 词排名）
**劣势**：冷启动慢（10-20 秒）

### Mode B：Embedding API 方案（调试/快速验证）

```
newGame:
  1. 从词池随机选词（53219 词，内嵌在代码中）
  2. 调 Embedding API 获取目标词向量（~200ms）
  3. 存数据库（含 targetVec 字段）

guess:
  1. 调 Embedding API 获取猜测词向量（~200ms）
  2. 1v1 余弦相似度计算
  3. 返回 { similarity: 0.7234, won }
```

**优势**：冷启动 0 秒，无词库限制
**劣势**：每次猜词 200-500ms，相似度需调校

### 切换方式

在**云开发控制台**设置环境变量：

| 云函数 | 变量名 | 值 |
|--------|--------|-----|
| newGame | `SIMILARITY_MODE` | `vector` 或 `embedding` |
| guess | （自动识别） | 从数据库读 `similarityMode` 字段 |

---

## 环境变量配置

### newGame 云函数

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `LLM_API_KEY` | `sk-92554800bfaa4928be6d7e700f2f9b0b` | smartPick 选词 |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容 |
| `LLM_MODEL` | `qwen-turbo` | 选词模型 |
| `EMBEDDING_MODEL` | `text-embedding-v4` | Mode B 向量模型 |
| `SIMILARITY_MODE` | `vector` 或 `embedding` | 切换方案 |

### guess 云函数

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `LLM_API_KEY` | `sk-92554800bfaa4928be6d7e700f2f9b0b` | Embedding API |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容 |
| `EMBEDDING_MODEL` | `text-embedding-v4` | Mode B 向量模型 |

### getHint 云函数

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `LLM_API_KEY` | `sk-92554800bfaa4928be6d7e700f2f9b0b` | T1/T2/T3 生成 |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容 |
| `LLM_MODEL` | `qwen-turbo` | 提示生成模型 |

---

## 数据库结构

### games 集合

```json
{
  "gameId": "12345",
  "target": "苹果",
  "mode": "normal",
  "similarityMode": "vector",
  "rankings": { "苹果": 1, "香蕉": 100, ... },  // Mode A
  "targetVec": [0.1, 0.2, ...],                 // Mode B
  "t1": "一种水果...",
  "t3": "橘子",
  "qa": "是的",
  "createdAt": "2026-07-10T..."
}
```

**关键**：`similarityMode` 字段让 `guess` 函数自动识别模式。

---

## 部署步骤

### 1. 安装依赖

```bash
cd cloudfunctions/newGame && npm install
cd ../guess && npm install
cd ../getHint && npm install
cd ../getAnswer && npm install
```

### 2. 上传云函数

在微信开发者工具中：
1. 右键 `cloudfunctions/newGame` →「上传并部署：云端安装依赖」
2. 右键 `cloudfunctions/guess` →「上传并部署：云端安装依赖」
3. 右键 `cloudfunctions/getHint` →「上传并部署：云端安装依赖」
4. 右键 `cloudfunctions/getAnswer` →「上传并部署：云端安装依赖」

### 3. 配置环境变量

在云开发控制台 → 云函数 → 函数配置 → 环境变量（见上方表格）

### 4. 创建数据库集合

1. 云开发控制台 → 数据库
2. 创建 `games` 集合
3. 权限：「所有用户可读，仅创建者可读写」

### 5. 上传向量数据（Mode A 需要）

`newGame` 云函数从云存储加载向量文件：

1. 云开发控制台 → 存储 → 创建 `vectors/` 文件夹
2. 上传 `vectors-f32.bin`（41MB）和 `vectors-words.json`（613KB）

---

## 性能说明

| 操作 | Mode A | Mode B |
|------|--------|--------|
| newGame 首次 | 10-20 秒 | 1-3 秒 |
| newGame 后续 | 1-3 秒 | 1-3 秒 |
| guess | < 100ms | 200-500ms |
| getHint (缓存) | < 50ms | < 50ms |
| getHint (无缓存) | 1-3 秒 | 1-3 秒 |

---

## 成本估算

| 资源 | Mode A | Mode B |
|------|--------|--------|
| 云存储下载 | 41MB/次（冷启动） | 0 |
| Embedding API | 0 | ~¥0.002/月 |
| LLM 调用 | ~¥10/月 | ~¥10/月 |
| **总计** | **~¥10/月** | **~¥10/月** |

---

## 故障排查

### 云函数调用失败

1. 检查环境变量是否配置
2. 检查云函数是否已上传
3. 查看云函数日志（云开发控制台→云函数→日志）

### Mode A 向量加载失败

1. 确认云存储 `vectors/` 文件夹有 2 个文件
2. 检查环境变量 `SIMILARITY_MODE` = `vector`

### Mode B Embedding API 失败

1. 检查 `LLM_API_KEY` 和 `EMBEDDING_MODEL` 环境变量
2. 确认阿里云百炼账号正常
3. 查看云函数日志

### 相似度效果不合理（Mode B）

1. 调整颜色阈值（`< 0.3 / 0.3-0.6 / >= 0.6`）
2. 考虑换用 `text-embedding-v3`（如果 v4 效果不好）
3. 或切换回 Mode A

---

**文档最后更新**：2026-07-10
