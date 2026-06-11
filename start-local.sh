#!/bin/bash
# ============================================
# 诚信销售能力评估 - 现场启动脚本
# ============================================
# 用法: bash start-local.sh
# 启动后在手机/大屏上访问 http://你的IP:3000
# ============================================

cd "$(dirname "$0")"

echo "========================================"
echo "  诚信销售能力评估 - 现场服务器"
echo "========================================"
echo ""

# 检查 lark-cli 是否可用
if ! command -v lark-cli &>/dev/null; then
  echo "❌ 找不到 lark-cli，请先安装并登录"
  exit 1
fi

echo "✅ lark-cli 已就绪"

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
  cat > .env << 'EOF'
FEISHU_BASE_TOKEN=STIKbVfxvaxd4PsvdBKcaQTKnFe
FEISHU_TABLE_ID=tbl2uUjvQ4MochWh
FEISHU_APP_ID=cli_a94d2a4dd978dcc4
FEISHU_APP_SECRET=QWIqb2TPbNB2EgMNVKI1hiDLdutaEc4x
EOF
  echo "✅ .env 已创建"
fi

# 找本机 IP
echo ""
echo "----------------------------------------"
echo "  本机网络地址"
echo "----------------------------------------"
if command -v ipconfig &>/dev/null; then
  ipconfig | grep -A1 "IPv4" | grep -v "WSL" | head -3
else
  hostname -I 2>/dev/null || echo "  手动查看: 设置 → 网络 → WiFi属性"
fi
echo "----------------------------------------"

# 启动服务器
echo ""
echo "🚀 启动服务器..."
echo ""
echo "  手机评分页: http://你的IP:3000/rating.html"
echo "  大屏看板:   http://你的IP:3000/dashboard.html"
echo "  本地测试:   http://localhost:3000/dashboard.html"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo ""

node src/server.js
