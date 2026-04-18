# 进阶版核心代码模板

本文件包含进阶版所有核心文件的可复用模板。需要根据你的实际项目修改配置区的值。

## 复用前：所有需要修改的配置项

| 文件 | 配置项 | 说明 |
|------|--------|------|
| `questions.js` | `QUESTIONS` | 题目文本数组（必须与飞书 Base 字段名一致） |
| `questions.js` | `DIMENSIONS` | 维度名称和题目索引映射 |
| `feishu.js` | `BASE_TOKEN` | 飞书 Base token（从 URL 或 `+base-get` 获取） |
| `feishu.js` | `TABLE_ID` | 飞书表 ID（从 `+table-list` 获取） |
| `cache.js` | `NAME_FIELD` | 姓名字段名（必须和表单中姓名题标题一致） |
| `server.js` | `NAME_FIELD` | 同上，两处必须一致 |
| `server.js` | `DEPT_FIELD` | 部门字段名（必须和表单中部门题标题一致） |
| `rating.html` | `API_BASE` | FC3 部署后的 URL |
| `rating.html` | `DIM_NAMES` | 维度名称列表 |
| `rating.html` | `TOTAL_QUESTIONS` | 总题数（默认120） |
| `dashboard.html` | `API_BASE` | FC3 部署后的 URL |
| `dashboard.html` | `DIMS` | 维度名称列表 |

> 完整的 rating.html 和 dashboard.html 请参考项目源码，或向 Claude Code 说"基于 code-templates.md 生成完整的 rating.html"。

---

## feishu.js — 飞书 Open API 客户端

