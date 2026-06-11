require('./env').loadEnv();

const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_TOKEN = process.env.FEISHU_BASE_TOKEN || '';
const TABLE_ID = process.env.FEISHU_TABLE_ID || '';
const API_BASE = 'https://open.feishu.cn';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const CONFIG_PATH = path.join(os.homedir(), '.lark-cli', 'config.json');
const SECRET_PATH = path.join(os.homedir(), '.lark-cli', 'appsecret.txt');

let appId = '';
let appSecret = '';
let tenantAccessToken = '';
let tokenExpiresAt = 0;
let initialized = false;
let userAccessToken = '';

function readCredentials() {
  appId = process.env.FEISHU_APP_ID || '';
  appSecret = process.env.FEISHU_APP_SECRET || '';

  if (appId && appSecret) return;

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const app = config.apps && config.apps[0];
    if (app && app.appId) appId = app.appId;
    if (!appSecret) appSecret = fs.readFileSync(SECRET_PATH, 'utf8').trim();
  } catch (e) {
    throw new Error('Unable to read Feishu credentials. Run lark-cli login or set FEISHU_APP_ID/FEISHU_APP_SECRET.');
  }

  if (!appId || !appSecret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET.');
  }
}

function ensureBaseConfig() {
  if (!BASE_TOKEN || !TABLE_ID) {
    throw new Error('Missing FEISHU_BASE_TOKEN or FEISHU_TABLE_ID.');
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
    throw new Error(`tenant_access_token failed: code=${data.code}, msg=${data.msg}`);
  }

  tenantAccessToken = data.tenant_access_token;
  tokenExpiresAt = Date.now() + data.expire * 1000;
}

async function ensureToken() {
  // Prefer user access token if provided (has user-level permissions)
  userAccessToken = process.env.FEISHU_USER_ACCESS_TOKEN || '';
  if (userAccessToken) {
    tenantAccessToken = userAccessToken;
    return;
  }
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
      Authorization: `Bearer ${tenantAccessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  let res = await fetch(fullUrl, options);
  let data = await res.json();

  if (res.status === 401 || data.code === 99991663 || data.code === 99991668) {
    await fetchTenantAccessToken();
    options.headers.Authorization = `Bearer ${tenantAccessToken}`;
    res = await fetch(fullUrl, options);
    data = await res.json();
  }

  return data;
}

async function init() {
  if (initialized) return;
  ensureBaseConfig();
  readCredentials();
  await fetchTenantAccessToken();
  initialized = true;
}

async function ensureInit() {
  if (!initialized) await init();
  await ensureToken();
}

function normalizeRecord(item) {
  return {
    record_id: item.record_id,
    fields: item.fields || {},
    created_time: item.created_time,
    last_modified_time: item.last_modified_time,
    created_by: item.created_by,
    last_modified_by: item.last_modified_by,
  };
}

async function listAllRecords() {
  const allRecords = [];
  let pageToken;

  do {
    let url = `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records?page_size=500`;
    if (pageToken) url += `&page_token=${encodeURIComponent(pageToken)}`;

    const data = await apiRequest('GET', url);
    if (data.code !== 0) {
      throw new Error(`list records failed: code=${data.code}, msg=${data.msg}`);
    }

    const items = (data.data && data.data.items) || [];
    for (const item of items) allRecords.push(normalizeRecord(item));

    const hasMore = data.data && data.data.has_more;
    pageToken = hasMore ? data.data.page_token : undefined;
  } while (pageToken);

  return allRecords;
}

// ── Lark-CLI fallback (for local dev when tenant token lacks write scope) ──
const childProcess = require('child_process');
const LARK_CLI_RUN = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@larksuite', 'cli', 'scripts', 'run.js');

function larkCliAvailable() {
  try {
    childProcess.execFileSync('node', [LARK_CLI_RUN, '--version'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

function larkCliJson(args, input) {
  let tmpPath = '';
  try {
    if (input) {
      tmpPath = path.join(process.cwd(), `_lk_${Date.now()}.json`);
      fs.writeFileSync(tmpPath, input, 'utf8');
      const jsonIdx = args.indexOf('--json');
      if (jsonIdx !== -1) {
        const relName = path.basename(tmpPath);
        args[jsonIdx + 1] = `@${relName}`;
      }
    }
    const result = childProcess.spawnSync('node', [LARK_CLI_RUN, ...args], {
      encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error) throw result.error;
    if (result.stderr) console.warn('[lark-cli]', result.stderr.slice(0, 200));
    return JSON.parse(result.stdout);
  } finally {
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ } }
  }
}

async function createRecord(fields) {
  await ensureInit();
  try {
    const data = await apiRequest('POST',
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records`,
      { fields }
    );
    if (data.code !== 0) {
      if (data.code === 91403 && larkCliAvailable()) {
        // Fall back to lark-cli
        const json = JSON.stringify(fields);
        const result = larkCliJson(['base', '+record-upsert', '--base-token', BASE_TOKEN, '--table-id', TABLE_ID, '--json', json]);
        if (result.ok) {
          return { record_id: result.data.record.record_id_list[0], fields, created: result.data.created };
        }
        throw new Error(`lark-cli upsert failed: ${JSON.stringify(result.error || result)}`);
      }
      throw new Error(`create record failed: code=${data.code}, msg=${data.msg}`);
    }
    return data.data.record;
  } catch (e) {
    if (e.message.includes('create record failed') || e.message.includes('lark-cli')) throw e;
    if (larkCliAvailable()) {
      const json = JSON.stringify(fields);
      const result = larkCliJson(['base', '+record-upsert', '--base-token', BASE_TOKEN, '--table-id', TABLE_ID, '--json', json]);
      if (result.ok) {
        return { record_id: result.data.record.record_id_list[0], fields, created: result.data.created };
      }
    }
    throw e;
  }
}

