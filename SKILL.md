---
name: lark-survey-scoreboard
version: 2.0.0
description: "飞书问卷评分 + 实时可视化面板（双模式）：基础版用飞书内置仪表盘，进阶版自建 Web 实时大屏（手机评分 + ECharts 大屏展示 + 飞书 Base 存储）。适用于年会/培训现场的技能盘点、满意度调查、360评估等场景。关键词：打分问卷、评分表、能力雷达图、实时投票、现场互动。"
metadata:
  requires:
    bins: ["lark-cli"]
  references:
    - path: references/workflow-basic.md
      description: 基础版完整工作流（飞书内置仪表盘）
    - path: references/workflow-advanced.md
      description: 进阶版完整工作流（自建 Web 实时大屏）
    - path: references/deployment-guide.md
      description: 进阶版部署指南（FC3 + GitHub Pages）
    - path: references/question-mapping.md
      description: 维度-题目映射规则
    - path: references/code-templates.md
      description: 进阶版核心代码模板（feishu.js / cache.js / server.js / 前端页面）
---

# 评分问卷 + 实时可视化面板

> **一句话说明：** 帮你在飞书里做一个打分问卷（比如给同事的12项能力打1-10分），然后自动生成实时更新的图表看板。基础版30分钟搞定，进阶版可以做到手机打分、大屏实时刷新（适合年会/培训现场投屏）。

> **前置条件：** 本 skill 需要 lark-cli 已安装并登录（`lark-cli login`）。Claude Code 用户还应先加载 [`../lark-shared/SKILL.md`](../lark-shared/SKILL.md) 和 [`../lark-base/SKILL.md`](../lark-base/SKILL.md)。

## 0. 开始之前：你需要准备什么

### 所有模式都需要

| 要求 | 说明 | 如何检查 |
|------|------|---------|
| 飞书企业版账号 | 免费版即可，用于创建多维表格和表单 | 在飞书中能新建"多维表格" |
| lark-cli 已安装 | 命令行工具，用于操作飞书 Base | 终端运行 `lark-cli --version` |
| lark-cli 已登录 | 需要飞书开放平台应用凭据 | 终端运行 `lark-cli base +base-list` 不报错 |
| 飞书应用权限 | 多维表格读写、表单创建管理、仪表盘创建管理 | 飞书开放平台 → 应用后台 → 权限管理中开通 |
| Python 3.6+（可选） | 基础版一键脚本需要，也可手动逐条执行命令 | `python --version` |
| 网络 | 需要能访问 `open.feishu.cn` | 浏览器打开能加载 |

### 仅进阶版还需要

| 要求 | 说明 | 如何检查 |
|------|------|---------|
| Node.js 20+ | 后端服务运行环境（内置 fetch） | `node --version` 显示 v20.x |
| npm | Node.js 包管理器（随 Node.js 安装） | `npm --version` |
| GitHub 账号 | 部署前端 HTML 页面（免费） | 能登录 github.com |
| 阿里云账号 | 部署后端 API（函数计算 FC3，免费额度足够） | 能登录 aliyun.com |
| Serverless Devs (s CLI) | 阿里云部署工具，`npm install -g @serverless-devs/s` | `s --version` |
| 网络 | 还需能访问 `github.com` 和 `*.cn-hangzhou.fcapp.run` | 浏览器能打开 |

## 1. 何时使用本 Skill

### 1.1 触发条件

以下场景应使用本 skill：

- 用户要创建**评分制问卷**（1-N分），并希望有**实时数据看板**
- 用户提到"技能盘点、能力评估、360评估、满意度调查"等 + 需要可视化
- 用户需要现场收集打分数据并实时展示对比图
- 用户给出题目列表 + 维度分组 + 想要条形图/柱状图
- 用户想要手机端评分 + 投屏端实时大屏的场景

以下场景不应使用本 skill：

- 纯问卷不需要仪表盘 → 只用 lark-base form 模块
- 纯数据看板不需要问卷 → 只用 lark-base dashboard 模块
- 要导入 Excel/CSV → 先用 `lark-cli drive +import`

## 2. 双模式架构

本 skill 提供两种实现方案，根据场景复杂度选择：

> 不知道选哪个？如果只是想快速收集几十人的评分，选**基础版**。如果需要在现场大屏上实时展示打分结果（比如投影仪），选**进阶版**。

