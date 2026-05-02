const express = require('express');
const path = require('path');
const feishu = require('./feishu');
const { cache, setScore, getPersonScores, getDashboardData, getRawData, getRecordId, loadFromRecords } = require('./cache');
const { FIELD_NAMES, QUESTIONS, DIMENSIONS } = require('./questions');

const app = express();
const PORT = process.env.FC_SERVER_PORT || process.env.PORT || 3000;
const CACHE_TTL = 5000;

app.use(express.json());

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

const NAME_FIELD = process.env.NAME_FIELD || '您的姓名';
const DEPT_FIELD = process.env.DEPT_FIELD || '部门名称';

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

app.get('/api/questions', (req, res) => {
  res.json({
    questions: QUESTIONS,
    dimensions: DIMENSIONS.map(d => ({ name: d.name, questionIndices: d.questionIndices }))
  });
});

app.get('/api/dashboard', async (req, res) => {
  await ensureCache();
  res.json(getDashboardData());
});

app.get('/api/rawdata', async (req, res) => {
  await ensureCache();
  res.json(getRawData());
});

app.get('/api/export-csv', async (req, res) => {
  await ensureCache();
  const data = getRawData();
  const BOM = '﻿';
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
  console.log(`[lark-survey-scoreboard] 服务器已启动: http://localhost:${listenPort}`);
  console.log(`  手机评分页: http://localhost:${listenPort}/rating.html`);
  console.log(`  大屏展示页: http://localhost:${listenPort}/dashboard.html`);
});

module.exports = app;
