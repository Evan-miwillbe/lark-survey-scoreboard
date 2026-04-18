# 进阶版工作流（自建 Web 实时大屏）

## 前提

- 已完成基础版 Step 1-3（Base + 表单 + 题目已创建）
- 已安装 Node.js 20+（本地开发用）
- 已安装 Serverless Devs (`npm install -g @serverless-devs/s`)

## 文件结构

```
project/
  package.json              # 仅 express 依赖
  server.js                 # Express 主入口，API + 静态文件
  feishu.js                 # 飞书 Open API 客户端（认证、读写记录）
  cache.js                  # 内存缓存（维度统计、name→recordId 映射）
  questions.js              # 题目文本 + 12 维度映射配置
  bootstrap                 # FC3 冷启动脚本（下载 Node.js）
  s.yaml                    # Serverless Devs 部署配置
  index.js                  # FC3 入口（仅占位）
  .gitignore                # 排除 node_modules
  public/
    rating.html             # 手机评分页（单文件，inline CSS/JS）
    dashboard.html          # 大屏展示页（单文件，ECharts）
```

## Step 1: questions.js — 题目与维度配置

导出三个常量：

```javascript
// 120道题文本数组（按飞书 Base 中的字段名顺序）
const QUESTIONS = [
  "题目1文字",
  "题目2文字",
  // ...
];

// 字段名 = 题目文本（飞书 Base 的数字字段名就是题目文字）
const FIELD_NAMES = QUESTIONS;

// 12个维度，等间隔映射
const DIMENSIONS = [
  { name: "目标明确", questionIndices: [0,  12, 24, 36, 48, 60, 72, 84, 96, 108] },
  { name: "渴望成功", questionIndices: [1,  13, 25, 37, 49, 61, 73, 85, 97, 109] },
  // ... 共12个维度
];

module.exports = { QUESTIONS, FIELD_NAMES, DIMENSIONS };
```

**关键规则：**
- `FIELD_NAMES` 必须与飞书 Base 中实际字段名**完全一致**（包括标点符号）
- 用 `lark-cli base +field-list` 获取实际字段名来核对
- 维度映射公式：维度 i 的题目索引 = `[i, i+D, i+2D, ..., i+(K-1)*D]`

## Step 2: feishu.js — 飞书 API 客户端

核心功能：
- `ensureInit()` — 读取凭据并获取 tenant_access_token
- `listAllRecords()` — 分页读取所有记录（缓存初始化）
- `createRecord(fields)` — 创建新记录（新用户注册）
- `updateRecord(recordId, fields)` — 更新记录（评分写入）

**凭据读取策略：**
- FC3 部署：从环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 读取
- 本地开发：从 `~/.lark-cli/config.json` 和 `~/.lark-cli/appsecret.txt` 读取

**Token 自动刷新：**
- tenant_access_token 有效期 2 小时
- 提前 5 分钟自动刷新
- API 返回 401 时自动重试一次

详细代码见 [code-templates.md](code-templates.md#feishujs)

## Step 3: cache.js — 内存缓存

核心数据结构：
```
{
  nameToRecordId: Map<string, string>,     // 姓名 → recordId
  scores: Map<string, Map<number, number>>, // 姓名 → { 题目索引: 分数 }
  dimensionStats: Array,                    // 12个维度统计
  stats: { totalRegistered, totalCompleted, totalRatings, lastUpdate }
}
```

**刷新策略：**
- 启动时：从飞书 Base 全量加载
- 每次评分写入：内存中即时更新，重算维度统计
- 定时（5秒）：从飞书 Base 重新同步（`CACHE_TTL = 5000`）
- 大屏轮询：直接读内存，<1ms 响应，不调飞书 API

详细代码见 [code-templates.md](code-templates.md#cachejs)

## Step 4: server.js — Express API

**API 端点：**

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/register` | 注册：输入姓名+部门，返回已有评分（断点续填） |
| POST | `/api/rate` | 评分：写入单个评分到飞书 Base |
| POST | `/api/sync` | 批量同步：页面恢复时一次性同步所有评分 |
| GET | `/api/questions` | 返回题目列表和维度映射 |
| GET | `/api/dashboard` | 大屏数据：维度统计 + 进度（从缓存读） |
| GET | `/api/rawdata` | 原始数据：所有人的所有评分 |
| GET | `/api/export-csv` | 导出 CSV |

**CORS 中间件（必须）：**
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
```

**为什么需要 CORS：** 前端 HTML 在 GitHub Pages，API 在 FC3，域名不同，浏览器会阻止跨域请求。

详细代码见 [code-templates.md](code-templates.md#serverjs)

## Step 5: rating.html — 手机评分页

**设计方向：** 温暖专业风（Warm Professional）
- 浅色背景，减少长时间填写的视觉疲劳
- 主色调：深靛蓝 `#1B2A4A`，强调色：琥珀橙 `#F59E0B`

**入口流程：**
1. 页面加载 → 检查 localStorage 是否有已保存的姓名
2. 有 → 自动调 `/api/register` 恢复，跳过注册
3. 无 → 显示注册界面（姓名 + 部门 + "开始评分"按钮）

**主界面：**
- 顶部：进度条（X/120）
- 维度标签栏：12 个可横滑的胶囊标签，每个显示 "维度名 N/10"
- 题目区：当前维度 10 道题，卡片式布局
- 每道题一行 10 个评分按钮（1-10），已选高亮
- localStorage 保存，断点续填
- 每点一个评分立即发 AJAX 到服务器

**关键代码模式：**
```javascript
const API_BASE = 'https://your-fc3-url.fcapp.run';
// 所有 fetch 使用绝对路径
const res = await fetch(API_BASE + '/api/rate', { ... });
```

详细代码见 [code-templates.md](code-templates.md#ratinghtml)

## Step 6: dashboard.html — 大屏展示页

**设计方向：** 暗夜数据大屏（Dark Data Cinema）
- 深色背景 `#0B0F1A`，半透明卡片 `rgba(15, 25, 50, 0.7)`
- 高分青绿 `#00E5A0`，低分珊瑚红 `#FF6B6B`，中分金黄 `#FFD166`

**布局：**
- 顶部栏：标题 + 图表/数据切换按钮 + 统计数字 + 时钟
- 主体：3列4行网格，12个维度卡片
- 每个卡片内一个横向条形图（10根条 = 10道题的平均分）

**数据更新：**
- 每秒 `GET /api/dashboard` 轮询
- ECharts 动画平滑过渡（`animationDuration: 500, animationEasing: cubicOut`）

详细代码见 [code-templates.md](code-templates.md#dashboardhtml)

## Step 7: 部署

详见 [deployment-guide.md](deployment-guide.md)

1. 部署 API 到阿里云 FC3
2. 部署 HTML 到 GitHub Pages
3. 修改 HTML 中的 `API_BASE` 为 FC3 URL
4. 端到端测试
