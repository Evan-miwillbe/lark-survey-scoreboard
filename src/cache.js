const {
  config,
  DIMENSIONS,
  FIELD_NAMES,
  IDENTITY_FIELDS,
  SCORE_MAX,
} = require('./questions');

const TOTAL_QUESTIONS = FIELD_NAMES.length;

const cache = {
  people: new Map(),
  questionStats: [],
  dimensionStats: [],
  stats: emptyStats(),
};

function emptyStats() {
  return {
    totalSubmissions: 0,
    totalRegistered: 0,
    totalCompleted: 0,
    totalRatings: 0,
    duplicateSubmissions: 0,
    ignoredSubmissions: 0,
    totalQuestions: TOTAL_QUESTIONS,
    totalThemes: DIMENSIONS.length,
    overallAverage: 0,
    lastUpdate: null,
  };
}

function fieldText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(fieldText).join('');
  }
  if (typeof value === 'object') {
    if (value.text !== undefined) return fieldText(value.text);
    if (value.name !== undefined) return fieldText(value.name);
    if (value.value !== undefined) return fieldText(value.value);
    if (value.en_name !== undefined) return fieldText(value.en_name);
    return '';
  }
  return String(value);
}

function normalizeName(name) {
  return fieldText(name).trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  return fieldText(phone).trim().replace(/[^\d+]/g, '');
}

function makeIdentityKey(name, phone) {
  return `${normalizeName(name).toLowerCase()}|${normalizePhone(phone)}`;
}

function recordIdentityKey(name, phone, recordId) {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) return makeIdentityKey(normalizedName, normalizedPhone);
  return `${normalizedName.toLowerCase()}|record:${recordId}`;
}

function toScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > SCORE_MAX) return null;
  return score;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function timestampToIso(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = fieldText(value).trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric) && text !== '') {
    const ms = numeric > 999999999999 ? numeric : numeric * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return text;
}

function emptyPerson(key, name, phone, recordId = '') {
  return {
    key,
    department: '',
    name: normalizeName(name),
    phone: normalizePhone(phone),
    recordId,
    scores: new Map(),
    completedCount: 0,
    lastSubmittedAt: '',
  };
}

function pickNewer(a, b) {
  const ta = Date.parse(a.lastSubmittedAt || '');
  const tb = Date.parse(b.lastSubmittedAt || '');
  if (Number.isFinite(ta) && Number.isFinite(tb)) return tb >= ta ? b : a;
  if (Number.isFinite(tb)) return b;
  if (b.completedCount !== a.completedCount) return b.completedCount > a.completedCount ? b : a;
  return b.recordId > a.recordId ? b : a;
}

function personFromRecord(record) {
  const fields = record.fields || {};
  const name = normalizeName(fields[IDENTITY_FIELDS.name]);
  const phone = normalizePhone(fields[IDENTITY_FIELDS.phone]);
  if (!name) return null;

  const key = recordIdentityKey(name, phone, record.record_id);
  const person = emptyPerson(key, name, phone, record.record_id);
  person.department = normalizeName(fields[IDENTITY_FIELDS.department]);
  person.lastSubmittedAt = timestampToIso(
    record.last_modified_time || record.modified_time || record.created_time || record.created_at
  );

  for (let i = 0; i < TOTAL_QUESTIONS; i += 1) {
    const score = toScore(fields[FIELD_NAMES[i]]);
    if (score !== null) person.scores.set(i, score);
  }

  person.completedCount = person.scores.size;
  return person;
}

function loadFromRecords(records) {
  cache.people.clear();

  let validSubmissions = 0;
  let ignoredSubmissions = 0;

  for (const record of records || []) {
    const person = personFromRecord(record);
    if (!person) {
      ignoredSubmissions += 1;
      continue;
    }

    validSubmissions += 1;
    const existing = cache.people.get(person.key);
    cache.people.set(person.key, existing ? pickNewer(existing, person) : person);
  }

  recalcAll(validSubmissions, ignoredSubmissions);
}

function buildThemeScores(scores) {
  return DIMENSIONS.map((theme) => {
    let total = 0;
    let answered = 0;

    for (const idx of theme.questionIndices) {
      const value = scores.get(idx);
      if (value !== undefined) {
        total += value;
        answered += 1;
      }
    }

    return {
      id: theme.id,
      number: theme.number,
      name: theme.name,
      shortName: theme.shortName,
      answered,
      questionCount: theme.questionIndices.length,
      total,
      fullScore: theme.questionIndices.length * SCORE_MAX,
      average: answered ? round2(total / answered) : 0,
    };
  });
}

