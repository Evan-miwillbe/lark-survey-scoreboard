/**
 * 从飞书妙记自动生成评分问卷
 *
 * 流程：读取妙记内容 → AI分析主题/模块 → 生成评分维度和题目 → 创建Base+表单+大屏
 *
 * 用法：
 *   node src/generate-from-minutes.js <妙记URL或ID>
 *   或在 Claude Code 中说："根据这场培训的妙记生成评分问卷"
 *
 * 依赖：lark-cli 已安装并登录
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (e) {
    console.error(`命令执行���败: ${cmd}`);
    console.error(e.stderr || e.message);
    return null;
  }
}

function extractMinutesId(input) {
  const match = input.match(/minutes\/([a-z0-9]+)/);
  return match ? match[1] : input;
}

async function getMinutesContent(minutesId) {
  console.log(`[1/5] 读取飞书妙记: ${minutesId}`);

  const result = run(`lark-cli vc +minutes-get --minutes-id ${minutesId}`);
  if (!result) {
    throw new Error('无法读取妙记，请检查妙记ID和权限');
  }

  let parsed;
  try {
    parsed = JSON.parse(result);
  } catch {
    parsed = { title: '未知会议', content: result };
  }

  return {
    title: parsed.title || parsed.topic || '培训评估',
    content: parsed.transcript || parsed.content || result,
    participants: parsed.participants || []
  };
}

function analyzeAndGenerateQuestions(title, content) {
  console.log('[2/5] AI分析内容，生成评分维度和题目...');

  const prompt = `你是一位专业的培训评估设计师。你的任务是根据一场培训/分享的实际内容，设计出针对性强、可操作的评分问卷。

## 你的工作流程

**第一步：内容分析**
仔细阅读会议记录，识别：
- 讲了哪几个核心主题/模块？（这些将成为评分维度）
- 每个主题中有哪些具体的知识点、演示、操作、观点？（这些将成为评分依据）
- 这场会议的类型是什么？（培训教学/经验分享/产品演示/讨论会议）

**第二步：设计维度**
根据实际内容提取 3-6 个评分维度。维度必须来源于内容本身，不能是通用模板。

好的维度示例（基于内容）：
- "飞书CLI安装教学" — 如果讲师花了大量时间教安装
- "实战案例质量" — 如果分享了多个实际案例
- "互动答疑" — 如果有大量互动环节

差的维度示例（通用模板）：
- "内容质量" — 太泛，任何培训都能用
- "讲师表现" — 没有和具体内容挂钩

**第三步：设计题目**
每个维度 2-4 道题。题目必须满足：
1. **具体性**：提到实际讲过的内容。"讲师对XX的讲解是否易懂" 好于 "讲解是否清晰"
2. **可区分性**：同一维度内的题目评分应该可能不同（测量不同侧面）
3. **可操作性**：低分能指向具体改进方向
4. **中性表述**：不暗示应该打高分或低分

好的题目示例：
- "AJ 演示的日历分析仪表盘案例，对你理解 CLI 能力有多大帮助"
- "安装环节的步骤说明是否足够清晰，让你能独立完成"
- "分享的视频长剪短功能，你在实际工作中用得上的可能性"

差的题目示例：
- "内容是否有用" — 太模糊
- "讲师是否专业" — 无法指导改进
- "你是否满意" — 一题概括所有

## 输入信息

会议主题：${title}
会议内容（文字记录）：
${content.substring(0, 3000)}

## 输出要求

严格输出以下 JSON 格式，不要输出任何其他文字：

{"dimensions":[{"name":"维度名(2-6字)","questions":["具体评分题目1","具体评分题目2","具体评分题目3"]}]}`;

  const tempFile = path.join(require('os').tmpdir(), 'survey-prompt.txt');
  fs.writeFileSync(tempFile, prompt);

  const aiResult = run(`cat "${tempFile}" | lark-cli ai +chat 2>/dev/null || echo "FALLBACK"`);

  if (!aiResult || aiResult === 'FALLBACK') {
    console.log('  AI分析不可用，使用基于标题的默认模板');
    return generateDefaultQuestions(title);
  }

  try {
    const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.dimensions && result.dimensions.length > 0) {
        return result;
      }
    }
  } catch (e) {
    console.log('  JSON解析失败，使用默认模板');
  }

  return generateDefaultQuestions(title);
}

function generateDefaultQuestions(title) {
  return {
    dimensions: [
      {
        name: '内容质量',
        questions: [
          '内容的实用性和可操作性',
          '内容的深度和专业性',
          '案例和示例的质量'
        ]
      },
      {
        name: '讲解能力',
        questions: [
          '讲解的清晰程度',
          '节奏把控和时间分配',
          '互动和答疑的质量'
        ]
      },
      {
        name: '学习收获',
        questions: [
          '对我的工作/学习的帮助程度',
          '激发了新的思考或想法',
          '会推荐给同事/朋友'
        ]
      }
    ]
  };
}

function createSurveySystem(title, questionsData) {
  console.log('[3/5] 创建飞书Base + 表单...');

  const surveyName = `${title} - 反馈评估`;

  // 创建 Base
  const baseResult = run(`lark-cli base +base-create --name "${surveyName}"`);
  const baseToken = extractToken(baseResult, 'app_token');
  if (!baseToken) throw new Error('创建Base失败');
  console.log(`  Base Token: ${baseToken}`);

  // 获取表ID
  const tableResult = run(`lark-cli base +table-list --base-token ${baseToken}`);
  const tableId = extractToken(tableResult, 'table_id') || extractPattern(tableResult, /tbl[A-Za-z0-9]+/);
  if (!tableId) throw new Error('获取表ID失败');

  // 创建表单
  const formResult = run(`lark-cli base +form-create --base-token ${baseToken} --table-id ${tableId} --name "${surveyName}" --description "请根据您的体验，给以下各项打分（1-10分）。\\n1分=完全不满意，10分=非常满意"`);
  const formId = extractToken(formResult, 'form_id');

  // 添加姓名题
  run(`lark-cli base +form-questions-create --base-token ${baseToken} --table-id ${tableId} --form-id ${formId} --questions '[{"type":"text","title":"您的姓名","required":true}]'`);

  // 逐条添加评分题
  const allQuestions = [];
  for (const dim of questionsData.dimensions) {
    for (const q of dim.questions) {
      allQuestions.push(q);
      run(`lark-cli base +form-questions-create --base-token ${baseToken} --table-id ${tableId} --form-id ${formId} --questions '[{"type":"number","title":"${q}","required":true,"style":{"type":"rating","icon":"number","min":1,"max":10}}]'`);
      console.log(`  + [${dim.name}] ${q}`);
    }
  }

  return { baseToken, tableId, formId, surveyName, allQuestions, dimensions: questionsData.dimensions };
}

function createDashboard(config) {
  console.log('[4/5] 创建仪表盘...');

  const { baseToken, dimensions } = config;

  const dashResult = run(`lark-cli base +dashboard-create --base-token ${baseToken} --name "${config.surveyName} 看板"`);
  const dashId = extractToken(dashResult, 'dashboard_id') || extractPattern(dashResult, /blk[A-Za-z0-9]+/);

  if (dashId) {
    // 指标卡
    run(`lark-cli base +dashboard-block-create --base-token ${baseToken} --dashboard-id ${dashId} --name "参与人数" --type statistics --data-config '{"table_name":"数据表","count_all":true}'`);

    // 每个维度一个条形图
    for (const dim of dimensions) {
      const series = dim.questions.map(q => `{"field_name":"${q}","rollup":"AVERAGE"}`).join(',');
      run(`lark-cli base +dashboard-block-create --base-token ${baseToken} --dashboard-id ${dashId} --name "${dim.name}" --type bar --data-config '{"table_name":"数据表","series":[${series}]}' --no-validate`);
    }

    run(`lark-cli base +dashboard-arrange --base-token ${baseToken} --dashboard-id ${dashId}`);
  }

  return dashId;
}

function generateQuestionsConfig(config) {
  console.log('[5/5] 生成项目配置文件...');

  const questionsJs = `// 自动生成 — 来自妙记: ${config.surveyName}
const QUESTIONS = ${JSON.stringify(config.allQuestions, null, 2)};

const DIMENSIONS = ${JSON.stringify(
    config.dimensions.map((d, i) => {
      const startIdx = config.dimensions.slice(0, i).reduce((sum, dd) => sum + dd.questions.length, 0);
      return {
        name: d.name,
        questionIndices: d.questions.map((_, j) => startIdx + j)
      };
    }), null, 2)};

const FIELD_NAMES = QUESTIONS;

module.exports = { QUESTIONS, DIMENSIONS, FIELD_NAMES };
`;

  const outputPath = path.join(__dirname, 'questions.js');
  fs.writeFileSync(outputPath, questionsJs);
  console.log(`  配置已写入: ${outputPath}`);
}

function extractToken(text, key) {
  if (!text) return null;
  const regex = new RegExp(`${key}["\s:]+([A-Za-z0-9_]+)`);
  const match = text.match(regex);
  return match ? match[1] : null;
}

function extractPattern(text, pattern) {
  if (!text) return null;
  const match = text.match(pattern);
  return match ? match[0] : null;
}

// ===== 主流程 =====
async function main() {
  const input = process.argv[2];
  if (!input) {
    console.log('用法: node src/generate-from-minutes.js <妙记URL或ID>');
    console.log('示例: node src/generate-from-minutes.js https://bytedance.larkoffice.com/minutes/obcnrz7a5ad1yu71n73u44r3');
    process.exit(1);
  }

  const minutesId = extractMinutesId(input);

  try {
    // Step 1: 读取妙记
    const minutes = await getMinutesContent(minutesId);
    console.log(`  标题: ${minutes.title}`);
    console.log(`  参会人: ${minutes.participants.length || '未知'}人`);

    // Step 2: AI分析生成题目
    const questionsData = analyzeAndGenerateQuestions(minutes.title, minutes.content);
    const totalQ = questionsData.dimensions.reduce((s, d) => s + d.questions.length, 0);
    console.log(`  生成: ${questionsData.dimensions.length}个维度, ${totalQ}道题`);

    // Step 3: 创建飞书系统
    const config = createSurveySystem(minutes.title, questionsData);

    // Step 4: 创建仪表盘
    createDashboard(config);

    // Step 5: 生成配置文件
    generateQuestionsConfig(config);

    // 输出结果
    console.log('\n========================================');
    console.log('🎉 评分系统创建完成！');
    console.log('========================================');
    console.log(`\n飞书配置:`);
    console.log(`  FEISHU_BASE_TOKEN=${config.baseToken}`);
    console.log(`  FEISHU_TABLE_ID=${config.tableId}`);
    console.log(`\n启动服务:`);
    console.log(`  npm start`);
    console.log(`\n访问地址:`);
    console.log(`  手机评分: http://localhost:3000/rating.html`);
    console.log(`  大屏看板: http://localhost:3000/dashboard.html`);

    if (minutes.participants.length > 0) {
      console.log(`\n参会人(可发送问卷链接):`);
      minutes.participants.slice(0, 10).forEach(p => console.log(`  - ${p.name || p}`));
    }

  } catch (e) {
    console.error(`\n❌ 错误: ${e.message}`);
    process.exit(1);
  }
}

main();
