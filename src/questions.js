// 题目配置 — 修改此文件适配你的问卷
// QUESTIONS: 题目文本数组，必须与飞书 Base 中的字段名一致
// DIMENSIONS: 维度��称 + 对应题目索引

const QUESTIONS = [
  '示例题目1：沟通表达清晰',
  '示例题目2：主动倾听他人',
  '示例题目3：团队协作意识',
  '示例题目4：解决问题能力',
  '示例题目5：创新思维',
  '示例题目6：执行力',
];

const DIMENSIONS = [
  { name: '沟通能力', questionIndices: [0, 1] },
  { name: '团队协作', questionIndices: [2, 3] },
  { name: '个人能力', questionIndices: [4, 5] },
];

const FIELD_NAMES = QUESTIONS;

module.exports = { QUESTIONS, DIMENSIONS, FIELD_NAMES };
