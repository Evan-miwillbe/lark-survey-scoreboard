require('./env').loadEnv();

const backend = (process.env.DATA_BACKEND || 'feishu').toLowerCase();
const client = backend === 'oss' ? require('./store-oss') : require('./feishu');

module.exports = {
  backend,
  init: (...args) => (client.init ? client.init(...args) : client.ensureInit(...args)),
  ensureInit: (...args) => client.ensureInit(...args),
  listAllRecords: (...args) => client.listAllRecords(...args),
  createRecord: (...args) => client.createRecord(...args),
  updateRecord: (...args) => client.updateRecord(...args),
  searchRecord: (...args) => client.searchRecord(...args),
  getRecord: (...args) => client.getRecord(...args),
  clearAllRecords: (...args) => {
    if (!client.clearAllRecords) throw new Error(`Backend ${backend} does not support clearAllRecords.`);
    return client.clearAllRecords(...args);
  },
};
