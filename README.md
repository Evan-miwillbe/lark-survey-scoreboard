# lark-survey-scoreboard

**用飞书CLI一句话搞定现场实时评分** — Poll Everywhere 的免费替代品。

手机打分 → 大屏1秒刷新 → 数据存飞书表格 → 总成本 ¥0。

---

## 核心亮点：从飞书妙记到完整评估闭环

一句话触发完整智能工作流：

```
"帮我根据这场培训的飞书妙记，生成评分问卷，收集完反馈后出分析报告"
```

```
┌─────────┐      ┌─────────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ 飞书妙记 │ ───→ │ AI分析内容   │ ───→ │ 自动创建  │ ───→ │ 实时收集  │ ───→ │ AI分析   │
│ (会议记录)│      │ 提取主题维度  │      │ Base+表单 │      │ 手机评分  │      │ 生成报告  │
└─────────┘      └─────────────┘      └──────────┘      └──────────┘      └──────────┘
     ↑                                                        ↑                   ↓
  lark-cli                                                大屏实时展示         写入飞书文档
  读取妙记                                                (ECharts)          (自动分享)
```

**不只是工具，是智能工作流**：AI理解培训内容 → 自动生成针对性题目 → 实时收集反馈 → 生成洞察报告。全程无需人工编写题目、无需手动分析数据。

### 快速体验

```bash
# 从飞书妙记一键生成评分系统
npm run from-minutes https://your-feishu.com/minutes/xxx

# 收集评分后生成AI分析报告
npm run report "培训名称"
```

---

## 为什么需要它

现场活动（年会/培训/面试）需要实时评分展示，但 Poll Everywhere 要 ¥850/年且限25人。本项目用飞书生态搭建完整替代方案：

| | Poll Everywhere | 本项目 |
|---|---|---|
| 费用 | ¥850/年起，免费版限25人 | **¥0，无人数限制** |
| 实时性 | 实时 | 实时（1秒刷新） |
| 数据所有权 | 第三方服务器 | 你自己的飞书表格 |
| 搭建方式 | 注册+配置 | **一句 lark-cli 命令** |

## 快速开始

### 基础版 — 一行命令（30分钟可用）

```bash
bash scripts/setup-base.sh "年会评分" "创新力" "执行力" "沟通力" "协作力" "领导力" "学习力"
```

完成后得到：飞书表单（参与者填写）+ 飞书仪表盘（实时查看统计）。

### 进阶版 — 现场级体验（手机+大屏）

```bash
npm install
npm start
# 手机访问 http://localhost:3000/rating.html
# 大屏访问 http://localhost:3000/dashboard.html
```

进阶版实现**逐题实时更新**：参与者每点一个评分，大屏1秒内反映。

## 架构

```
手机浏览器                    云端                           大屏浏览器
┌──────────┐    POST /api/rate    ┌──────────┐    GET /api/dashboard    ┌──────────┐
│ rating   │ ──────────────────→ │ Express  │ ←──── 每秒轮询 ────────  │ dashboard│
│ .html    │    (逐题实时写入)     │ server   │                         │ .html    │
│          │                     │          │                         │ ECharts  │
│ localStorage│                  │ feishu.js│                         │ 多维度图表│
└──────────┘                     └──────────┘                         └──────────┘
     ↑                              ↑    ↑
     │                              │    │
  GitHub Pages              飞书 Open API   阿里云 FC3
  (免费静态托管)             (认证+读写)     (免费 Serverless)
```

**零成本组合**：GitHub Pages（前端）+ 阿里云FC3（后端，免费额度）+ 飞书Base（数据库）= ¥0

## 项目结构