| | 基础版 | 进阶版 |
|---|---|---|
| **适用场景** | 简单调查，几十人 | 大型现场活动，需要投屏展示 |
| **收集方式** | 飞书表单（必须全部填完才提交） | 自建手机 Web 页面（逐题点击实时同步） |
| **展示方式** | 飞书内置仪表盘 | 自建 ECharts 大屏（暗色主题，每秒刷新） |
| **实时性** | 填完后刷新看板 | 每点一个评分，大屏 1 秒内更新 |
| **技术门槛** | 只需 lark-cli | 需要 Node.js + 部署到云 |
| **搭建时间** | 30 分钟 | 2-3 小时 |

### 基础版架构

```
问卷填写人 ──→ 飞书表单 ──→ 数据表（自动写入）
                              ↓
                        仪表盘（实时刷新）
                     ┌──────────────────┐
                     │ 填写人数（指标卡） │
                     │ 维度1 条形图      │
                     │ 维度2 条形图      │
                     │ ...              │
                     └──────────────────┘
```

### 进阶版架构

```
手机浏览器                    云端                           大屏浏览器
┌──────────┐    POST /api/rate    ┌──────────┐    GET /api/dashboard    ┌──────────┐
│ rating   │ ──────────────────→ │ Express  │                        │ dashboard│
│ .html    │    (逐题实时写入)     │ server   │ ←──── 每秒轮询 ────────  │ .html    │
│          │                     │          │                         │ ECharts  │
│ 注册/登录 │ ←── 返回已有评分 ──  │ feishu.js│                         │ 12维度卡片│
│ localStorage│                  │ cache.js │                         │ 实时统计  │
└──────────┘                     └──────────┘                         └──────────┘
     ↑                              ↑    ↑
     │                              │    │
  GitHub Pages              飞书 Open API   阿里云 FC3
  (静态 HTML)               (认证+读写)     (Node.js 运行时)
```

> 简单说：手机网页把评分发给云端服务器，云端服务器存到飞书表格里，大屏网页每秒从云端取最新数据画图表。

**核心思路：**
- 飞书表单必须全部填完才提交 → 无法做到逐题实时更新大屏
- 进阶版自建 Web 应用绕过此限制：手机端逐题点击 → 后端逐条写入飞书 Base → 大屏每秒轮询统计
- HTML 静态文件和 API 服务**分离部署**：HTML 在 GitHub Pages，API 在阿里云 FC3

## 3. 基础版工作流（5步）

> 详细命令见 [references/workflow-basic.md](references/workflow-basic.md)

### Step 1: 创建 Base

```bash
lark-cli base +base-create --name "<问卷名称>"
```

### Step 2: 创建表单

```bash
lark-cli base +form-create \
  --base-token <BT> --table-id <TI> \
  --name "<问卷名称>" \
  --description '评分说明文字，用单引号包裹以支持真实换行'
```

### Step 3: 逐条添加题目

```bash
# 姓名题
lark-cli base +form-questions-create \
  --base-token <BT> --table-id <TI> --form-id <FI> \
  --questions '[{"type":"text","title":"您的姓名","required":true}]'

# 评分题（逐条添加确保顺序正确）
lark-cli base +form-questions-create \
  --base-token <BT> --table-id <TI> --form-id <FI> \
  --questions '[{"type":"number","title":"题目文字","required":true,"style":{"type":"rating","icon":"number","min":1,"max":10}}]'
```

**关键：** 逐条添加（每次1道），不能批量，否则飞书 API 可能乱序。

### Step 4: 创建公式字段（可选：维度均分）

如果图表中需要显示维度平均分，先创建 formula 字段：

```bash
# 先获取实际字段名（--limit 200 确保 100+ 字段的表不全截断）
lark-cli base +field-list --base-token <BT> --table-id <TI> --limit 200

# 创建公式字段（注意 --i-have-read-guide 标志）
lark-cli base +field-create \
  --base-token <BT> --table-id <TI> \
  --json '{"type":"formula","name":"【均分】维度名","expression":"AVERAGE([题1],[题2],...)"}' \
  --i-have-read-guide
```

> **关键：** formula 字段创建必须带 `--i-have-read-guide`，否则 CLI 会拒绝执行。表达式中的字段名必须用 `[字段名]` 包裹，且与 Base 中实际字段名完全一致。

### Step 5: 创建仪表盘 + 维度图表

**执行前需要确认：** 询问用户图表是否需要按某个字段分组（如按部门分组）。如果不分组，每个图表只显示整体平均分。

