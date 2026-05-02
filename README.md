# lark-survey-scoreboard

培训结束了。你打开飞书妙记，对着它说一句话，评分问卷就自己长出来了。

不是模板。是AI读完了你这场培训讲了什么，然后替你想好了该问什么。

手机打分，大屏1秒刷新，数据存你自己的飞书表格。总成本 ¥0。

---

## 它做了什么

一句话：

```
"帮我根据这场培训的飞书妙记，生成评分问卷，收集完反馈后出分析报告"
```

然后它自己跑完了：

```mermaid
graph LR
    A[飞书妙记<br/>会议记录] --> B[AI分析内容<br/>提取主题维度]
    B --> C[自动创建<br/>Base+表单]
    C --> D[实时收集<br/>手机评分]
    D --> E[AI分析<br/>生成报告]
```

全程无需人工编写题目、无需手动分析数据。AI读完内容，自己决定该评什么。

### 试一下

```bash
# 从飞书妙记一键生成评分系统
npm run from-minutes https://your-feishu.com/minutes/xxx

# 收集评分后生成AI分析报告
npm run report "培训名称"
```

---

## 为什么做这个

算一笔账。

Poll Everywhere，实时投票工具，行业标准。¥850/年，免费版限25人。

我的需求：在培训后让30个人打分，能够实现直接大屏上看到实时的结果。

| | Poll Everywhere | 这个项目 |
|---|---|---|
| 费用 | ¥850/年起，免费版限25人 | **¥0，无人数限制** |
| 实时性 | 实时 | 实时（1秒刷新） |
| 数据所有权 | 第三方服务器 | 你自己的飞书表格 |
| 搭建方式 | 注册+配置 | **一句 lark-cli 命令** |

因为可以不用花钱解决的问题，为什么要花¥850？飞书表格免费额度50,000行，够用到天荒地老。

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

进阶版的效果：参与者手机上每点一下，大屏1秒内就动了。现场感很强。

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

做这个项目的过程就像炒一盘菜，看着简单，下锅才知道火候多难控。

| 问题 | 根因 | 解决 |
|------|------|------|
| 表单题目乱序 | 批量添加时飞书API内部乱序 | 逐条添加（慢但确定） |
| `+field-list` 只返100条 | 默认分页 | 加 `--limit 200` |
| formula字段被拒 | CLI要求确认 | 加 `--i-have-read-guide` |
| FC3页面被下载 | 注入Content-Disposition | 前后端分离部署 |
| CORS阻止 | 跨域 | Express设置 `Allow-Origin: *` |
| Windows换行导致FC3报错 | CRLF | `sed -i 's/\r$//' bootstrap` |

每一行都是真金白银的时间。完整踩坑记录见 [SKILL.md](SKILL.md#9-完整踩坑记录)。

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

## 作者的话

我不是专业前端开发者。写这个项目的动机很朴素：这个项目起源于我的实习，在一场培训结束的时候，领导说"能不能做个实时的反馈问卷"，Poll Everywhere是很好的工具，但是很多页面设计相对固定死板。很多想实现的功能并不能通过网站实现，手动编十几道题再计算均分，其实是一件很麻烦的事情。因为我之前也使用飞书看板做过相关的研究，实时显示的功能暂时还不能实现。在AI工具比较发达的情况下，我可以使用Claude Code编写一个html文件，就能够实现这件事情。

飞书表格免费，lark-cli能操作它，AI能帮我想题目。那就把这三件事串起来。

其实不是什么改变世界的伟大产品。就是一个来源于实习的时候，我想解决的一个需求。花了¥0，省了重复劳动，数据还在自己手里。

如果你也有类似的需求，可以直接拿去用。如果觉得哪里可以改进，也欢迎提 Issue 或者直接 PR。

做工具的人，最怕工具做完了自己都不用。我觉得这是一个可以给每一场会议锦上添花的事情，特别是每次开完会之后，花很少的时间。就能够及时收到大家的反馈，是一个重要的需求。而且这种实时展示的面板，更能够直观地看到问题的点。每场会议结束之后，进行一个面板的展示。也能够防止执行的时候出现问题。

## License

MIT
