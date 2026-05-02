/**
 * 评分完成后自动生成AI分析报告并写入飞书文档
 *
 * 流程：读取评分数据 → AI分析趋势和洞察 → 生成结构化报告 → 创建飞书文档
 *
 * 用法：
 *   node src/generate-report.js
 *   或在 Claude Code 中说："根据评分结果生成分析报告"
 *
 * 依赖：lark-cli 已安装并登录，服务器已运行（或直接读取飞书Base数据）
 */

const { execSync } = require('child_process');
const { QUESTIONS, DIMENSIONS, FIELD_NAMES } = require('./questions');

const PORT = process.env.PORT || 3000;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (e) {
    return null;
  }
}

async function fetchDashboardData() {
  try {
    const r = await fetch(`http://localhost:${PORT}/api/dashboard`);
    return await r.json();
  } catch {
    console.log('  服务器未运行，尝试直接读取飞书Base...');
    return null;
  }
}

async function fetchRawData() {
  try {
    const r = await fetch(`http://localhost:${PORT}/api/rawdata`);
    return await r.json();
  } catch {
    return null;
  }
}

function analyzeData(dashboard, raw) {
  const analysis = {
    overview: {},
    dimensionRanking: [],
    highlights: [],
    concerns: [],
    questionDetails: []
  };

  // 整体概览
  analysis.overview = {
    participants: dashboard.stats.totalRegistered,
    completed: dashboard.stats.totalCompleted,
    completionRate: dashboard.stats.totalRegistered > 0
      ? Math.round(dashboard.stats.totalCompleted / dashboard.stats.totalRegistered * 100)
      : 0,
    totalRatings: dashboard.stats.totalRatings
  };

  // 维度排名
  analysis.dimensionRanking = dashboard.dimensions.map(dim => {
    const scores = dim.questions.map(q => q.average).filter(v => v > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { name: dim.name, average: Math.round(avg * 100) / 100, questionCount: dim.questions.length };
  }).sort((a, b) => b.average - a.average);

  // 亮点（均分 >= 8）
  analysis.highlights = analysis.dimensionRanking.filter(d => d.average >= 8);

  // 关注点（均分 < 6）
  analysis.concerns = analysis.dimensionRanking.filter(d => d.average > 0 && d.average < 6);

  // 单题详情（找出最高和最低）
  const allQuestionScores = [];
  for (const dim of dashboard.dimensions) {
    for (const q of dim.questions) {
      if (q.average > 0) {
        allQuestionScores.push({
          question: FIELD_NAMES[q.index] || `Q${q.index + 1}`,
          average: q.average,
          responses: q.responseCount
        });
      }
    }
  }
  allQuestionScores.sort((a, b) => b.average - a.average);
  analysis.questionDetails = {
    top3: allQuestionScores.slice(0, 3),
    bottom3: allQuestionScores.slice(-3).reverse()
  };

  return analysis;
}

function generateReportMarkdown(analysis, surveyTitle) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  let md = `# ${surveyTitle || '评分问卷'} — AI分析报告\n\n`;
  md += `> 报告生成时间：${now}\n\n`;

  // 概览
  md += `## 📊 整体概览\n\n`;
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| 参与人数 | ${analysis.overview.participants} |\n`;
  md += `| 已完成 | ${analysis.overview.completed} (${analysis.overview.completionRate}%) |\n`;
  md += `| 总评分数 | ${analysis.overview.totalRatings} |\n\n`;

  // 维度排名
  md += `## 🏆 维度排名\n\n`;
  md += `| 排名 | 维度 | 均分 | 评价 |\n|------|------|------|------|\n`;
  analysis.dimensionRanking.forEach((d, i) => {
    const level = d.average >= 8 ? '优秀' : d.average >= 6 ? '良好' : d.average > 0 ? '待改进' : '无数据';
    md += `| ${i + 1} | ${d.name} | ${d.average} | ${level} |\n`;
  });
  md += '\n';

  // 亮点
  if (analysis.highlights.length > 0) {
    md += `## ✅ 亮点（均分 ≥ 8）\n\n`;
    analysis.highlights.forEach(h => {
      md += `- **${h.name}**（${h.average}分）：表现优秀，建议保持\n`;
    });
    md += '\n';
  }

  // 关注点
  if (analysis.concerns.length > 0) {
    md += `## ⚠️ 需关注（均分 < 6）\n\n`;
    analysis.concerns.forEach(c => {
      md += `- **${c.name}**（${c.average}分）：建议重点改进\n`;
    });
    md += '\n';
  }

  // 单题Top/Bottom
  md += `## 📈 单题得分\n\n`;
  if (analysis.questionDetails.top3.length > 0) {
    md += `**最高分题目：**\n`;
    analysis.questionDetails.top3.forEach(q => {
      md += `- ${q.question}（${q.average}分，${q.responses}人评分）\n`;
    });
    md += '\n';
  }
  if (analysis.questionDetails.bottom3.length > 0) {
    md += `**最低分题目：**\n`;
    analysis.questionDetails.bottom3.forEach(q => {
      md += `- ${q.question}（${q.average}分，${q.responses}人评分）\n`;
    });
    md += '\n';
  }

  // 建议
  md += `## 💡 改进建议\n\n`;
  if (analysis.concerns.length > 0) {
    md += `基于评分数据，建议优先关注以下方面：\n\n`;
    analysis.concerns.forEach((c, i) => {
      md += `${i + 1}. **${c.name}**维度得分偏低（${c.average}），建议深入了解原因并制定改进计划\n`;
    });
  } else if (analysis.highlights.length > 0) {
    md += `整体评分良好，各维度表现均衡。建议：\n\n`;
    md += `1. 继续保持${analysis.highlights[0].name}等高分维度的做法\n`;
    md += `2. 关注得分相对较低的维度，寻找提升空间\n`;
  } else {
    md += `数据量较少，建议收集更多反馈后再做深入分析。\n`;
  }

  md += `\n---\n*本报告由 lark-survey-scoreboard 自动生成*\n`;

  return md;
}

