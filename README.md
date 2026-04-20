# lark-survey-scoreboard

> **零成本搭建实时评分问卷 + 大屏看板**
> 用飞书多维表格做数据库，GitHub Pages 做前端，阿里云 FC3 做 API 后端。
> 媲美 [Poll Everywhere](https://pe.app) 的实时互动体验，但完全免费，无人数限制。

## 它能做什么

你在 Poll Everywhere 上能做的事——参与者用手机打分，大屏上实时刷新图表——这个项目全部能做，而且不花一分钱。

**手机端（rating.html）**

参与者打开网页，输入姓名和部门，然后逐题打分（1-10 分）。每点一个评分，数据立即同步到服务器。即使中途关闭浏览器，下次打开会自动恢复进度。

**大屏端（dashboard.html）**

投影仪或大屏幕上打开另一个网页，展示暗色主题的实时数据看板。每秒自动刷新，参与者的每次打分在 1 秒内反映到图表上。按维度分组展示条形图，颜色区分高分（青绿）、中分（金黄）、低分（珊瑚红）。

**数据管理（飞书多维表格）**

所有评分数据存储在飞书多维表格中，可以用飞书的表格 UI 直接查看、筛选、编辑、导出。同时支持通过 API 导出 CSV。

## 为什么做这个

| | Poll Everywhere | 本项目 |
|---|---|---|
| 费用 | 免费版限 25 人参与，付费版 $120/年起 | **¥0，无人数限制** |
| 实时性 | 实时 | 实时（1 秒刷新） |
| 数据所有权 | 存在 Poll Everywhere 服务器 | 存在你自己的飞书表格里 |
| 可定制性 | 有限的模板和样式 | 前端代码完全可控 |
| 依赖 | 需要 Google/MS 账号登录 | 飞书账号 + GitHub |
| 数据库 | 不可见 | 飞书多维表格，直接查看编辑 |

## 零成本架构

整个系统不花一分钱：

| 组件 | 服务 | 费用 | 说明 |
|------|------|------|------|
| 数据库 | 飞书多维表格 | 免费 | 飞书企业版（免费版）内含，每表最多 50,000 行 |
| 前端页面 | GitHub Pages | 免费 | 静态 HTML 托管，全球 CDN |
| 后端 API | 阿里云函数计算 FC3 | 免费 | 每月 100 万次调用 + 40 万 GB-秒，评分场景远达不到 |
| 表单收集 | 飞书表单 / 自建页面 | 免费 | 两种模式可选 |
| CLI 工具 | lark-cli | 免费 | 开源命令行工具 |
| **合计** | | **¥0** | |

## 两种模式

### 基础版 — 30 分钟搞定

用飞书内置的表单 + 仪表盘，适合不需要投屏的简单调查场景。

```
参与者 ──→ 飞书表单 ──→ 多维表格（自动写入）
                              ↓
                        仪表盘（手动/自动刷新）
                     ┌──────────────────┐
                     │ 填写人数（指标卡） │
                     │ 维度1 条形图      │
                     │ 维度2 条形图      │
                     │ ...              │
                     └──────────────────┘
```

**你需要：** 飞书企业版账号 + lark-cli + Python 3.6+

**局限：** 飞书表单必须全部填完才提交，无法做到逐题实时更新大屏。

### 进阶版 — 2-3 小时，现场级体验

自建手机评分页 + 大屏展示页，适合年会、培训、面试等需要投屏的场景。

```
手机浏览器                    云端                           大屏浏览器
┌──────────┐    POST /api/rate    ┌──────────┐    GET /api/dashboard    ┌──────────┐
│ rating   │ ──────────────────→ │ Express  │                        │ dashboard│
│ .html    │    (逐题实时写入)     │ server   │ ←──── 每秒轮询 ────────  │ .html    │
│          │                     │          │                         │ ECharts  │
│ 注册/登录 │ ←── 返回已有评分 ──  │ feishu.js│                         │ 维度卡片  │
│ localStorage│                  │ cache.js │                         │ 实时统计  │
└──────────┘                     └──────────┘                         └──────────┘
     ↑                              ↑    ↑
     │                              │    │
  GitHub Pages              飞书 Open API   阿里云 FC3
  (静态 HTML)               (认证+读写)     (Node.js 运行时)
```

**你需要：** 以上全部 + Node.js 20+ + GitHub 账号 + 阿里云账号

**优势：**
- 手机逐题点击，大屏 1 秒内更新
- 暗色大屏主题，ECharts 多维度条形图
- localStorage 断点续填（关闭浏览器回来继续）
- CSV 导出，飞书表格可视化管理

## 快速开始

### 前置条件

| 要求 | 说明 | 如何检查 |
|------|------|---------|
| 飞书企业版账号 | 免费版即可 | 在飞书中能新建"多维表格" |
| lark-cli 已安装 | 命令行工具 | 终端运行 `lark-cli --version` |
| lark-cli 已登录 | 飞书开放平台应用凭据 | 终端运行 `lark-cli base +base-list` 不报错 |

### 基础版 5 步

**Step 1：创建多维表格**

```bash
lark-cli base +base-create --name "我的问卷"
# 记下返回的 Base Token (BT)
```

**Step 2：创建表单**

```bash
# 获取默认表 ID
lark-cli base +table-list --base-token <BT>
# 记下 Table ID (TI)

# 创建表单
lark-cli base +form-create \
  --base-token <BT> --table-id <TI> \
  --name "我的问卷" \
  --description '请给以下各项打分。
评分范围 1-10 分。
1分：完全不符合
10分：完全符合'
# 记下 Form ID (FI)
```

**Step 3：逐条添加题目**

```bash
# 姓名题
lark-cli base +form-questions-create \
  --base-token <BT> --table-id <TI> --form-id <FI> \
  --questions '[{"type":"text","title":"您的姓名","required":true}]'

# 评分题（逐条添加，每次1道，确保顺序正确）
lark-cli base +form-questions-create \
  --base-token <BT> --table-id <TI> --form-id <FI> \
  --questions '[{"type":"number","title":"评分项名称","required":true,"style":{"type":"rating","icon":"number","min":1,"max":10}}]'
```

> **重要：** 必须逐条添加，不能批量。飞书 API 批量添加会导致题目乱序。

**Step 4：创建仪表盘**

```bash
# 创建仪表盘
lark-cli base +dashboard-create --base-token <BT> --name "评分看板"
# 记下 Dashboard ID (DI)

# 指标卡（填写人数）
lark-cli base +dashboard-block-create \
  --base-token <BT> --dashboard-id <DI> \
  --name "填写人数" --type statistics \
  --data-config '{"table_name":"数据表","count_all":true}'

# 维度条形图（每个维度一张）
lark-cli base +dashboard-block-create \
  --base-token <BT> --dashboard-id <DI> \
  --name "维度名" --type bar \
  --data-config '{"table_name":"数据表","series":[{"field_name":"题1","rollup":"AVERAGE"},{"field_name":"题2","rollup":"AVERAGE"}]}'

# 自动排列图表
lark-cli base +dashboard-arrange --base-token <BT> --dashboard-id <DI>
```

**Step 5：分享**

- 把表单链接发给参与者填写
- 仪表盘需要有该多维表格的查看权限才能看到

**一键脚本：** 如果你有几十道题，不想手动逐条执行，可以用 Python 一键脚本。详见 [references/workflow-basic.md](references/workflow-basic.md)。

### 进阶版 7 步

进阶版在基础版的飞书 Base 之上，自建 Web 前端 + 云端 API，实现实时大屏。

**Step 1：先完成基础版 Step 1-3**（创建 Base、表单、添加题目）

**Step 2：编写后端 Node.js 服务**

4 个核心文件：

| 文件 | 职责 |
|------|------|
| `questions.js` | 题目文本 + 维度映射配置 |
| `feishu.js` | 飞书 Open API 客户端（认证、读写记录） |
| `cache.js` | 内存缓存（维度统计、姓名→记录ID 映射） |
| `server.js` | Express API + 静态文件服务 |

代码模板见 [references/code-templates.md](references/code-templates.md)。

**Step 3：编写前端页面**

| 文件 | 职责 |
|------|------|
| `public/rating.html` | 手机评分页（注册 → 选择维度 → 逐题打分 → localStorage 断点续填） |
| `public/dashboard.html` | 大屏展示页（暗色主题、ECharts 条形图、每秒轮询） |

**Step 4：部署 API 到阿里云 FC3**

```bash
# 安装 Serverless Devs
npm install -g @serverless-devs/s
s config add  # 配置阿里云密钥

# 部署
s deploy
# 记下返回的 FC3 URL，如 https://your-func.cn-hangzhou.fcapp.run
```

**Step 5：部署 HTML 到 GitHub Pages**

```bash
# 创建仓库，推送 HTML 文件
git init
touch .nojekyll
git add . && git commit -m "init"
git remote add origin https://github.com/your-username/scoreboard-pages.git
git push -u origin main
```

然后在 GitHub 仓库 Settings → Pages 中开启。

**Step 6：修改 HTML 中的 API 地址**

在 `rating.html` 和 `dashboard.html` 中设置：

```javascript
const API_BASE = 'https://your-func.cn-hangzhou.fcapp.run';
```

**Step 7：端到端测试**

1. 手机访问 `https://your-username.github.io/scoreboard-pages/rating.html`
2. 注册 → 打分
3. 电脑访问 `https://your-username.github.io/scoreboard-pages/dashboard.html`
4. 确认大屏实时更新

完整的部署细节和踩坑记录见：
- [进阶版工作流](references/workflow-advanced.md)
- [部署指南](references/deployment-guide.md)
- [维度-题目映射规则](references/question-mapping.md)

## 维度-题目映射

最常见的模式是**等间隔映射**：N 道题分成 D 个维度，每个维度取每隔 D 道题。

**公式：** 维度 i（0-based）的题目索引 = `i, i+D, i+2D, ..., i+(K-1)*D`

**示例：30 题 / 6 维度 / 每维度 5 题**

| 维度 | 题目编号 |
|------|---------|
| 维度1 | Q1, Q7, Q13, Q19, Q25 |
| 维度2 | Q2, Q8, Q14, Q20, Q26 |
| ... | ... |
| 维度6 | Q6, Q12, Q18, Q24, Q30 |

如果题目不是等间隔分布，也可以手动指定每个维度包含哪些题。详见 [references/question-mapping.md](references/question-mapping.md)。

## API 端点

进阶版后端提供以下 API：

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/register` | 注册（输入姓名+部门，返回已有评分用于断点续填） |
| POST | `/api/rate` | 单题评分（写入飞书 Base + 更新内存缓存） |
| POST | `/api/sync` | 批量同步（页面恢复时一次性同步所有评分） |
| GET | `/api/questions` | 返回题目列表和维度映射 |
| GET | `/api/dashboard` | 大屏数据（维度统计 + 进度，从内存缓存读取） |
| GET | `/api/rawdata` | 原始数据（所有人的所有评分） |
| GET | `/api/export-csv` | 导出 CSV（含 BOM 头，Excel 直接打开无乱码） |

## 为什么用飞书做数据库

| 对比 | 飞书多维表格 | 传统数据库（MySQL/MongoDB） |
|------|------------|-----------|
| 成本 | 免费（飞书企业版内含） | ¥50-500/月 |
| 运维 | 零运维，飞书托管 | 需要备份、监控、扩容 |
| 可视化 | 飞书 UI 直接查看编辑，非技术人员也能用 | 需要 SQL 工具 |
| 权限 | 飞书组织架构天然集成 | 需自建用户体系 |
| 管理 | lark-cli 命令行直接操作字段、记录、仪表盘 | 需要 migration 脚本 |
| 延迟 | ~100-200ms（HTTP API） | 本地/内网 <5ms |
| 并发 | ~50 QPS | 万级 QPS |
| 复杂查询 | 不支持 JOIN、事务 | 完整 SQL |

**结论：** 评分场景（几十到几百人同时操作，QPS < 100）飞书 Base 完全够用。如果未来需要高并发或复杂查询，`feishu.js` 和 `cache.js` 的逻辑可以直接迁移到传统数据库。

## 评分题样式选项

飞书表单支持多种评分样式：

| 样式 | style 配置 | 效果 |
|------|-----------|------|
| 数字 1-10 | `{"type":"rating","icon":"number","min":1,"max":10}` | 数字按钮 |
| 星级 1-5 | `{"type":"rating","icon":"star","min":1,"max":5}` | 星星 |
| 心形 1-5 | `{"type":"rating","icon":"heart","min":1,"max":5}` | 爱心 |
| 火焰 1-5 | `{"type":"rating","icon":"fire","min":1,"max":5}` | 火焰 |

## 适用场景

- **培训现场反馈**：培训师讲课，学员实时打分，大屏展示各维度满意度
- **面试评估**：多位面试官同时评分，实时汇总候选人各维度得分
- **360 评估**：上下级同事同时评分，按维度聚合展示
- **团建投票**：现场投票评选，大屏实时展示票数
- **课堂互动**：学生答题，教师端实时查看全班正确率分布
- **满意度调查**：年会/活动后收集满意度，大屏实时展示统计

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | 原生 HTML/CSS/JS + ECharts | 零框架依赖，单文件部署 |
| 后端 | Node.js + Express | 4 个文件，逻辑清晰 |
| 数据库 | 飞书多维表格（Open API） | 免费可视化数据库 |
| CLI | [lark-cli](https://github.com/nicepkg/lark-cli) | 命令行操作飞书 |
| 前端部署 | GitHub Pages | 免费静态托管 |
| API 部署 | 阿里云函数计算 FC3 | 免费 Serverless |

## 踩坑记录

完整踩坑记录（含根因分析和探索过程）见 [SKILL.md 第 9 节](SKILL.md#9-完整踩坑记录)。最常见的几个：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 题目顺序错乱 | 批量添加时飞书 API 内部乱序 | **逐条添加**，每次只传 1 道题 |
| **飞书自动给图表加 group_by** | 飞书 web UI 自动按第一个文本字段分组 | 用 `--no-validate` + `group_by: []` 更新移除 |
| **+field-list 只返回 100 条** | 默认分页 limit=100 | 加 `--limit 200` |
| **formula 字段创建被拒绝** | CLI 要求确认 | 加 `--i-have-read-guide` |
| **form-questions-create EOF** | 飞书 API 不稳定 | 重试 5 次 + 创建后验证 |
| FC3 响应被浏览器下载 | FC3 注入 Content-Disposition: attachment | 前后端分离：HTML 放 GitHub Pages |
| CORS 阻止请求 | 前端和 API 在不同域名 | Express 设置 `Access-Control-Allow-Origin: *` |
| OSS 文件强制下载 | 阿里云 OSS 共享域名全局强制下载 | 用 GitHub Pages 托管静态文件 |
| Windows CRLF 导致 FC3 报错 | bootstrap 脚本换行符不对 | `sed -i 's/\r$//' bootstrap` |

## 未来扩展路径

本项目的架构可以平滑演进：

**当前（路径 A）：纯静态 + BaaS**
```
前端（HTML/JS） → GitHub Pages
数据库         → 飞书 Base
后端           → 阿里云 FC3
```

**进阶（路径 B）：前端框架 + Serverless**
```
前端（React/Vue/Next.js）→ Vercel
数据库                   → 飞书 Base 或 Supabase
后端 API                 → Vercel Serverless Functions
```

`feishu.js` 和 `cache.js` 的核心逻辑可以直接迁移，只需调整导入语法。

## 文件结构

```
lark-survey-scoreboard/
├── README.md                          # 你正在看的文件
├── SKILL.md                           # 完整技能文档（Claude Code 使用）
└── references/
    ├── workflow-basic.md              # 基础版完整工作流 + Python 一键脚本
    ├── workflow-advanced.md           # 进阶版 7 步工作流
    ├── deployment-guide.md            # 部署指南（FC3 + GitHub Pages）
    ├── code-templates.md              # 核心代码模板（feishu.js/cache.js/server.js）
    └── question-mapping.md            # 维度-题目映射规则
```

## License

MIT
