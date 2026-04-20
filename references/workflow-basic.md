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
| 列出字段（获取字段名） | `lark-cli base +field-list --limit 200` | lark-base-field-list.md |
| 创建公式字段 | `lark-cli base +field-create --i-have-read-guide` | formula-field-guide.md |
| 创建仪表盘 | `lark-cli base +dashboard-create` | lark-base-dashboard-create.md |
| 创建指标卡 | `lark-cli base +dashboard-block-create --type statistics` | lark-base-dashboard-block-create.md |
| 创建条形图 | `lark-cli base +dashboard-block-create --type bar` | lark-base-dashboard-block-create.md |
| 移除自动 group_by | `lark-cli base +dashboard-block-update --no-validate` | lark-base-dashboard-block-update.md |
| 自动排列 | `lark-cli base +dashboard-arrange` | lark-base-dashboard-arrange.md |

## 关键踩坑与应对

### 1. +field-list 必须加 --limit 200

飞书 `+field-list` 默认只返回前 100 个字段。评分问卷通常有 120+ 字段（120 道评分题 + 姓名等），不加 `--limit 200` 会截断导致误判字段缺失。

### 2. 飞书会自动给图表加 group_by

即使创建时不传 `group_by`，飞书 web UI 会自动给图表添加分组（通常是第一个文本字段，如"部门名称"）。**必须在创建后用 `--no-validate` 显式清除**：

```bash
lark-cli base +dashboard-block-update \
  --base-token <BT> --dashboard-id <DI> --block-id <BLOCK_ID> \
  --data-config '{"table_name":"数据表","series":[...],"group_by":[]}' \
  --no-validate
```

> 不加 `--no-validate` 时，CLI 校验会丢弃空的 `group_by: []`，导致请求不传这个字段，飞书保留自动添加的分组。

### 3. form-questions-create API 不稳定

EOF/TLS 超时错误频发，但请求可能实际上成功了。**必须加重试逻辑 + 验证步骤**：
- 重试 5 次，间隔 2-3 秒
- 全部完成后用 `+field-list --limit 200` 核对实际创建数
- 缺失的字段用 `+field-create` 补创建

### 4. formula 字段需要 --i-have-read-guide

创建公式字段时 CLI 会要求确认，加 `--i-have-read-guide` 跳过交互确认。

### 5. 逐条添加题目

批量添加会导致飞书 API 内部乱序。每次只传 1 道题，间隔 0.3-0.5 秒。

## 完整流程脚本模板

以下 Python 脚本封装了从创建到完成的全流程。修改配置区即可复用。

> **执行前需要确认的配置项：**
> - `ENABLE_GROUP_BY`：图表是否按某个字段分组（如按部门），默认不分组
> - `GROUP_BY_FIELD`：如果需要分组，指定分组字段名（如"部门名称"）
> - `ENABLE_FORMULA`：是否创建维度均分公式字段，默认开启
> - `INCLUDE_DEPT`：是否包含部门题，默认包含

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
FORMULA_PREFIX = "【均分】"                     # 公式字段前缀

# 图表分组设置
ENABLE_GROUP_BY = False          # 是否按字段分组（飞书会自动加分组，这里选择是否保留）
GROUP_BY_FIELD = "部门名称"       # 分组字段名（仅当 ENABLE_GROUP_BY=True 时生效）

# 可选功能
ENABLE_FORMULA = True            # 是否创建维度均分公式字段
INCLUDE_DEPT = True              # 是否包含部门题（除姓名题外）

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

def run(args, retries=5):
    """执行 lark-cli 命令，返回 parsed JSON，支持重试"""
    for attempt in range(retries):
        result = subprocess.run(args, capture_output=True, text=True, timeout=30, encoding="utf-8")
        if result.returncode == 0:
            return json.loads(result.stdout)
        if attempt < retries - 1:
            print(f"  RETRY ({attempt+1}/{retries})...")
            time.sleep(2)
        else:
            raise Exception(f"Command failed after {retries} retries: {result.stdout.strip()[:200]}")

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

# Step 3: 逐条添加题目（带重试）
print("Step 3: 添加题目...")
# 姓名题
run([LARK_CLI, "base", "+form-questions-create",
    "--base-token", BT, "--table-id", TI, "--form-id", FI,
    "--questions", json.dumps([{"type": "text", "title": "您的姓名", "required": True}])])

# 部门题（可选）
if INCLUDE_DEPT:
    run([LARK_CLI, "base", "+form-questions-create",
        "--base-token", BT, "--table-id", TI, "--form-id", FI,
        "--questions", json.dumps([{"type": "text", "title": GROUP_BY_FIELD, "required": True}])])

# 评分题（逐条添加确保顺序，带重试）
errors = 0
for i, title in enumerate(QUESTIONS):
    q = {"type": "number", "title": title, "required": True,
         "style": {"type": "rating", "icon": "number", "min": 1, "max": 10}}
    try:
        run([LARK_CLI, "base", "+form-questions-create",
            "--base-token", BT, "--table-id", TI, "--form-id", FI,
            "--questions", json.dumps([q])])
    except Exception as e:
        print(f"  ERR Q{i+1}: {str(e)[:60]}")
        errors += 1
    if (i + 1) % 20 == 0:
        print(f"  已添加 {i+1}/{len(QUESTIONS)} (errors: {errors})")
    time.sleep(0.3)