function writeToFeishuDoc(markdown, title) {
  console.log('[3/3] 写入飞书文档...');

  const docTitle = `${title} - 分析报告`;

  // 用 lark-cli 创建文档
  const result = run(`lark-cli doc +doc-create --title "${docTitle}" --content "${markdown.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);

  if (result) {
    console.log(`  文档已创建: ${docTitle}`);
    const urlMatch = result.match(/https?:\/\/[^\s"]+/);
    if (urlMatch) console.log(`  链接: ${urlMatch[0]}`);
    return result;
  }

  // 备选：写入本地文件
  const outputPath = `report-${Date.now()}.md`;
  const fs = require('fs');
  fs.writeFileSync(outputPath, markdown);
  console.log(`  飞书文档创建失败，已保存到本地: ${outputPath}`);
  return outputPath;
}

// ===== 主流程 =====
async function main() {
  const surveyTitle = process.argv[2] || '评分问卷';

  console.log('=== 生成AI分析报告 ===\n');

  // Step 1: 获取数据
  console.log('[1/3] 获取评分数据...');
  const dashboard = await fetchDashboardData();
  const raw = await fetchRawData();

  if (!dashboard || !dashboard.dimensions || dashboard.stats.totalRegistered === 0) {
    console.error('❌ 无评分数据。请确保服务器正在运行且有人已提交评分。');
    process.exit(1);
  }

  console.log(`  ${dashboard.stats.totalRegistered}人参与, ${dashboard.stats.totalRatings}条评分`);

  // Step 2: 分析数据
  console.log('[2/3] AI分析数据...');
  const analysis = analyzeData(dashboard, raw);

  // 生成报告
  const markdown = generateReportMarkdown(analysis, surveyTitle);
  console.log(`  报告已生成（${markdown.length}字）`);

  // Step 3: 写入飞书
  writeToFeishuDoc(markdown, surveyTitle);

  console.log('\n✅ 报告生成完成！');

  // 同时输出到控制台
  console.log('\n--- 报告预览 ---\n');
  console.log(markdown);
}

main();
