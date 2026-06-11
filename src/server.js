require('./env').loadEnv();

const express = require('express');
const path = require('path');
const feishu = require('./feishu');
const {
  getDashboardData,
  getRawData,
  loadFromRecords,
} = require('./cache');
const {
  config,
  QUESTION_DEFS,
  DIMENSIONS,
  FIELD_NAMES,
  SCORE_MIN,
  SCORE_MAX,
  FORM_URL,
} = require('./questions');

const app = express();
const PORT = process.env.FC_SERVER_PORT || process.env.PORT || 3000;
const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 3000);
const LIVE_POLL_MS = Number(process.env.LIVE_POLL_MS || 3000);

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

let lastCacheRefresh = 0;
let cacheRefreshPromise = null;
let lastBroadcastPayload = '';
const eventClients = new Set();

async function refreshCache(force = false) {
  const now = Date.now();
  if (!force && now - lastCacheRefresh < CACHE_TTL) return;
  if (cacheRefreshPromise) {
    await cacheRefreshPromise;
    return;
  }

  cacheRefreshPromise = (async () => {
    await feishu.ensureInit();
    const records = await feishu.listAllRecords();
    loadFromRecords(records);
    lastCacheRefresh = Date.now();
  })();

  try {
    await cacheRefreshPromise;
  } finally {
    cacheRefreshPromise = null;
  }
}

async function freshDashboard(force = false) {
  await refreshCache(force);
  return getDashboardData();
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function broadcastIfChanged(force = false) {
  if (eventClients.size === 0) return;

  try {
    const data = await freshDashboard(force);
    const payload = JSON.stringify(data);
    if (payload === lastBroadcastPayload && !force) return;
    lastBroadcastPayload = payload;
    for (const res of eventClients) writeEvent(res, 'dashboard', data);
  } catch (error) {
    const payload = { message: error.message, at: new Date().toISOString() };
    for (const res of eventClients) writeEvent(res, 'error', payload);
    console.error('[live refresh failed]', error);
  }
}

app.all(['/api/register', '/api/rate', '/api/sync'], (req, res) => {
  res.status(410).json({
    ok: false,
    error: '请使用飞书问卷填写；本地服务只负责实时看板和统计。',
    formUrl: FORM_URL,
  });
});

app.get('/api/questions', (req, res) => {
  res.json({
    title: config.title,
    scoreMin: SCORE_MIN,
    scoreMax: SCORE_MAX,
    questions: QUESTION_DEFS,
    dimensions: DIMENSIONS,
    baseUrl: config.baseUrl,
    formUrl: FORM_URL,
  });
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await freshDashboard(req.query.force === '1');
    res.json(data);
  } catch (error) {
    console.error('[dashboard failed]', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/rawdata', async (req, res) => {
  try {
    await refreshCache(req.query.force === '1');
    res.json(getRawData());
  } catch (error) {
    console.error('[rawdata failed]', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  eventClients.add(res);
  try {
    writeEvent(res, 'dashboard', await freshDashboard());
  } catch (error) {
    writeEvent(res, 'error', { message: error.message, at: new Date().toISOString() });
  }

  const heartbeat = setInterval(() => {
    writeEvent(res, 'heartbeat', { at: Date.now() });
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
  });
});

app.get('/api/export-csv', async (req, res) => {
  try {
    await refreshCache(req.query.force === '1');
    const data = getRawData();
    const header = [
      '姓名',
      '手机号',
      '部门',
      '完成题数',
      ...DIMENSIONS.map((theme) => theme.name),
      '总分',
      ...FIELD_NAMES,
    ];

    const rows = data.people.map((person) => [
      person.name,
      person.phone,
      person.department,
      person.completedCount,
      ...person.themes.map((theme) => theme.total),
      person.totalScore,
      ...FIELD_NAMES.map((_, idx) => person.scores[idx] ?? ''),
    ]);

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-skill-scoreboard.csv');
    res.send(csv);
  } catch (error) {
    console.error('[export failed]', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await refreshCache(false);
    res.json({ ok: true, stats: getDashboardData().stats });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

setInterval(() => {
  broadcastIfChanged(true);
}, LIVE_POLL_MS).unref();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[lark-survey-scoreboard] server ready: http://localhost:${PORT}`);
  console.log(`survey:    ${FORM_URL}`);
  console.log(`dashboard: http://localhost:${PORT}/dashboard.html`);
});

module.exports = app;