async function updateRecord(recordId, fields) {
  await ensureInit();
  try {
    const data = await apiRequest('PUT',
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      { fields }
    );
    if (data.code !== 0) {
      if (data.code === 91403 && larkCliAvailable()) {
        const json = JSON.stringify(fields);
        const result = larkCliJson(['base', '+record-upsert', '--base-token', BASE_TOKEN, '--table-id', TABLE_ID, '--record-id', recordId, '--json', json]);
        if (result.ok) return result.data.record;
        throw new Error(`lark-cli upsert failed: ${JSON.stringify(result.error || result)}`);
      }
      throw new Error(`update record failed: code=${data.code}, msg=${data.msg}`);
    }
    return data.data.record;
  } catch (e) {
    if (e.message.includes('update record failed') || e.message.includes('lark-cli')) throw e;
    if (larkCliAvailable()) {
      const json = JSON.stringify(fields);
      const result = larkCliJson(['base', '+record-upsert', '--base-token', BASE_TOKEN, '--table-id', TABLE_ID, '--record-id', recordId, '--json', json]);
      if (result.ok) return result.data.record;
    }
    throw e;
  }
}

async function searchRecord(fieldName, value) {
  await ensureInit();
  const filter = `CurrentValue.[${fieldName}]="${value.replace(/"/g, '\\"')}"`;
  const url = `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records?page_size=10&filter=${encodeURIComponent(filter)}`;
  const data = await apiRequest('GET', url);
  if (data.code !== 0) {
    throw new Error(`search record failed: code=${data.code}, msg=${data.msg}`);
  }
  const items = (data.data && data.data.items) || [];
  return items.map(normalizeRecord);
}

async function getRecord(recordId) {
  await ensureInit();
  const data = await apiRequest('GET',
    `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`
  );
  if (data.code !== 0) {
    throw new Error(`get record failed: code=${data.code}, msg=${data.msg}`);
  }
  return normalizeRecord(data.data.record);
}

module.exports = {
  init,
  ensureInit,
  listAllRecords,
  createRecord,
  updateRecord,
  searchRecord,
  getRecord,
};