```javascript
const fs = require('fs');
const path = require('path');

// ===== 配置区 =====
const BASE_TOKEN = 'your_base_token';      // 从 lark-cli base +base-create 或 URL 获取
const TABLE_ID = 'your_table_id';          // 从 lark-cli base +table-list 获取
// ===== 配置区结束 =====

const API_BASE = 'https://open.feishu.cn';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// 凭据路径（本地开发用）
const CONFIG_PATH = path.join(require('os').homedir(), '.lark-cli/config.json');
const SECRET_PATH = path.join(require('os').homedir(), '.lark-cli/appsecret.txt');

let appId = '';
let appSecret = '';
let tenantAccessToken = '';
let tokenExpiresAt = 0;
let initialized = false;

function readCredentials() {
  // 优先从环境变量读取（FC3 部署），否则从本地文件（开发）
  appId = process.env.FEISHU_APP_ID || '';
  appSecret = process.env.FEISHU_APP_SECRET || '';

  if (appId && appSecret) return;

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const app = config.apps && config.apps[0];
    if (app && app.appId) appId = app.appId;
    appSecret = fs.readFileSync(SECRET_PATH, 'utf-8').trim();
  } catch (e) {
    throw new Error('无法读取飞书凭据：请设置环境变量或在本地运行 lark-cli login');
  }
}

async function fetchTenantAccessToken() {
  const url = `${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 token 失败: code=${data.code}, msg=${data.msg}`);
  }

  tenantAccessToken = data.tenant_access_token;
  tokenExpiresAt = Date.now() + data.expire * 1000;
}

async function ensureToken() {
  if (!tenantAccessToken || Date.now() >= tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
    await fetchTenantAccessToken();
  }
}

async function apiRequest(method, urlPath, body) {
  await ensureToken();

  const fullUrl = urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${tenantAccessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let res = await fetch(fullUrl, options);
  let data = await res.json();

  // Token 过期自动重试
  if (res.status === 401 || data.code === 99991663 || data.code === 99991668) {
    await fetchTenantAccessToken();
    options.headers['Authorization'] = `Bearer ${tenantAccessToken}`;
    res = await fetch(fullUrl, options);
    data = await res.json();
  }

  return data;
}

async function init() {
  if (initialized) return;
  readCredentials();
  await fetchTenantAccessToken();
  initialized = true;
}

async function ensureInit() {
  if (!initialized) await init();
  await ensureToken();
}

async function listAllRecords() {
  const allRecords = [];
  let pageToken = undefined;

  do {
    let url = `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records?page_size=500`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const data = await apiRequest('GET', url);
    if (data.code !== 0) {
      console.error('listAllRecords error:', data.code, data.msg);
      return null;
    }

    const items = (data.data && data.data.items) || [];
    for (const item of items) {
      allRecords.push({ record_id: item.record_id, fields: item.fields });
    }

    const hasMore = data.data && data.data.has_more;
    pageToken = hasMore ? data.data.page_token : undefined;
  } while (pageToken);

  return allRecords;
}

async function createRecord(fields) {
  const url = `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records`;
  const data = await apiRequest('POST', url, { fields });

  if (data.code !== 0) {
    console.error('createRecord error:', data.code, data.msg);
    return null;
  }

  const rec = data.data && data.data.record;
  return { record_id: rec.record_id, fields: rec.fields };
}

async function updateRecord(recordId, fields) {
  const url = `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`;
  const data = await apiRequest('PUT', url, { fields });

  if (data.code !== 0) {
    const err = new Error(`updateRecord error: ${data.code} ${data.msg}`);
    throw err;
  }

  const rec = data.data && data.data.record;
  return { record_id: rec.record_id, fields: rec.fields };
}

module.exports = {
  init, ensureInit,
  listAllRecords, createRecord, updateRecord,
};
```

---

## cache.js — 内存缓存

```javascript
const { DIMENSIONS, FIELD_NAMES } = require('./questions');

const cache = {
  nameToRecordId: new Map(),
  scores: new Map(),
  dimensionStats: [],
  stats: {
    totalRegistered: 0,
    totalCompleted: 0,
    totalRatings: 0,
    lastUpdate: null
  }
};

function initEmptyStats() {
  cache.dimensionStats = DIMENSIONS.map(d => ({
    name: d.name,
    questions: d.questionIndices.map(idx => ({
      index: idx,
      average: 0,
      responseCount: 0
    }))
  }));
}

function loadFromRecords(records) {
  cache.nameToRecordId.clear();
  cache.scores.clear();

  let totalRatings = 0;
  let totalCompleted = 0;

  // ===== 配置区：姓名字段名 =====
  const NAME_FIELD = '您的姓名';    // 改成你的表单中姓名题的标题
  // ===== 配置区结束 =====
  const TOTAL_QUESTIONS = FIELD_NAMES.length;

  for (const rec of records) {
    const f = rec.fields;
    const name = f[NAME_FIELD];
    if (!name) continue;

    cache.nameToRecordId.set(name, rec.record_id);

    const personScores = new Map();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const fieldName = FIELD_NAMES[i];
      const val = parseFloat(f[fieldName]);
      if (!isNaN(val) && val >= 1 && val <= 10) {
        personScores.set(i, val);
        totalRatings++;
      }
    }
    cache.scores.set(name, personScores);
    if (personScores.size === TOTAL_QUESTIONS) totalCompleted++;
  }

  cache.stats.totalRegistered = cache.nameToRecordId.size;
  cache.stats.totalCompleted = totalCompleted;
  cache.stats.totalRatings = totalRatings;
  cache.stats.lastUpdate = new Date().toISOString();

  recalcDimensionStats();
}

function recalcDimensionStats() {
  cache.dimensionStats = DIMENSIONS.map(d => {
    const questionStats = d.questionIndices.map(idx => {
      let sum = 0, count = 0;
      for (const [, personScores] of cache.scores) {
        const val = personScores.get(idx);
        if (val !== undefined) { sum += val; count++; }
      }
      return {
        index: idx,
        average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
        responseCount: count
      };
    });
    return { name: d.name, questions: questionStats };
  });
}

function setScore(name, recordId, questionIndex, score) {
  if (!cache.nameToRecordId.has(name)) {
    cache.nameToRecordId.set(name, recordId);
    cache.scores.set(name, new Map());
    cache.stats.totalRegistered = cache.nameToRecordId.size;
  }

  const personScores = cache.scores.get(name);
  const isNew = !personScores.has(questionIndex);
  personScores.set(questionIndex, score);

  if (isNew) cache.stats.totalRatings++;
  // 重算已完成人数
  let completed = 0;
  for (const ps of cache.scores.values()) {
    if (ps.size === FIELD_NAMES.length) completed++;
  }
  cache.stats.totalCompleted = completed;

  cache.stats.lastUpdate = new Date().toISOString();
  recalcDimensionStats();
}

function getPersonScores(name) {
  const scores = cache.scores.get(name);
  if (!scores) return {};
  const result = {};
  for (const [idx, val] of scores) {
    if (idx >= 0 && idx < FIELD_NAMES.length) result[idx] = val;
  }
  return result;
}

function getDashboardData() {
  return { dimensions: cache.dimensionStats, stats: cache.stats };
}

function getRecordId(name) {
  return cache.nameToRecordId.get(name);
}

function getRawData() {
  const people = [];
  for (const [name, scores] of cache.scores) {
    const personScores = {};
    for (const [idx, val] of scores) {
      if (idx >= 0 && idx < FIELD_NAMES.length) personScores[idx] = val;
    }
    people.push({ name, scores: personScores });
  }
  return { people, questions: FIELD_NAMES, stats: cache.stats };
}

module.exports = {
  cache, initEmptyStats, loadFromRecords, setScore,
  getPersonScores, getDashboardData, getRawData, getRecordId
};
```

---

## server.js — Express API

```javascript
const express = require('express');
const path = require('path');
const feishu = require('./feishu');
const { cache, setScore, getPersonScores, getDashboardData, getRawData, getRecordId, loadFromRecords } = require('./cache');
const { FIELD_NAMES, QUESTIONS, DIMENSIONS } = require('./questions');

const app = express();
const PORT = process.env.FC_SERVER_PORT || process.env.PORT || 3000;
const CACHE_TTL = 5000;  // 缓存刷新间隔（毫秒）

app.use(express.json());

// CORS 中间件（必须：前端在不同域名）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 缓存自动刷新
let lastCacheRefresh = 0;
let cacheRefreshPromise = null;

async function ensureCache() {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL && cache.stats.totalRegistered > 0) return;
  if (cacheRefreshPromise) { await cacheRefreshPromise; return; }

  cacheRefreshPromise = (async () => {
    try {
      await feishu.ensureInit();
      const recs = await feishu.listAllRecords();
      if (recs !== null && recs.length >= 0) {
        loadFromRecords(recs);
        lastCacheRefresh = Date.now();
      }
    } catch (e) {
      console.error('[缓存刷新失败]', e.message);
    } finally {
      cacheRefreshPromise = null;
    }
  })();
  await cacheRefreshPromise;
}

// ===== 配置区：姓名字段名、部门字段名 =====
const NAME_FIELD = '您的姓名';
const DEPT_FIELD = '部门名称';
// ===== 配置区结束 =====

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { name, department } = req.body;
    if (!name || !department) {
      return res.status(400).json({ ok: false, error: '姓名和部门不能为空' });
    }

    await feishu.ensureInit();
    await ensureCache();

    let recordId = getRecordId(name);
    if (recordId) {
      const scores = getPersonScores(name);
      return res.json({ ok: true, recordId, scores });
    }

    const fields = { [NAME_FIELD]: name, [DEPT_FIELD]: department };
    const record = await feishu.createRecord(fields);
    if (!record) {
      return res.status(500).json({ ok: false, error: '创建记录失败' });
    }

    recordId = record.record_id;
    cache.nameToRecordId.set(name, recordId);
    cache.scores.set(name, new Map());
    cache.stats.totalRegistered = cache.nameToRecordId.size;
    cache.stats.lastUpdate = new Date().toISOString();
    lastCacheRefresh = Date.now();

    res.json({ ok: true, recordId, scores: {} });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// 单题评分
app.post('/api/rate', async (req, res) => {
  try {
    const { name, questionIndex, score } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: '请先注册' });
    if (typeof questionIndex !== 'number' || questionIndex < 0 || questionIndex >= FIELD_NAMES.length) {
      return res.status(400).json({ ok: false, error: '题目索引无效' });
    }
    if (typeof score !== 'number' || score < 1 || score > 10) {
      return res.status(400).json({ ok: false, error: '分数必须在1-10之间' });
    }

    await feishu.ensureInit();

    let recordId = getRecordId(name);
    if (!recordId) {
      await ensureCache();
      recordId = getRecordId(name);
    }
    if (!recordId) return res.status(400).json({ ok: false, error: '请先注册' });

    const fieldName = FIELD_NAMES[questionIndex];
    try {
      await feishu.updateRecord(recordId, { [fieldName]: score });
    } catch (e) {
      console.error(`Write failed for ${name} Q${questionIndex}:`, e.message);
      return res.status(500).json({ ok: false, error: '写入失败，请重试' });
    }

    setScore(name, recordId, questionIndex, score);
    res.json({ ok: true });
  } catch (e) {
    console.error('Rate error:', e);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// 批量同步
app.post('/api/sync', async (req, res) => {
  try {
    const { name, ratings } = req.body;
    if (!name || !ratings) return res.status(400).json({ ok: false, error: '参数无效' });

    await feishu.ensureInit();

    let recordId = getRecordId(name);
    if (!recordId) {
      await ensureCache();
      recordId = getRecordId(name);
    }
    if (!recordId) return res.status(400).json({ ok: false, error: '请先注册' });

    const fields = {};
    let synced = 0;
    for (const [idx, score] of Object.entries(ratings)) {
      const i = Number(idx);
      if (i >= 0 && i < FIELD_NAMES.length && score >= 1 && score <= 10) {
        fields[FIELD_NAMES[i]] = score;
        setScore(name, recordId, i, score);
        synced++;
      }
    }

    if (Object.keys(fields).length > 0) {
      try {
        await feishu.updateRecord(recordId, fields);
      } catch (e) {
        return res.status(500).json({ ok: false, error: '同步失败，请重试' });
      }
    }

    res.json({ ok: true, synced });
  } catch (e) {
    console.error('Sync error:', e);
    res.status(500).json({ ok: false, error: '服务器错误' });
  }
});

// 题目列表
app.get('/api/questions', (req, res) => {
  res.json({
    questions: QUESTIONS,
    dimensions: DIMENSIONS.map(d => ({ name: d.name, questionIndices: d.questionIndices }))
  });
});

// 大屏数据
app.get('/api/dashboard', async (req, res) => {
  await ensureCache();
  res.json(getDashboardData());
});

// 原始数据
app.get('/api/rawdata', async (req, res) => {
  await ensureCache();
  res.json(getRawData());
});

// CSV 导出
app.get('/api/export-csv', async (req, res) => {
  await ensureCache();
  const data = getRawData();
  const BOM = '\uFEFF';
  let csv = BOM + '姓名,' + data.questions.map((q, i) => 'Q' + (i + 1)).join(',') + '\n';
  for (const p of data.people) {
    csv += p.name;
    for (let i = 0; i < data.questions.length; i++) {
      csv += ',' + (p.scores[i] !== undefined ? p.scores[i] : '');
    }
    csv += '\n';
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=scores.csv');
  res.send(csv);
});

const listenPort = process.env.FC_SERVER_PORT || PORT;
app.listen(listenPort, '0.0.0.0', () => {
  console.log(`服务器已启动，端口: ${listenPort}`);
});

module.exports = app;
```

---

## rating.html — 手机评分页关键片段

> 完整文件约 270 行，此处标注关键可修改部分。完整版参考项目中的 `public/rating.html`。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>项目名称</title>
<style>
/* ===== 样式可自由定制 ===== */
/* 配色方案 */
:root{--primary:#1B2A4A;--accent:#F59E0B;--bg:#FAFAF8;--card:#fff;--text:#1a1a1a;--muted:#888;--border:#e5e5e5}
/* ... 其余样式见完整版 ... */
</style>
</head>
<body>
<!-- 注册界面 -->
<!-- 主评分界面 -->
<!-- 完成界面 -->

<script>
// ===== 配置区 =====
const API_BASE = 'https://your-fc3-url.fcapp.run';  // FC3 部署地址
const DIM_NAMES = ["维度1", "维度2", "维度3", "维度4", ...];  // 你的维度名称

// 维度-题目映射
const DIM_MAP = {};
const TOTAL_QUESTIONS = 120;  // 你的总题数
DIM_NAMES.forEach((name, i) => {
  DIM_MAP[i] = [];
  for (let k = 0; k < TOTAL_QUESTIONS / DIM_NAMES.length; k++) {
    DIM_MAP[i].push(i + DIM_NAMES.length * k);
  }
});
// ===== 配置区结束 =====

let questions = [];
let myName = '';
let myDept = '';
let ratings = {};
let activeDim = 0;

// ... 其余逻辑见完整版：注册、打分、localStorage 断点续填
</script>
</body>
</html>
```

---

## dashboard.html — 大屏展示页关键片段

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>项目名称 - 实时大屏</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
/* 暗色主题 */
:root{--bg:#0B0F1A;--card:rgba(15,25,50,0.7);--text:#E8ECF1;--muted:#7B8BA3;--high:#00E5A0;--low:#FF6B6B;--mid:#FFD166}
/* 3列4行网格 */
.grid{flex:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:10px;padding:12px 16px}
</style>
</head>
<body>
<script>
// ===== 配置区 =====
const API_BASE = 'https://your-fc3-url.fcapp.run';
const DIMS = ["维度1", "维度2", "维度3", "维度4", ...];  // 你的维度名称
// ===== 配置区结束 =====

const TOTAL_QUESTIONS = 120;  // 根据实际题目数修改

function getColor(val) {
  if (val === 0) return 'rgba(255,255,255,0.1)';
  if (val >= 7) return '#00E5A0';
  if (val >= 5) return '#FFD166';
  return '#FF6B6B';
}

// ECharts 初始化：每个维度一个条形图卡片
function initCharts() {
  const grid = document.getElementById('grid');
  DIMS.forEach((name, i) => {
    const indices = [];
    for (let k = 0; k < TOTAL_QUESTIONS / DIMS.length; k++) indices.push(i + DIMS.length * k);
    // 创建 ECharts 实例，设置条形图...
  });
}

// 每秒轮询
async function poll() {
  const r = await fetch(API_BASE + '/api/dashboard');
  const data = await r.json();
  updateCharts(data);
}
setInterval(poll, 1000);
</script>
</body>
</html>
```

---

## bootstrap — FC3 冷启动脚本

```bash
#!/bin/bash
set -e

NODE_VERSION="v20.11.0"
NODE_DIR="/tmp/node-runtime"
NODE_BIN="$NODE_DIR/bin/node"

if [ ! -f "$NODE_BIN" ]; then
  echo "Downloading Node.js ${NODE_VERSION}..."
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://npmmirror.com/mirrors/node/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C "$NODE_DIR" --strip-components=1
  echo "Node.js installed: $($NODE_BIN --version)"
fi

cd "$(dirname "$0")"
exec "$NODE_BIN" server.js
```

**Windows 创建后需要转换换行符：** `sed -i 's/\r$//' bootstrap`
