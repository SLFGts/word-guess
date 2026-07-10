# 后端部署说明

## 云函数列表

| 云函数 | 功能 | 依赖 |
|--------|------|------|
| `newGame` | 开局：选词+预生成提示+算排名表 | `openai` (LLM), `wx-server-sdk` |
| `guess` | 猜词：查排名表+对数映射+返回分数 | `wx-server-sdk` |
| `getHint` | 提示：T1描述/T2锚点/T3提问裁判 | `openai` (LLM), `wx-server-sdk` |

## 部署步骤

### 1. 安装依赖

每个云函数目录都需要安装依赖：

```bash
cd cloudfunctions/newGame && npm install
cd ../guess && npm install
cd ../getHint && npm install
```

### 2. 配置环境变量

在微信开发者工具中：
1. 点击「云开发」→「云函数」→ 选择云函数 →「函数配置」
2. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `LLM_API_KEY` | 你的阿里云百炼 API Key | qwen-turbo 调用 |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 阿里云百炼 OpenAI 兼容地址 |
| `LLM_MODEL` | `qwen-turbo` | 模型名称 |

### 3. 上传向量数据

`newGame` 云函数需要加载词向量数据：

1. 将 `data/vectors-f32.bin` 和 `data/vectors-words.json` 复制到 `cloudfunctions/newGame/` 目录
2. 在 `cloudfunctions/newGame/` 创建 `blocklist.txt`（可选，禁用词列表）

```bash
# 复制向量数据
cp data/vectors-f32.bin cloudfunctions/newGame/
cp data/vectors-words.json cloudfunctions/newGame/

# 创建禁用词列表（示例）
cat > cloudfunctions/newGame/blocklist.txt << 'EOF'
# 政治敏感词
# 不当词汇
EOF
```

### 4. 创建云数据库集合

在微信开发者工具中：
1. 点击「云开发」→「数据库」
2. 创建 `games` 集合
3. 设置权限：「所有用户可读，仅创建者可读写」

### 5. 上传云函数

在微信开发者工具中：
1. 右键点击 `cloudfunctions/newGame` →「上传并部署：云端安装依赖」
2. 右键点击 `cloudfunctions/guess` →「上传并部署：云端安装依赖」
3. 右键点击 `cloudfunctions/getHint` →「上传并部署：云端安装依赖」

### 6. 更新前端配置

修改 `miniprogram/app.js` 中的云开发环境 ID：

```javascript
wx.cloud.init({ env: 'YOUR_ENV_ID', traceUser: true });
```

## 数据结构

### games 集合

```json
{
  "gameId": "12345",           // 5 位数字
  "target": "苹果",            // 目标词
  "mode": "normal",            // normal / daily / theme
  "rankings": {                // 全词池排名表
    "苹果": 1,
    "香蕉": 100,
    "汽车": 50000
  },
  "t1": "一种水果...",         // T1 描述（预生成或缓存）
  "t3": "橘子",                // T2 锚点（预生成或缓存）
  "qa": "是的",                // T3 提问裁判回答
  "createdAt": "2026-07-10T..." // 创建时间
}
```

## 性能说明

| 操作 | 耗时 | 说明 |
|------|------|------|
| newGame 首次调用 | 5-10s | 加载向量 40MB + 计算排名 |
| newGame 后续调用 | 1-3s | 实例复用缓存 |
| guess | <100ms | 查排名表+对数映射 |
| getHint (有缓存) | <50ms | 直接返回 |
| getHint (无缓存) | 1-3s | LLM 生成 |

## 故障排查

### 云函数调用失败

1. 检查云开发环境 ID 是否正确
2. 检查云函数是否已上传
3. 检查环境变量是否配置
4. 查看云函数日志（云开发控制台→云函数→日志）

### LLM 调用失败

1. 检查 `LLM_API_KEY` 是否正确
2. 检查 `LLM_BASE_URL` 是否可访问
3. 查看云函数日志中的错误信息

### 向量加载失败

1. 确认 `vectors-f32.bin` 和 `vectors-words.json` 已上传
2. 确认文件大小正确（bin 约 40MB）
3. 查看云函数启动日志

## 成本估算

| 资源 | 免费额度 | MVP 用量 | 费用 |
|------|----------|----------|------|
| 云函数调用 | 1000 万次/月 | ~10 万次/月 | 免费 |
| 云数据库 | 2GB 存储 | ~1GB/月 | 免费 |
| LLM 调用 | - | ~1000 次/月 | ~¥10/月 |
| 云存储 | 5GB | ~50MB | 免费 |

MVP 阶段总成本：约 ¥10/月（仅 LLM 费用）
