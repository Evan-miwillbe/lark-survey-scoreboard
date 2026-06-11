const config = require('./survey-config.json');

const QUESTIONS = config.questions.map((question) => question.text);
const QUESTION_DEFS = config.questions;
const THEMES = config.themes;
const DIMENSIONS = THEMES.map((theme) => ({
  id: theme.id,
  number: theme.number,
  name: theme.label || `${theme.number} ${theme.name}`,
  shortName: theme.name,
  questionIndices: theme.questionIndices,
  questionNumbers: theme.questionNumbers,
}));
const FIELD_NAMES = QUESTION_DEFS.map((question) => question.field);
const IDENTITY_FIELDS = config.identityFields;
const META_FIELDS = config.metaFields || {};
const SCORE_MIN = config.scoreMin || 1;
const SCORE_MAX = config.scoreMax || 10;
const FORM_URL = config.formUrl || config.baseUrl || '';

module.exports = {
  config,
  QUESTIONS,
  QUESTION_DEFS,
  THEMES,
  DIMENSIONS,
  FIELD_NAMES,
  IDENTITY_FIELDS,
  META_FIELDS,
  SCORE_MIN,
  SCORE_MAX,
  FORM_URL,
};
