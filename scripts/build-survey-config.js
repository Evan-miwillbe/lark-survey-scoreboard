require('../src/env').loadEnv();

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_TOKEN = process.env.FEISHU_BASE_TOKEN || 'STIKbVfxvaxd4PsvdBKcaQTKnFe';
const TABLE_ID = process.env.FEISHU_TABLE_ID || 'tbl2uUjvQ4MochWh';
const FORM_ID = process.env.FEISHU_FORM_ID || 'vewohSG9xB';
const BASE_URL = process.env.FEISHU_BASE_URL || `https://tcnalhaufj4o.feishu.cn/base/${BASE_TOKEN}`;
const FORM_URL = process.env.FEISHU_FORM_URL || `${BASE_URL}?table=${TABLE_ID}&view=${FORM_ID}`;
const CLI_RUNNER = process.env.LARK_CLI_RUNNER
  || 'C:/Users/Tengm/AppData/Roaming/npm/node_modules/@larksuite/cli/scripts/run.js';

const themes = [
  ['目标明确', [1, 13, 25, 37, 49, 61, 73, 85, 97, 109]],
  ['渴望成功', [2, 14, 26, 38, 50, 62, 74, 86, 98, 110]],
  ['情商', [3, 15, 27, 39, 51, 63, 75, 87, 99, 111]],
  ['社交能力', [4, 16, 28, 40, 52, 64, 76, 88, 100, 112]],
  ['访前计划', [5, 17, 29, 41, 53, 65, 77, 89, 101, 113]],
  ['接近客户', [6, 18, 30, 42, 54, 66, 78, 90, 102, 114]],
  ['面谈', [7, 19, 31, 43, 55, 67, 79, 91, 103, 115]],
  ['演示', [8, 20, 32, 44, 56, 68, 80, 92, 104, 116]],
  ['验证', [9, 21, 33, 45, 57, 69, 81, 93, 105, 117]],
  ['磋商', [10, 22, 34, 46, 58, 70, 82, 94, 106, 118]],
  ['成交', [11, 23, 35, 47, 59, 71, 83, 95, 107, 119]],
  ['访后分析', [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]],
];

function runLark(args) {
  const output = execFileSync(process.execPath, [CLI_RUNNER, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function main() {
  const formData = runLark([
    'base',
    '+form-questions-list',
    '--base-token',
    BASE_TOKEN,
    '--table-id',
    TABLE_ID,
    '--form-id',
    FORM_ID,
    '--as',
    'user',
  ]);

  const allQuestions = formData.data.questions || [];
  const scoreQuestions = allQuestions.filter((question) => question.type === 'number');
  if (scoreQuestions.length !== 120) {
    throw new Error(`Expected 120 scoring questions, found ${scoreQuestions.length}`);
  }

  const titleByText = new Map(allQuestions.map((question) => [question.title, question]));
  for (const requiredTitle of ['部门名称', '您的姓名', '手机号']) {
    if (!titleByText.has(requiredTitle)) {
      throw new Error(`Missing identity question: ${requiredTitle}`);
    }
  }

  const config = {
    title: '诚信销售技能盘点清单',
    baseToken: BASE_TOKEN,
    tableId: TABLE_ID,
    formId: FORM_ID,
    baseUrl: BASE_URL,
    formUrl: FORM_URL,
    scoreMin: 1,
    scoreMax: 10,
    identityFields: {
      department: '部门名称',
      name: '您的姓名',
      phone: '手机号',
    },
    questions: scoreQuestions.map((question, index) => ({
      id: question.id,
      field: question.title,
      number: index + 1,
      text: question.title,
      required: question.required === true,
    })),
    themes: themes.map(([name, questionNumbers], index) => ({
      id: `theme${String(index + 1).padStart(2, '0')}`,
      number: index + 1,
      name,
      label: `${index + 1} ${name}`,
      questionNumbers,
      questionIndices: questionNumbers.map((number) => number - 1),
    })),
    generatedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, '..', 'src', 'survey-config.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main();
