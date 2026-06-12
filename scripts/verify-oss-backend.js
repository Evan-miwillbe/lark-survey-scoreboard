require('../src/env').loadEnv();
process.env.DATA_BACKEND = 'oss';

const dataClient = require('../src/data-client');
const { FIELD_NAMES } = require('../src/questions');

async function main() {
  if (dataClient.backend !== 'oss') {
    throw new Error(`DATA_BACKEND must be oss, got ${dataClient.backend}`);
  }

  await dataClient.ensureInit();

  if (process.argv.includes('--write')) {
    const record = await dataClient.createRecord({
      '您的姓名': `OSS验证_${Date.now()}`,
      '手机号': '00000000000',
      '部门名称': '系统验证',
    });
    await dataClient.updateRecord(record.record_id, { [FIELD_NAMES[0]]: 10 });
  }

  const records = await dataClient.listAllRecords();
  console.log(JSON.stringify({ ok: true, backend: dataClient.backend, count: records.length }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
