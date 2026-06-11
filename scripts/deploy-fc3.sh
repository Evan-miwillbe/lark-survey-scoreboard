#!/bin/bash
# Deploy the API to Alibaba Cloud FC3.
# Prerequisites:
#   1. npm install -g @serverless-devs/s
#   2. s config add
#   3. cp s.yaml.example s.yaml and fill FEISHU_APP_ID / FEISHU_APP_SECRET

set -euo pipefail

echo "=== Deploy API to Alibaba Cloud FC3 ==="

if ! command -v s >/dev/null 2>&1; then
  echo "Serverless Devs is missing. Install it with: npm install -g @serverless-devs/s"
  exit 1
fi

if [ ! -f s.yaml ]; then
  echo "Missing s.yaml. Copy s.yaml.example to s.yaml and fill the Feishu credentials first."
  exit 1
fi

if [ -f bootstrap ]; then
  sed -i 's/\r$//' bootstrap
fi

echo "[1/3] Install production dependencies..."
npm install --omit=dev

echo "[2/3] Deploy function..."
s deploy

echo "[3/3] Done."
echo ""
echo "Next:"
echo "  1. Copy the FC3 HTTP trigger URL from the deploy output."
echo "  2. Set window.SCOREBOARD_API_BASE in public/config.js to that URL."
echo "  3. Push public/ to GitHub Pages."