```bash
lark-cli base +dashboard-create --base-token <BT> --name "<看板名称>"

# 指标卡
lark-cli base +dashboard-block-create \
  --base-token <BT> --dashboard-id <DI> \
  --name "填写人数" --type statistics \
  --data-config '{"table_name":"数据表","count_all":true}'

# 维度条形图（不分组版）
lark-cli base +dashboard-block-create \
  --base-token <BT> --dashboard-id <DI> \
  --name "维度名称" --type bar \
  --data-config '{"table_name":"数据表","series":[{"field_name":"【均分】维度名","rollup":"AVERAGE"},{"field_name":"题1","rollup":"AVERAGE"},...]}' \
  --no-validate

# 维度条形图（按部门分组版）
lark-cli base +dashboard-block-create \
  --base-token <BT> --dashboard-id <DI> \
  --name "维度名称" --type bar \
  --data-config '{"table_name":"数据表","series":[{"field_name":"【均分】维度名","rollup":"AVERAGE"},{"field_name":"题1","rollup":"AVERAGE"},...],"group_by":[{"field_name":"部门名称","mode":"integrated"}]}'

lark-cli base +dashboard-arrange --base-token <BT> --dashboard-id <DI>
```

> **飞书会自动给图表加 group_by！** 如果你不想要分组，创建图表后必须用 `--no-validate` 参数更新，显式传 `group_by: []` 才能移除。普通 `+dashboard-block-update` 不带 `--no-validate` 时，CLI 校验会丢弃空的 `group_by`，导致飞书自动添加的分组无法清除。

**移除已有图表的 group_by：**

```bash
lark-cli base +dashboard-block-update \
  --base-token <BT> --dashboard-id <DI> --block-id <BLOCK_ID> \
  --data-config '{"table_name":"数据表","series":[...],"group_by":[]}' \
  --no-validate
```

### Step 6: 分享

- **填问卷：** 分享表单链接
- **看仪表盘：** 需要该多维表格的查看权限

## 4. 进阶版工作流（7步）

> 详细步骤和代码模板见 [references/workflow-advanced.md](references/workflow-advanced.md)
> 部署指南见 [references/deployment-guide.md](references/deployment-guide.md)
> 核心代码见 [references/code-templates.md](references/code-templates.md)

### Step 1: 先完成基础版 Step 1-3

创建 Base、表单、添加题目（复用飞书 Base 作为数据存储）。

### Step 2: 编写后端 Node.js 服务

4 个核心文件：
- `questions.js` — 题目文本 + 维度映射配置
- `feishu.js` — 飞书 Open API 客户端（认证、读写记录）
- `cache.js` — 内存缓存（维度统计、name→recordId 映射）
- `server.js` — Express API + 静态文件

### Step 3: 编写前端页面

- `public/rating.html` — 手机评分页（注册 → 维度标签 → 逐题打分 → localStorage 断点续填）
- `public/dashboard.html` — 大屏展示页（暗色主题、ECharts 12维度条形图、每秒轮询）

### Step 4: 部署 API 到阿里云 FC3

```bash
s deploy
```

### Step 5: 部署 HTML 到 GitHub Pages

将 rating.html 和 dashboard.html 推送到 GitHub 仓库，开启 Pages。

### Step 6: 配置 CORS

确保 FC3 API 允许跨域请求（GitHub Pages 域名与 FC3 域名不同）。

### Step 7: 端到端测试

手机访问 GitHub Pages 的 rating.html → 注册 → 打分 → 大屏页面实时更新。

## 5. 维度-题目映射规则

最常见的模式是**等间隔映射**：N道题分成D个维度，每个维度取每隔D道题。

通用公式：维度i（0-based）的题目索引 = `i, i+D, i+2D, ..., i+(K-1)*D`

详见 [references/question-mapping.md](references/question-mapping.md)

## 6. 踩坑速查

> 完整踩坑记录（含根因和探索过程）见第9节。

