# 基础版工作流（飞书内置仪表盘）

## 命令总览

| 步骤 | 命令 | 必读 reference |
|------|------|---------------|
| 创建 Base | `lark-cli base +base-create` | lark-base-workspace.md |
| 获取表 ID | `lark-cli base +table-list` | lark-base-table-list.md |
| 创建表单 | `lark-cli base +form-create` | lark-base-form-create.md |
| 更新表单描述 | `lark-cli base +form-update` | lark-base-form-update.md |
| 添加题目 | `lark-cli base +form-questions-create` | lark-base-form-questions-create.md |
| 列出题目（核对顺序） | `lark-cli base +form-questions-list` | lark-base-form-questions-list.md |
| 列出字段（获取字段名） | `lark-cli base +field-list` | lark-base-field-list.md |
| 创建仪表盘 | `lark-cli base +dashboard-create` | lark-base-dashboard-create.md |
| 创建指标卡 | `lark-cli base +dashboard-block-create --type statistics` | lark-base-dashboard-block-create.md |
| 创建条形图 | `lark-cli base +dashboard-block-create --type bar` | lark-base-dashboard-block-create.md |
| 自动排列 | `lark-cli base +dashboard-arrange` | lark-base-dashboard-arrange.md |

## 完整流程脚本模板

以下 Python 脚本封装了从创建到完成的全流程。修改配置区即可复用。

```python
"""
飞书评分问卷 + 维度仪表盘 - 一键创建脚本
修改下方 ===== 配置区 ===== 即可复用
"""
import subprocess, json, time

# ===== 配置区 =====
SURVEY_NAME = "技能盘点问卷"               # 问卷和Base名称
SURVEY_DESCRIPTION = """请阅读下列各项描述，给自己的实际态度、技能或行为打分。

评分范围为1-10分：
1分：完全不符合
5分：一般
10分：完全符合"""                          # 表单描述

# 题目列表（按顺序，不要加 "N." 前缀）
QUESTIONS = [
    "第一道题目文字",
    "第二道题目文字",
    # ...
]

# 维度定义
DIM_NAMES = ["维度1", "维度2", "维度3", "维度4"]  # 替换为实际维度名

# Windows 下 lark-cli 完整路径（macOS/Linux 用 "lark-cli" 即可）
LARK_CLI = "lark-cli"
# ===== 配置区结束 =====

# 自动计算等间隔映射
D = len(DIM_NAMES)
K = len(QUESTIONS) // D
DIMENSIONS = []
for i in range(D):
    indices = [i + D * k for k in range(K)]
    DIMENSIONS.append((DIM_NAMES[i], indices))

def run(args):
    """执行 lark-cli 命令，返回 parsed JSON"""
    result = subprocess.run(args, capture_output=True, text=True, timeout=30, encoding="utf-8")
    if result.returncode != 0:
        raise Exception(f"Command failed: {result.stdout.strip()[:200]}")
    return json.loads(result.stdout)

# Step 1: 创建 Base
print("Step 1: 创建 Base...")
data = run([LARK_CLI, "base", "+base-create", "--name", SURVEY_NAME])
BT = data["data"]["id"]
print(f"  Base token: {BT}")

# 获取默认表 ID
data = run([LARK_CLI, "base", "+table-list", "--base-token", BT])
TI = data["data"]["tables"][0]["id"]
print(f"  Table ID: {TI}")

# Step 2: 创建表单
print("Step 2: 创建表单...")
data = run([LARK_CLI, "base", "+form-create",
    "--base-token", BT, "--table-id", TI,
    "--name", SURVEY_NAME, "--description", SURVEY_DESCRIPTION])
FI = data["data"]["id"]
print(f"  Form ID: {FI}")

# Step 3: 逐条添加题目
print("Step 3: 添加题目...")
# 姓名题
run([LARK_CLI, "base", "+form-questions-create",
    "--base-token", BT, "--table-id", TI, "--form-id", FI,
    "--questions", json.dumps([{"type": "text", "title": "您的姓名", "required": True}])])

# 部门题（可选）
run([LARK_CLI, "base", "+form-questions-create",
    "--base-token", BT, "--table-id", TI, "--form-id", FI,
    "--questions", json.dumps([{"type": "text", "title": "部门名称", "required": True}])])

# 评分题（逐条添加确保顺序）
for i, title in enumerate(QUESTIONS):
    q = {"type": "number", "title": title, "required": True,
         "style": {"type": "rating", "icon": "number", "min": 1, "max": 10}}
    run([LARK_CLI, "base", "+form-questions-create",
        "--base-token", BT, "--table-id", TI, "--form-id", FI,
        "--questions", json.dumps([q])])
    if (i + 1) % 20 == 0:
        print(f"  已添加 {i+1}/{len(QUESTIONS)}")
    time.sleep(0.3)
print(f"  全部 {len(QUESTIONS)} 道题添加完成")

# Step 4: 创建仪表盘
print("Step 4: 创建仪表盘...")
data = run([LARK_CLI, "base", "+dashboard-create", "--base-token", BT, "--name", f"{SURVEY_NAME}看板"])
DI = data["data"]["dashboard"]["dashboard_id"]
print(f"  Dashboard ID: {DI}")

# 指标卡（填写人数）
run([LARK_CLI, "base", "+dashboard-block-create",
    "--base-token", BT, "--dashboard-id", DI,
    "--name", "填写人数", "--type", "statistics",
    "--data-config", json.dumps({"table_name": "数据表", "count_all": True})])

# 获取实际字段名（按表单顺序，只取 number 类型的评分题）
data = run([LARK_CLI, "base", "+form-questions-list",
    "--base-token", BT, "--table-id", TI, "--form-id", FI,
    "-q", '[.data.questions[] | select(.type=="number") | .title]'])
field_names = data

# 维度图表（每维度一张条形图）
for dim_name, indices in DIMENSIONS:
    batch = [field_names[i] for i in indices]
    series = [{"field_name": n, "rollup": "AVERAGE"} for n in batch]
    config = {"table_name": "数据表", "series": series}

    run([LARK_CLI, "base", "+dashboard-block-create",
        "--base-token", BT, "--dashboard-id", DI,
        "--name", dim_name, "--type", "bar",
        "--data-config", json.dumps(config, ensure_ascii=False)])
    print(f"  图表: {dim_name}")
    time.sleep(0.5)

# 自动排列
run([LARK_CLI, "base", "+dashboard-arrange", "--base-token", BT, "--dashboard-id", DI])
print(f"\n完成！仪表盘: https://feishu.cn/base/{BT}")
```

## 关键参数速查

### 评分题样式

| 场景 | style 配置 |
|------|-----------|
| 数字评分 1-10 | `{"type":"rating","icon":"number","min":1,"max":10}` |
| 星级评分 1-5 | `{"type":"rating","icon":"star","min":1,"max":5}` |
| 心形评分 1-5 | `{"type":"rating","icon":"heart","min":1,"max":5}` |
| 火焰评分 1-5 | `{"type":"rating","icon":"fire","min":1,"max":5}` |

### 条形图 vs 柱状图

| 需求 | type | 说明 |
|------|------|------|
| 横向条形图（推荐，题目多时更易读） | `bar` | 横轴是分数 |
| 纵向柱状图 | `column` | 纵轴是分数 |

### 聚合函数

| 需求 | rollup | 说明 |
|------|--------|------|
| 平均分（推荐） | `AVERAGE` | 最常用于评分对比 |
| 总分 | `SUM` | 如果要看总分 |
| 最高分 | `MAX` | |
| 最低分 | `MIN` | |