print(f"  全部 {len(QUESTIONS)} 道题添加完成 (errors: {errors})")

# 验证实际创建的字段数（--limit 200 确保 100+ 字段不全截断）
print("\nStep 3b: 验证字段...")
all_fields = run([LARK_CLI, "base", "+field-list", "--base-token", BT, "--table-id", TI, "--limit", "200"])
num_fields = [f for f in all_fields["data"]["fields"] if f["type"] == "number"]
print(f"  Number fields: {num_fields.__len__()}/{len(QUESTIONS)}")
if len(num_fields) < len(QUESTIONS):
    field_names_set = {f["name"] for f in num_fields}
    missing = [q for q in QUESTIONS if q not in field_names_set]
    print(f"  Missing {len(missing)} fields, creating via +field-create...")
    for q in missing:
        try:
            run([LARK_CLI, "base", "+field-create",
                "--base-token", BT, "--table-id", TI,
                "--json", json.dumps({"type": "number", "name": q})])
            print(f"  Fixed: {q[:30]}...")
        except:
            print(f"  STILL FAIL: {q[:30]}")
        time.sleep(0.5)

# Step 4: 创建公式字段（维度均分）
if ENABLE_FORMULA:
    print("\nStep 4: 创建公式字段...")
    # 重新获取字段名（用最新的列表）
    all_fields2 = run([LARK_CLI, "base", "+field-list", "--base-token", BT, "--table-id", TI, "--limit", "200"])
    field_names = [f["name"] for f in all_fields2["data"]["fields"] if f["type"] == "number"]

    for dim_name, indices in DIMENSIONS:
        formula_name = FORMULA_PREFIX + dim_name
        q_names = [field_names[i] for i in indices]
        expr = "AVERAGE(" + ",".join(f"[{n}]" for n in q_names) + ")"

        try:
            run([LARK_CLI, "base", "+field-create",
                "--base-token", BT, "--table-id", TI,
                "--json", json.dumps({"type": "formula", "name": formula_name, "expression": expr}),
                "--i-have-read-guide"])
            print(f"  {formula_name}: OK")
        except Exception as e:
            print(f"  {formula_name}: ERR {str(e)[:80]}")
        time.sleep(0.5)
else:
    print("\nStep 4: 跳过公式字段创建")

# Step 5: 创建仪表盘
print("\nStep 5: 创建仪表盘...")
data = run([LARK_CLI, "base", "+dashboard-create", "--base-token", BT, "--name", f"{SURVEY_NAME}看板"])
DI = data["data"]["dashboard"]["dashboard_id"]
print(f"  Dashboard ID: {DI}")

# 指标卡（填写人数）
run([LARK_CLI, "base", "+dashboard-block-create",
    "--base-token", BT, "--dashboard-id", DI,
    "--name", "填写人数", "--type", "statistics",
    "--data-config", json.dumps({"table_name": "数据表", "count_all": True})])

# 获取实际字段名（用最新的字段列表，--limit 200）
all_fields3 = run([LARK_CLI, "base", "+field-list", "--base-token", BT, "--table-id", TI, "--limit", "200"])
field_names = [f["name"] for f in all_fields3["data"]["fields"] if f["type"] == "number"]

# 维度图表（每维度一张条形图）
block_ids = []
for dim_name, indices in DIMENSIONS:
    q_names = [field_names[i] for i in indices]
    series = [{"field_name": n, "rollup": "AVERAGE"} for n in q_names]

    # 如果启用了公式，在 series 最前面加上均分
    if ENABLE_FORMULA:
        series.insert(0, {"field_name": FORMULA_PREFIX + dim_name, "rollup": "AVERAGE"})

    config = {"table_name": "数据表", "series": series}

    result = run([LARK_CLI, "base", "+dashboard-block-create",
        "--base-token", BT, "--dashboard-id", DI,
        "--name", dim_name, "--type", "bar",
        "--data-config", json.dumps(config, ensure_ascii=False),
        "--no-validate"])  # --no-validate 防止飞书自动加 group_by
    block_ids.append(result["data"]["block"]["block_id"])
    print(f"  图表: {dim_name}")
    time.sleep(0.5)

# 如果不分组，显式清除飞书自动添加的 group_by
if not ENABLE_GROUP_BY:
    print("\n  清除自动 group_by...")
    for i, (dim_name, indices) in enumerate(DIMENSIONS):
        q_names = [field_names[j] for j in indices]
        series = [{"field_name": n, "rollup": "AVERAGE"} for n in q_names]
        if ENABLE_FORMULA:
            series.insert(0, {"field_name": FORMULA_PREFIX + dim_name, "rollup": "AVERAGE"})
        config = {"table_name": "数据表", "series": series, "group_by": []}

        try:
            run([LARK_CLI, "base", "+dashboard-block-update",
                "--base-token", BT, "--dashboard-id", DI,
                "--block-id", block_ids[i],
                "--data-config", json.dumps(config, ensure_ascii=False),
                "--no-validate"])
        except Exception as e:
            print(f"  {dim_name} clear group_by: ERR {str(e)[:60]}")
        time.sleep(0.3)
    print("  group_by 清除完成")

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