| 问题 | 解决方案 |
|------|---------|
| 题目顺序错乱 | **逐条添加**，每次只传1道题 |
| 表单描述显示 `\n` | 用**单引号** `'...'` 包裹，内部真实换行 |
| 题目标题带 "N." 前缀 | 去掉 "N."，只保留题目文字 |
| 图表创建 EOF 错误 | 重试；脚本中加 `time.sleep(0.5)` |
| **飞书自动给图表加 group_by** | 用 `--no-validate` + `group_by: []` 更新图表 |
| **+field-list 只返回 100 条** | 加 `--limit 200`（表超过 100 字段时必须） |
| **formula 字段创建被拒绝** | 加 `--i-have-read-guide` 标志 |
| **form-questions-create EOF/TLS** | 加重试逻辑（5次，间隔 2-3 秒）；验证实际创建结果 |
| FC3 响应被浏览器下载 | 前后端**分离部署**：HTML 放 GitHub Pages |
| OSS 所有文件强制下载 | 用 GitHub Pages，或绑定自定义域名 |
| CORS 阻止前端请求 | Express 设置 `Access-Control-Allow-Origin: *` |
| 凭据在 FC3 不可用 | 通过 `s.yaml` 环境变量传入 |
| Windows bootstrap 换行符 | `sed -i 's/\r$//' bootstrap` 或 `.gitattributes` 设 `eol=lf` |

## 7. 飞书 Base 作为数据库 — 为什么选它

### 为什么不用传统数据库

| 对比 | 飞书 Base | 传统数据库（MySQL/MongoDB） |
|------|----------|---------------------------|
| **成本** | 免费（飞书企业版内含） | 云数据库 ¥50-500/月起 |
| **运维** | 零运维，飞书托管 | 需要备份、监控、扩容 |
| **可视化管理** | 飞书多维表格 UI，非技术人员也能查看/编辑 | 需要 Navicat 等工具或写 SQL |
| **lark-cli 管理** | 命令行直接操作字段、记录、仪表盘 | 需要写 migration 脚本 |
| **权限控制** | 飞书组织架构天然集成，可精确到人 | 需要自建用户体系 |
| **延迟** | 每次写入 ~100-200ms（HTTP API） | 本地/内网 <5ms |
| **并发** | API 限频约 50 QPS | 可到万级 QPS |
| **复杂查询** | 不支持 JOIN、事务 | 完整 SQL 支持 |

**结论：** 评分场景（几十到几百人同时操作，QPS < 100）飞书 Base 完全够用。如果未来需要高并发或复杂查询，可以迁移到传统数据库。

### 飞书 Base 费用

- **飞书企业版（免费版）**：多维表格包含在免费版中，无额外费用
- **记录数限制**：每个数据表最多 50,000 行（评分场景：几百人 × 几十题 = 几万行足够）
- **API 调用限制**：约 50 QPS（具体取决于应用权限）
- **存储空间**：多维表格数据不计入云空间额度

### lark-cli 管理飞书 Base 的优势

```bash
# 创建表和字段，无需手写 SQL
lark-cli base +base-create --name "项目名"
lark-cli base +field-create --base-token BT --table-id TI --name "字段名" --type number

# 一键创建表单（自动生成列）
lark-cli base +form-create --base-token BT --table-id TI --name "问卷"

# 创建仪表盘（数据可视化）
lark-cli base +dashboard-create --base-token BT --name "看板"

# 直接操作记录
lark-cli base +record-upsert --base-token BT --table-id TI --data '{"字段名":"值"}'

# 查看和搜索数据
lark-cli base +record-list --base-token BT --table-id TI
lark-cli base +record-search --base-token BT --table-id TI --keyword "张三"
```

**一句话总结：** lark-cli 让飞书 Base 变成了一个**有 Web UI、有 API、有仪表盘、零成本的 Serverless 数据库**。

## 8. 未来项目部署路径

本项目的经验可以复用于更复杂的全栈应用。以下是不同复杂度的推荐方案：

### 路径 A：纯静态 + BaaS（本项目模式）

```
前端（HTML/JS） → GitHub Pages
数据库         → 飞书 Base（通过 Open API）
后端逻辑       → 阿里云 FC3（Node.js serverless）
```

**适用：** 数据收集、评分、投票、简单 CRUD，前端不需要框架

### 路径 B：前端框架 + Serverless API

```
前端（React/Vue/Next.js）→ Vercel / Netlify
数据库                   → 飞书 Base 或 Supabase
后端 API                 → Vercel Serverless Functions 或 FC3
```

**适用：** 需要复杂交互、路由、状态管理的 Web 应用

**Vercel 部署参考（基于本项目经验）：**

1. 将前后端代码放在同一个仓库
2. 前端代码放 `/` 或 `/app`，Vercel 自动识别 Next.js/React
3. API 放 `/api/` 目录，Vercel 自动部署为 Serverless Functions
4. 环境变量在 Vercel 控制台设置（`FEISHU_APP_ID`、`FEISHU_APP_SECRET`）
5. `vercel deploy` 一键部署，前后端同域，**无 CORS 问题**

