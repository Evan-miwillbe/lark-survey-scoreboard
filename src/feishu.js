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

module.exports = {
  init,
  ensureInit,
  listAllRecords,
};
