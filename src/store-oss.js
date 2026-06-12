require('./env').loadEnv();

const OSS = require('ali-oss');

const REGION = process.env.OSS_REGION || '';
const BUCKET = process.env.OSS_BUCKET || '';
const OBJECT_KEY = process.env.OSS_OBJECT || 'survey-data.json';

let client = null;
let initialized = false;
let writeQueue = Promise.resolve();

function now() {
  return Date.now();
}

function createRecordId() {
  return `oss_${now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function firstEnv(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function makeClientConfig() {
  if (!REGION || !BUCKET) {
    throw new Error('Missing OSS_REGION or OSS_BUCKET.');
  }

  const config = {
    region: REGION,
    bucket: BUCKET,
  };

  const accessKeyId = firstEnv(['OSS_ACCESS_KEY_ID', 'ALIBABA_CLOUD_ACCESS_KEY_ID', 'ALICLOUD_ACCESS_KEY_ID', 'accessKeyID']);
  const accessKeySecret = firstEnv(['OSS_ACCESS_KEY_SECRET', 'ALIBABA_CLOUD_ACCESS_KEY_SECRET', 'ALICLOUD_ACCESS_KEY_SECRET', 'accessKeySecret']);
  const stsToken = firstEnv(['OSS_STS_TOKEN', 'ALIBABA_CLOUD_SECURITY_TOKEN', 'ALICLOUD_SECURITY_TOKEN', 'SECURITY_TOKEN', 'securityToken']);

  if (accessKeyId && accessKeySecret) {
    config.accessKeyId = accessKeyId;
    config.accessKeySecret = accessKeySecret;
    if (stsToken) config.stsToken = stsToken;
  }

  return config;
}

async function init() {
  if (initialized) return;
  client = new OSS(makeClientConfig());
  initialized = true;
}

async function ensureInit() {
  await init();
}

function emptyStore() {
  return { version: 1, records: {} };
}

function normalizeStore(data) {
  if (!data || typeof data !== 'object') return emptyStore();
  const records = data.records && typeof data.records === 'object' ? data.records : {};
  return { version: data.version || 1, records };
}

async function readStore() {
  await ensureInit();
  try {
    const result = await client.get(OBJECT_KEY);
    const text = Buffer.isBuffer(result.content)
      ? result.content.toString('utf8')
      : String(result.content || '');
    if (!text.trim()) return emptyStore();
    return normalizeStore(JSON.parse(text));
  } catch (error) {
    const status = error.status || error.statusCode;
    const code = error.code || error.name;
    if (status === 404 || code === 'NoSuchKey' || code === 'NoSuchBucket') {
      return emptyStore();
    }
    throw error;
  }
}

async function writeStore(store) {
  await ensureInit();
  const body = Buffer.from(JSON.stringify(normalizeStore(store), null, 2), 'utf8');
  await client.put(OBJECT_KEY, body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cloneRecord(record) {
  return {
    ...record,
    fields: { ...(record.fields || {}) },
  };
}

function recordsArray(store) {
  return Object.values(store.records || {}).map(cloneRecord);
}

async function mutateStore(mutator) {
  const run = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await writeStore(store);
    return result;
  });

  writeQueue = run.catch(() => {});
  return run;
}

async function listAllRecords() {
  const store = await readStore();
  return recordsArray(store);
}

async function createRecord(fields) {
  return mutateStore(async (store) => {
    const timestamp = now();
    const recordId = createRecordId();
    const record = {
      record_id: recordId,
      fields: { ...(fields || {}) },
      created_time: timestamp,
      last_modified_time: timestamp,
    };
    store.records[recordId] = record;
    return cloneRecord(record);
  });
}

async function updateRecord(recordId, fields) {
  if (!recordId) throw new Error('Missing recordId.');

  return mutateStore(async (store) => {
    const record = store.records[recordId];
    if (!record) throw new Error(`record not found: ${recordId}`);

    record.fields = { ...(record.fields || {}), ...(fields || {}) };
    record.last_modified_time = now();
    return cloneRecord(record);
  });
}

async function searchRecord(fieldName, value) {
  const store = await readStore();
  const target = String(value ?? '').trim();
  return recordsArray(store).filter((record) => String(record.fields?.[fieldName] ?? '').trim() === target);
}

async function getRecord(recordId) {
  const store = await readStore();
  const record = store.records[recordId];
  if (!record) throw new Error(`record not found: ${recordId}`);
  return cloneRecord(record);
}

async function clearAllRecords() {
  return mutateStore(async (store) => {
    store.records = {};
    return { ok: true };
  });
}

module.exports = {
  init,
  ensureInit,
  listAllRecords,
  createRecord,
  updateRecord,
  searchRecord,
  getRecord,
  clearAllRecords,
};