**注意：** 如果 CLI 登录失败（如 Windows 用户名含中文字符），可以通过 Vercel 网站（vercel.com）手动导入 GitHub 仓库部署，不依赖 CLI。

### 路径 C：全栈框架 + 独立数据库

```
前端 + 后端（Next.js / Nuxt.js）→ Vercel / Railway
数据库                          → Supabase / PlanetScale / 飞书 Base
```

**适用：** 复杂业务逻辑、用户认证、需要关系型数据库

**飞书 Base 在此路径中的角色：** 如果团队已经在用飞书，继续用飞书 Base 可以省掉用户体系和权限管理。飞书 Base 通过 Open API 提供的数据接口，本质上就是一个 RESTful 的数据库服务。

### 从本项目迁移到 Vercel 的步骤

如果未来想把本项目迁移到 Vercel：

```
scoreboard/
  app/                      # Next.js 前端
    page.tsx                # 评分页
    dashboard/
      page.tsx              # 大屏页
  api/                      # Vercel Serverless Functions
    register/route.ts       # POST /api/register
    rate/route.ts           # POST /api/rate
    dashboard/route.ts      # GET /api/dashboard
  lib/
    feishu.ts               # 飞书 API 客户端（可直接复用）
    cache.ts                # 缓存逻辑（可直接复用）
  vercel.json               # Vercel 配置
```

**核心复用：** `feishu.js` 和 `cache.js` 的逻辑可以直接迁移为 TypeScript 模块，只需调整导入语法。

### 部署平台对比

| 平台 | 前端 | 后端 | 数据库 | 国内速度 | 费用 |
|------|------|------|--------|---------|------|
| **GitHub Pages + FC3** | 静态 HTML | Node.js | 飞书 Base | 中等 | 免费 |
| **Vercel** | React/Next.js | Serverless Functions | 自选 | 较慢 | 免费额度 |
| **Netlify** | 任意前端 | Netlify Functions | 自选 | 较慢 | 免费额度 |
| **阿里云全栈** | OSS + CDN | FC3 / ECS | RDS | 快 | ¥50+/月 |
| **Cloudflare Pages** | 任意前端 | Workers | D1 / KV | 中等 | 免费额度 |

## 9. 完整踩坑记录

### 基础版踩坑

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 题目顺序错乱 | 批量添加时飞书 API 内部乱序 | **逐条添加**，每次只传1道题 |
| 题目名称重复加 " 2" 后缀 | 手动和脚本重复添加同名题 | 添加前用 `+form-questions-list` 核对 |
| 表单描述显示 `\n` | 双引号包裹时 `\n` 是字面量 | 用**单引号** `'...'` 包裹，内部真实换行 |
| 题目标题带 "N." 前缀 | 和飞书自带序号重复 | 去掉 "N."，只保留题目文字 |
| 图表创建 EOF 错误 | 网络波动 | 重试；脚本中加 `time.sleep(0.5)` |
| `+field-list` 返回 `field_name: null` | form 创建的字段用 `name` | 用 jq 取 `.name` 或 `+field-get` |
| **`+field-list` 只返回前 100 条** | 默认分页 limit=100 | 加 `--limit 200`（表有 100+ 字段时必须） |
| **form-questions-create EOF/TLS 超时** | 飞书 API 不稳定 | 加重试逻辑（5 次，间隔 2-3 秒）；执行完后用 `+field-list` 验证实际创建数 |
| **formula 字段创建被拒绝** | CLI 要求用户确认已阅读 guide | 加 `--i-have-read-guide` 标志 |
| **飞书自动给图表加 group_by** | 飞书 web UI 会在图表上自动设置分组 | 创建后用 `--no-validate` + `group_by: []` 更新移除 |
| **CLI 校验丢弃空 group_by** | `+dashboard-block-update` 默认校验会过滤空数组 | 必须加 `--no-validate` 才能让空的 `group_by: []` 传到 API |
| Python subprocess 找不到 lark-cli | Windows 下 npm 全局命令需要完整路径 | 使用 `C:/Users/<user>/AppData/Roaming/npm/lark-cli.cmd` |

### 进阶版踩坑（实际经历，按严重度排序）