function recalcAll(validSubmissions = 0, ignoredSubmissions = 0) {
  const people = Array.from(cache.people.values());
  let totalRatings = 0;
  let totalCompleted = 0;
  let totalScore = 0;

  cache.questionStats = FIELD_NAMES.map((field, index) => {
    let sum = 0;
    let count = 0;
    for (const person of people) {
      const value = person.scores.get(index);
      if (value !== undefined) {
        sum += value;
        count += 1;
      }
    }

    totalRatings += count;
    totalScore += sum;
    return {
      index,
      number: index + 1,
      field,
      text: field,
      average: count ? round2(sum / count) : 0,
      responseCount: count,
    };
  });

  for (const person of people) {
    if (person.scores.size === TOTAL_QUESTIONS) totalCompleted += 1;
  }

  cache.dimensionStats = DIMENSIONS.map((theme) => {
    let sum = 0;
    let count = 0;
    let participantCount = 0;
    let completedParticipantCount = 0;

    for (const person of people) {
      let answeredInTheme = 0;
      for (const idx of theme.questionIndices) {
        const value = person.scores.get(idx);
        if (value !== undefined) {
          sum += value;
          count += 1;
          answeredInTheme += 1;
        }
      }
      if (answeredInTheme > 0) participantCount += 1;
      if (answeredInTheme === theme.questionIndices.length) completedParticipantCount += 1;
    }

    return {
      id: theme.id,
      number: theme.number,
      name: theme.name,
      shortName: theme.shortName,
      questions: theme.questionIndices.map((idx) => cache.questionStats[idx]),
      average: count ? round2(sum / count) : 0,
      responseCount: count,
      participantCount,
      completedParticipantCount,
      fullScore: theme.questionIndices.length * SCORE_MAX,
    };
  });

  cache.stats = {
    totalSubmissions: validSubmissions + ignoredSubmissions,
    totalRegistered: people.length,
    totalCompleted,
    totalRatings,
    duplicateSubmissions: Math.max(0, validSubmissions - people.length),
    ignoredSubmissions,
    totalQuestions: TOTAL_QUESTIONS,
    totalThemes: DIMENSIONS.length,
    overallAverage: totalRatings ? round2(totalScore / totalRatings) : 0,
    lastUpdate: new Date().toISOString(),
  };
}

function publicPerson(person) {
  const themes = buildThemeScores(person.scores);
  const scores = {};
  for (const [idx, val] of person.scores) scores[idx] = val;

  const totalScore = themes.reduce((sum, theme) => sum + theme.total, 0);

  return {
    key: person.key,
    department: person.department,
    name: person.name,
    phone: person.phone,
    phoneTail: person.phone ? person.phone.slice(-4) : '',
    recordId: person.recordId,
    completedCount: person.scores.size,
    completionRate: TOTAL_QUESTIONS ? round2((person.scores.size / TOTAL_QUESTIONS) * 100) : 0,
    totalScore,
    averageScore: person.scores.size ? round2(totalScore / person.scores.size) : 0,
    fullScore: TOTAL_QUESTIONS * SCORE_MAX,
    lastSubmittedAt: person.lastSubmittedAt,
    scores,
    themes,
  };
}

function getPeople() {
  return Array.from(cache.people.values())
    .map(publicPerson)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.phone.localeCompare(b.phone));
}

function getDashboardData() {
  return {
    meta: {
      title: config.title,
      baseToken: config.baseToken,
      tableId: config.tableId,
      formId: config.formId,
      baseUrl: config.baseUrl,
      formUrl: config.formUrl,
      scoreMax: SCORE_MAX,
    },
    dimensions: cache.dimensionStats,
    questionStats: cache.questionStats,
    people: getPeople(),
    stats: cache.stats,
  };
}

function getRawData() {
  return {
    people: getPeople(),
    questions: FIELD_NAMES,
    dimensions: DIMENSIONS,
    stats: cache.stats,
  };
}

module.exports = {
  cache,
  loadFromRecords,
  makeIdentityKey,
  normalizeName,
  normalizePhone,
  getDashboardData,
  getRawData,
};
