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

  const NAME_FIELD = process.env.NAME_FIELD || '您的姓名';
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
