# 飞书CLI创作者大赛 参赛作品

## 作品名称

**lark-survey-scoreboard** — 从飞书妙记到评估报告，一句话完成评估闭环

## 一句话介绍

培训结束后一句话，AI读取妙记自动生成评分问卷、实时收集反馈、生成洞察报告写回飞书 — 零成本替代 Poll Everywhere。

## 这个项目的来历

每次培训结束，领导说："做个反馈问卷。"

然后我就得：想10-20道题 → 建飞书表单 → 发链接 → 等人填 → 导出Excel → 算均分 → 写分析 → 发邮件。

整个流程2小时起。题目还是我瞎编的，什么"讲解是否清晰""内容是否有用"——任何一场培训都能用的废话题。

后来我想：飞书妙记里明明记了这场培训讲了什么，为什么不让AI读完之后自己出题？

于是有了这个。

## 它怎么工作

```
培训结束 → "帮我根据这场培训的妙记生成评分问卷"
    ↓
AI读取飞书妙记 → 分析内容提取主题 → 自动生成针对性评分题目
    ↓
创建飞书Base + 表单 + 仪表盘（全自动）
    ↓
参与者手机实时打分 ←→ 大屏1秒刷新（ECharts）
    ↓
"帮我生成分析报告" → AI分析评分数据 → 生成洞察报告 → 写入飞书文档
```

从"会议结束"到"洞察交付"，中间不需要人动手。

## 解决什么问题

说白了就是：为什么要花钱买别人的工具，做一件飞书本身就能免费做的事？

| 痛点 | 之前怎么办 | 现在怎么办 |
|------|---------|-----------|
| 现场要实时投票 | Poll Everywhere（850元/年，限25人） | **0元，无人数限制** |
| 培训后要编评分题 | 凭回忆瞎编，费时费力 | **AI读妙记自动生成** |
| 收集完要做分析 | Excel手动统计 | **AI自动出报告** |
| 数据在别人服务器 | 不可控 | 存自己的飞书表格 |
| 搭建需要开发 | 几天工期 | **一句话** |

## 核心创新

### 1. 飞书妙记 → 智能问卷（AI内容感知）

不是预设模板，而是AI读取实际培训内容后生成针对性题目。讲了什么就评什么。

```bash
npm run from-minutes https://feishu.com/minutes/obcnxxx
# AI分析 → 自动生成3-6个维度 → 每维度2-4道题 → 创建完整系统
```

### 2. 实时评分 + 大屏看板（现场级体验）

手机逐题评分，每点一下大屏1秒内更新。暗色主题ECharts图表，颜色区分高/中/低分。

### 3. AI分析报告自动生成

评分收集完毕后，自动分析数据生成洞察：维度排名、亮点与关注点、单题Top/Bottom、改进建议。报告直接写入飞书文档。

```bash
npm run report "4月培训"
# 分析数据 → 生成报告 → 写入飞书文档
```

### 4. 飞书Base作为零成本数据库

飞书多维表格免费额度（50,000行 + Open API）完美覆盖评分场景，无需购买任何云数据库。

### 5. lark-cli 深度集成（9个命令组合）

| 命令 | 用途 |
|------|------|
| `+base-create` | 创建数据库 |
| `+table-list` | 获取表ID |
| `+form-create` | 创建表单 |
| `+form-questions-create` | 添加评分题 |
| `+field-create` | 公式字段（维度均分） |
| `+field-list` | 获取字段名 |
| `+dashboard-create` | 创建看板 |
| `+dashboard-block-create` | 添加图表 |
| `vc +minutes-get` | 读取妙记内容 |

## 技术架构

```
飞书妙记 ──→ generate-from-minutes.js ──→ 飞书Base（自动创建）
                                              ↕
手机(rating.html) ←→ Express API(server.js) ←→ 大屏(dashboard.html)
                          ↕
                    飞书 Open API
                          ↓
                  generate-report.js ──→ 飞书文档（分析报告）

部署：GitHub Pages（前端）+ 阿里云FC3（后端）+ 飞书Base（数据库）= 总成本 0元
```

## 技术亮点

| 特性 | 实现 |
|------|------|
| 内容感知问卷 | AI分析妙记文本提取主题维度 |
| 实时性（1秒） | 内存缓存 + 前端轮询 |
| 断点续填 | localStorage + 服务端记录恢复 |
| 零成本部署 | GitHub Pages + FC3免费额度 + 飞书Base |
| Token自动续期 | OAuth自动刷新 + 401重试 |
| 智能报告 | 数据分析 + 维度排名 + 改进建议 |
| CSV导出 | 含BOM头，Excel直接打开 |

## 适用场景

- 培训后实时反馈收集（从妙记自动生成问卷）
- 面试多维评估（多面试官同时打分）
- 年会/团建现场投票
- 360度能力评估
- 课堂互动
- 任何"现场评分 + 实时展示 + 自动报告"的场景

## 踩坑贡献

| 问题 | 解决 |
|------|------|
| 表单题目批量添加乱序 | 逐条添加 |
| +field-list只返100条 | 加 --limit 200 |
| formula字段被拒 | 加 --i-have-read-guide |
| FC3页面被下载 | 前后端分离部署 |
| CORS阻止 | Express设置Allow-Origin |

## 可复用性

作为 Claude Code Skill 发布，用户说一句自然语言即可触发完整工作流：

> "帮我根据今天的培训妙记做一个反馈问卷，收集完了出分析报告"

## 文件结构

```
lark-survey-scoreboard/
├── src/
│   ├── server.js                 # Express API
│   ├── feishu.js                 # 飞书API客户端
│   ├── cache.js                  # 内存缓存
│   ├── questions.js              # 题目配置
│   ├── generate-from-minutes.js  # 从妙记生成问卷
│   └── generate-report.js        # 生成AI分析报告
├── public/
│   ├── rating.html               # 手机评分页
│   └── dashboard.html            # 大屏看板
├── scripts/
│   ├── setup-base.sh             # 一键创建Base
│   └── deploy-fc3.sh             # 一键部署FC3
├── SKILL.md                      # Claude Code Skill
├── package.json                  # 项目配置
└── references/                   # 详细文档
```

## 最后说两句

这个项目不复杂。Express + 飞书API + 一点AI，任何有半年经验的开发者都能写出来。

但它解决了一个真实的、反复出现的问题。每次培训结束我都在用它。它帮我省下来的时间，比写它花掉的时间多得多。

好工具不需要很复杂。它只需要在你需要的时候，恰好在那里。

## 作者

Evan-miwillbe | GitHub: https://github.com/Evan-miwillbe/lark-survey-scoreboard
