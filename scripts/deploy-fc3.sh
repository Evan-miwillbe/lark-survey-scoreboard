#!/bin/bash
# 部署到阿里云 FC3（Serverless）
# 前提：已安装 @serverless-devs/s 并配置阿里云密钥

set -e

echo "=== 部署到阿里云 FC3 ==="

# 检查 s CLI
if ! command -v s &> /dev/null; then
  echo "请先安装 Serverless Devs: npm install -g @serverless-devs/s"
  exit 1
fi

# 确保 bootstrap 文件换行符正确
if [ -f bootstrap ]; then
  sed -i 's/\r$//' bootstrap
fi

echo "[1/3] 安装依赖..."
npm install --production

echo "[2/3] 部署函数..."
s deploy

echo "[3/3] 部署完成！"
echo ""
echo "部署后:"
echo "  1. 修改 public/rating.html 中的 API_BASE 为 FC3 返回的 URL"
echo "  2. 修改 public/dashboard.html 中的 API_BASE 为同一 URL"
echo "  3. 推送 public/ 到 GitHub Pages"
