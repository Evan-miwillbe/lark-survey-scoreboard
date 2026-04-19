# 维度-题目映射规则

## 等间隔映射（最常用）

当题目按"循环覆盖"方式设计时使用：每D道题覆盖所有维度，重复K轮。

**参数：**
- N = 总题数
- D = 维度数
- K = N / D = 每维度题数

**公式：** 维度i（0-based）包含题目索引 `[i, i+D, i+2D, ..., i+(K-1)*D]`

**示例：120题 / 12维度 / 每维度10题**

| 维度 | 题目编号 |
|------|---------|
| 1 | Q1, Q13, Q25, Q37, Q49, Q61, Q73, Q85, Q97, Q109 |
| 2 | Q2, Q14, Q26, Q38, Q50, Q62, Q74, Q86, Q98, Q110 |
| ... | ... |
| 12 | Q12, Q24, Q36, Q48, Q60, Q72, Q84, Q96, Q108, Q120 |

## Python 生成代码

```python
def build_dimensions(dim_names, total_questions):
    """等间隔映射：生成 (维度名, [题目索引]) 列表"""
    D = len(dim_names)
    K = total_questions // D
    dimensions = []
    for i, name in enumerate(dim_names):
        indices = [i + D * k for k in range(K)]
        dimensions.append((name, indices))
    return dimensions

# 使用示例
dims = build_dimensions(
    ["维度1", "维度2", "维度3", "维度4", "维度5",
     "维度6", "维度7", "维度8", "维度9", "维度10", "维度11", "维度12"],
    120
)
```

## 自定义映射

如果题目不是等间隔分布，直接手动指定：

```python
dimensions = [
    ("维度A", [0, 1, 2]),
    ("维度B", [3, 4, 5, 6]),
    # ...
]
```

## 映射验证

创建图表前，务必核对字段名顺序：

```bash
# 导出表单题目顺序
lark-cli base +form-questions-list \
  --base-token <BT> --table-id <TI> --form-id <FI> \
  -q '[.data.questions[] | select(.type=="number") | .title]'
```

将输出与用户提供的题目列表逐条比对，确认索引对应正确。
