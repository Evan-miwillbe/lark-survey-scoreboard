const fs = require('fs');
const path = require('path');

const BASE_TOKEN = process.env.FEISHU_BASE_TOKEN || 'your_base_token';
const TABLE_ID = process.env.FEISHU_TABLE_ID || 'your_table_id';

const API_BASE = 'https://open.feishu.cn';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const CONFIG_PATH = path.join(require('os').homedir(), '.lark-cli/config.json');
const SECRET_PATH = path.join(require('os').homedir(), '.lark-cli/appsecret.txt');

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
    throw new Error(`updateRecord error: ${data.code} ${data.msg}`);
  }

  const rec = data.data && data.data.record;
  return { record_id: rec.record_id, fields: rec.fields };
}

module.exports = {
  init, ensureInit,
  listAllRecords, createRecord, updateRecord,
};
