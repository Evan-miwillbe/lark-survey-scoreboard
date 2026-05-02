#!/bin/bash
# 一键创建飞书 Base + 表单 + 仪表盘
# 用法: bash scripts/setup-base.sh "问卷名称" "题目1" "题目2" "题目3" ...
# 依赖: lark-cli 已安装并登录

set -e

SURVEY_NAME="${1:-我的评分问卷}"
shift 2>/dev/null || true

# 如果没传题目参数，使用默认示例
if [ $# -eq 0 ]; then
  QUESTIONS=("沟通表达清晰" "主动倾听他人" "团队协作意识" "解决问题能力" "创新思维" "执行力")
else
  QUESTIONS=("$@")
fi

echo "=== 飞书实时评分系统 一键搭建 ==="
echo "问卷名称: $SURVEY_NAME"
echo "题目数量: ${#QUESTIONS[@]}"
echo ""

# Step 1: 创建 Base
echo "[1/4] 创建多维表格..."
BASE_RESULT=$(lark-cli base +base-create --name "$SURVEY_NAME" 2>&1)
BASE_TOKEN=$(echo "$BASE_RESULT" | grep -oP 'app_token["\s:]+\K[A-Za-z0-9]+' || echo "$BASE_RESULT" | grep -oP '[A-Za-z0-9]{20,}')
echo "  Base Token: $BASE_TOKEN"

# Step 2: 获取默认表 ID
echo "[2/4] 获取表 ID..."
TABLE_RESULT=$(lark-cli base +table-list --base-token "$BASE_TOKEN" 2>&1)
TABLE_ID=$(echo "$TABLE_RESULT" | grep -oP 'table_id["\s:]+\K[a-z0-9]+' || echo "$TABLE_RESULT" | grep -oP 'tbl[A-Za-z0-9]+')
echo "  Table ID: $TABLE_ID"

# Step 3: 创建表单
echo "[3/4] 创建表单并添加题目..."
FORM_RESULT=$(lark-cli base +form-create \
  --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" \
  --name "$SURVEY_NAME" \
  --description "请给以下各项打分（1-10分）" 2>&1)
FORM_ID=$(echo "$FORM_RESULT" | grep -oP 'form_id["\s:]+\K[A-Za-z0-9]+')
echo "  Form ID: $FORM_ID"

# 添加姓名题
lark-cli base +form-questions-create \
  --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" --form-id "$FORM_ID" \
  --questions '[{"type":"text","title":"您的姓名","required":true}]' >/dev/null 2>&1

# 添加部门题
lark-cli base +form-questions-create \
  --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" --form-id "$FORM_ID" \
  --questions '[{"type":"text","title":"部门名称","required":true}]' >/dev/null 2>&1

# 逐条添加评分题
for q in "${QUESTIONS[@]}"; do
  lark-cli base +form-questions-create \
    --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" --form-id "$FORM_ID" \
    --questions "[{\"type\":\"number\",\"title\":\"$q\",\"required\":true,\"style\":{\"type\":\"rating\",\"icon\":\"number\",\"min\":1,\"max\":10}}]" >/dev/null 2>&1
  echo "  + $q"
done

# Step 4: 创建仪表盘
echo "[4/4] 创建仪表盘..."
DASH_RESULT=$(lark-cli base +dashboard-create --base-token "$BASE_TOKEN" --name "${SURVEY_NAME}看板" 2>&1)
DASH_ID=$(echo "$DASH_RESULT" | grep -oP 'dashboard_id["\s:]+\K[A-Za-z0-9]+' || echo "$DASH_RESULT" | grep -oP 'blk[A-Za-z0-9]+')

echo ""
echo "=== 搭建完成 ==="
echo ""
echo "配置信息（请保存）:"
echo "  FEISHU_BASE_TOKEN=$BASE_TOKEN"
echo "  FEISHU_TABLE_ID=$TABLE_ID"
echo ""
echo "下一步:"
echo "  1. 将上面的配置写入 .env 文件"
echo "  2. 运行 npm install && npm start"
echo "  3. 手机访问 http://localhost:3000/rating.html"
echo "  4. 大屏访问 http://localhost:3000/dashboard.html"