| # | 问题 | 根因 | 探索过程 | 最终解决方案 |
|---|------|------|---------|-------------|
| 1 | **FC3 所有响应被浏览器下载** | FC3 HTTP 触发器平台级注入 `Content-Disposition: attachment`，应用层 `res.setHeader` / `res.removeHeader` 均无法覆盖 | 试过 Express 中间件 removeHeader → 无效；试过 fc-express adapter → 无效 | **前后端分离部署**：HTML 放 GitHub Pages，API 留 FC3（AJAX/fetch 不受 Content-Disposition 影响） |
| 2 | **OSS 所有文件强制下载** | 阿里云 OSS 共享域名（`*.oss-*.aliyuncs.com`）对所有 bucket 全局注入 `x-oss-force-download: true` | 试过改文件扩展名（.html → .txt）→ 无效；试过 Content-Type: text/plain → 无效；试过 SVG → 无效；结论：**所有文件类型都被强制下载，不是针对 HTML** | 绑定自定义域名（需 ICP 备案），或用 GitHub Pages。本方案选择 GitHub Pages |
| 3 | **OSS 创建/权限配置全靠手动** | ossutil CLI 设置 bucket ACL 和 policy 返回 403（"Put public bucket acl/policy not allowed"），即使"阻止公共访问"已关闭 | API 方式全部失败 | 用户通过 OSS 控制台 Web UI 手动设置 ACL 为 public-read |
| 4 | **OSS 服务未开通** | 新阿里云账号默认未开通 OSS | API 返回 `UserDisable` 错误 | 用户手动到阿里云控制台开通 OSS |
| 5 | **Vercel CLI 登录失败** | Windows 用户名含中文字符，Vercel CLI 内部用 `user@vercel x.x.x node-vxx platform` 作为 HTTP header，中文导致 header 验证失败 | 无法通过 CLI 登录 | 通过 Vercel 网站手动导入 GitHub 仓库部署（不依赖 CLI） |
| 6 | **Gitee Pages 不可用** | 用户 Gitee 账号未开通 Pages 功能（可能需要实名认证） | 服务菜单中找不到 Pages | 放弃 Gitee，使用 GitHub Pages |
| 7 | **Windows CRLF 换行符** | Windows 上 git 默认 `core.autocrlf=true`，会把 LF 转为 CRLF，导致上传到 Linux FC3 的 bootstrap 脚本无法执行 | FC3 冷启动报 `/bin/bash^M: bad interpreter` | `sed -i 's/\r$//' bootstrap` 或 `dos2unix`；推荐在 `.gitattributes` 中设置 `bootstrap text eol=lf` |
| 8 | **s.yaml 泄露凭据** | `FEISHU_APP_SECRET` 明文写在 s.yaml 中并提交到 git | 安全隐患 | `.gitignore` 中排除 s.yaml，或使用 `s.env` 文件（Serverless Devs 支持环境变量文件） |
| 9 | **ossutil checkpoint 目录权限** | 在 `C:\Windows\system32` 目录下运行 ossutil 时，创建 `.ossutil_checkpoint` 目录被拒绝 | `mkdir .ossutil_checkpoint: Access is denied` | 切换到 `/tmp` 目录运行 ossutil |

### 踩坑总结：部署静态 HTML 的正确认知

1. **FC3 不能直接服务 HTML 页面**（Content-Disposition 限制）
2. **OSS 共享域名不能直接服务任何文件**（强制下载限制）
3. **GitHub Pages 是最可靠的免费方案**（中国大部分地区可访问）
4. **如果需要国内完美访问，需要自有服务器 + ICP 备案域名**
5. **AJAX/fetch 不受 Content-Disposition 影响**，所以 API 放 FC3 没问题
6. **前后端分离部署是通用模式**：前端静态文件放 CDN/Pages，后端 API 放 Serverless

## 10. 可复用脚本模板

- 基础版一键创建脚本：见 [references/workflow-basic.md](references/workflow-basic.md) 的 Python 脚本
- 进阶版核心代码模板：见 [references/code-templates.md](references/code-templates.md)

## 11. 适用场景扩展

本 skill 的模式可复用于：

- **培训现场反馈**：培训师讲课，学员实时打分，大屏展示各维度满意度
- **面试评估**：多位面试官同时评分，实时汇总候选人各维度得分
- **团建活动投票**：现场投票评选，大屏实时展示票数
- **课堂互动**：学生答题，教师端实时查看全班正确率分布
- **360评估**：上下级同事同时评分，按维度聚合展示

## 12. 相关

- [../lark-shared/SKILL.md](../lark-shared/SKILL.md) — 认证、身份、权限
- [../lark-base/SKILL.md](../lark-base/SKILL.md) — 多维表格全部命令