```
├── src/                          # 后端源码（可直接运行）
│   ├── server.js                 # Express API — 6个端点
│   ├── feishu.js                 # 飞书 Open API 客户端
│   ├── cache.js                  # 内存缓存（毫秒级响应）
│   ├── questions.js              # 题目+维度配置
│   ├── generate-from-minutes.js  # 🔥 从飞书妙记自动生成问卷
│   └── generate-report.js        # 🔥 评分完成后生成AI分析报告
├── public/                       # 前端页面
│   ├── rating.html               # 手机评分页（支持断点续填）
│   └── dashboard.html            # 大屏看板（暗色主题 + ECharts）
├── scripts/                      # 自动化
│   ├── setup-base.sh             # 一键创建飞书Base+表单+仪表盘
│   └── deploy-fc3.sh             # 一键部署到阿里云FC3
├── SKILL.md                      # Claude Code Skill（AI可直接加载使用）
├── SUBMISSION.md                 # 参赛说明
└── references/                   # 详细文档（工作流/部署/踩坑）
```

## lark-cli 深度集成

本项目展示了 lark-cli 在复杂场景下的系统化应用：

| lark-cli 命令 | 用途 |
|---|---|
| `+base-create` | 创建多维表格（数据库） |
| `+table-list` | 获取表 ID |
| `+form-create` | 创建评分表单 |
| `+form-questions-create` | 逐条添加评分题（1-10分） |
| `+field-create` | 创建公式字段计算维度均分 |
| `+field-list` | 获取所有字段名 |
| `+dashboard-create` | 创建可视化仪表盘 |
| `+dashboard-block-create` | 添加指标卡/条形图 |
| `+dashboard-arrange` | 自动排列图表布局 |

## API 端点

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/register` | 注册（姓名+部门，返回已有评分用于断点续填） |
| POST | `/api/rate` | 单题评分（写入飞书Base + 更新内存缓存） |
| POST | `/api/sync` | 批量同步（页面恢复时一次性同步） |
| GET | `/api/questions` | 题目列表和维度映射 |
| GET | `/api/dashboard` | 大屏数据（从内存缓存读取，毫秒级） |
| GET | `/api/export-csv` | 导出CSV（含BOM头，Excel直接打开） |

## 作为 Skill 使用

本项目同时是一个 Claude Code Skill。安装了 lark-cli 的用户对 Claude Code 说：

> "帮我做一个30道题的评分问卷，分成6个维度，每个维度5道题，然后建仪表盘"

Claude Code 加载 `SKILL.md` 后自动完成全部搭建，包括创建Base、添加题目、配置仪表盘图表。

## 适用场景

- **培训现场反馈** — 学员实时打分，大屏展示各维度满意度
- **面试评估** — 多面试官同时评分，实时汇总候选人得分
- **360评估** — 上下级同事评分，按维度聚合展示
- **年会投票** — 现场投票评选，大屏实时展示
- **课堂互动** — 学生答题，教师端实时查看正确率

## 踩坑记录

| 问题 | 根因 | 解决 |
|------|------|------|
| 表单题目乱序 | 批量添加时飞书API内部乱序 | 逐条添加 |
| `+field-list` 只返100条 | 默认分页 | 加 `--limit 200` |
| formula字段被拒 | CLI要求确认 | 加 `--i-have-read-guide` |
| FC3页面被下载 | 注入Content-Disposition | 前后端分离部署 |
| CORS阻止 | 跨域 | Express设置 `Allow-Origin: *` |
| Windows换行导致FC3报错 | CRLF | `sed -i 's/\r$//' bootstrap` |

完整踩坑记录见 [SKILL.md](SKILL.md#9-完整踩坑记录)。

## 部署指南

**本地开发**：
```bash
npm install
# 设置环境变量（或使用 lark-cli login 的本地凭据）
export FEISHU_BASE_TOKEN=your_token
export FEISHU_TABLE_ID=your_table_id
npm start
```

**生产部署**：
- 前端 → GitHub Pages: `git push` 即可
- 后端 → 阿里云FC3: `bash scripts/deploy-fc3.sh`
- 详见 [references/deployment-guide.md](references/deployment-guide.md)

## License

MIT
