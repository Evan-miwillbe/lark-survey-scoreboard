# 飞书CLI创作者大赛 参赛作品

## ��品名称

**lark-survey-scoreboard** — 一句话搞定现场实时评分系统

## 一句话介绍

用飞书CLI + 一行命令，搭建媲美 Poll Everywhere 的实时评分问卷 + 大屏看板，完全免费。

## 解决什么��题

| 痛点 | 现有方案 | 本项目方案 |
|------|---------|-----------|
| 现场活动需要实时投票/评��� | Poll Everywhere（¥850/年，限25人） | **¥0，无人数限制** |
| 数据存在第三方服务器 | 不可控 | 存在自己的飞书多维表格 |
| 搭建需要专业开发 | 几天开发周期 | **一句话 + 30分钟** |
| 非技术人员无法操作 | 需要IT支持 | 飞书CLI自然语言操作 |

## 核心创新

### 1. 飞书多维表格作为免费数据库

发现飞书 Base 的免费额度（50,000行 + API）完全覆盖评分场景需求，将其作为"零成本数据库"使用，无需购买任何云数据库服务。

### 2. 双模式架构适配不同场景

- **基础版（30分钟）**：纯 lark-cli 操作，飞书内置仪表盘展示
- **��阶版（2小时）**：自建Web前端 + 实时大屏，手机逐题评分1秒内刷新

### 3. lark-cli 深度集成

整个系统的搭建过程全部通过 lark-cli 完成：
- `+base-create` → 创建数据库
- `+form-create` + `+form-questions-create` → 创建表单
- `+field-create` → 创建公式字段计算维度均分
- `+dashboard-create` + `+dashboard-block-create` → 创建可视化看板

### 4. 一键脚本体现"一句话搞定"

```bash
bash scripts/setup-base.sh "年会评分" "创新力" "执行力" "沟通力" "协作力"
```

一行命令完成：创建Base → 创建表单 → 逐条添加题目 → 创建仪表盘。

## 技术架构

```
手机浏览器 ──POST /api/rate──→ Express API ←──GET /api/dashboard──── 大屏浏览器
                                    ↕                                    (ECharts)
                              飞书 Open API
                                    ↕
                            飞书多维表格（数据库）

部署方式：
├── 前端 HTML → GitHub Pages（免费）
├── 后端 API  → 阿里云 FC3（免费额度）
└── 数据库    → 飞书 Base（免费）
= 总成本 ¥0
```

## 适用场景

- 培训现场实时满意度评分
- 面试多维度评估（多面试官同时打分）
- 年会/团建现场投票
- 360度能力评估
- 课堂互动答题
- 任何需要"现场收集评分 + 实时展示统计"的场景

## 技术亮点

| 特性 | 实现方式 |
|------|---------|
| 实时性（1秒刷新） | 内存缓存 + 前端每秒轮询 |
| 断点续填 | localStorage 持久化 + 服务端记录恢复 |
| 零成本部署 | GitHub Pages + 阿里云FC3免费额度 + 飞书Base |
| Token自动刷新 | 飞书OAuth自动续期 + 401重试机制 |
| 大屏暗色主题 | ECharts + 颜色区分高/中/低分 |
| CSV一键导出 | 含BOM头，Excel直接打开无乱码 |

## 踩坑与贡献

开发过程中��现并记录了多个 lark-cli / 飞书API 的坑：
- 表单题目批量添加会乱序 → 必须逐条添加
- `+field-list` 默认只返回100条 → 需加 `--limit 200`
- formula 字段创建需要 `--i-have-read-guide` 标志
- FC3 注入 Content-Disposition 导致前端页面被下载 → 前后端分离部署

这些踩坑记录对社区其他开发者具有参考价值。

## 可复用性

本项目作为 Claude Code Skill（SKILL.md）发布，任何安装了 lark-cli 的用户可以直接说：

> "帮我做一个30道题的评分问卷，分6个维度，然后建一个仪表盘"

Claude Code 加载本 Skill 后即可自动完成全部搭建。

## 文件结构

```
lark-survey-scoreboard/
├── README.md              # 项目说明
├── SUBMISSION.md          # 参赛说明（本文件）
├── SKILL.md               # Claude Code Skill 定义
├── package.json           # Node.js 项目配置
├── bootstrap              # FC3 冷启动脚本
├── src/                   # 后端源码
│   ├── server.js          # Express API 服务
│   ├── feishu.js          # 飞书 Open API 客户端
│   ├── cache.js           # 内存缓存层
│   └── questions.js       # 题目配置
├── public/                # 前端页面
│   ├── rating.html        # 手机评分页
│   └── dashboard.html     # 大屏展示页
├── scripts/               # 自动化脚本
│   ├── setup-base.sh      # 一键创建飞书Base+表单
│   └── deploy-fc3.sh      # 一键部署到阿里云
└── references/            # 详细文档
    ├── workflow-basic.md
    ├── workflow-advanced.md
    ├── deployment-guide.md
    ├── code-templates.md
    └── question-mapping.md
```

## 作者

Evan-miwillbe | GitHub: https://github.com/Evan-miwillbe/lark-survey-scoreboard
