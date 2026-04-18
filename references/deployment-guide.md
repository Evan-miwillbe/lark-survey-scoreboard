# 进阶版部署指南

## 架构概览

进阶版采用**前后端分离部署**：

| 组件 | 部署位置 | 原因 |
|------|---------|------|
| API 服务（Node.js） | 阿里云函数计算 FC3 | 国内公网可达，免费额度足够 |
| HTML 静态文件 | GitHub Pages | 免费，正确返回 Content-Type: text/html |

**为什么不能把 HTML 也放在 FC3？** FC3 的 HTTP 触发器会在所有响应中注入 `Content-Disposition: attachment`，导致浏览器下载 HTML 而不是渲染。这是平台级行为，无法在应用层覆盖。

**为什么不能用阿里云 OSS？** OSS 共享域名也会对所有文件强制添加 `x-oss-force-download: true`，绑定自定义域名需要 ICP 备案。

## 零、安全提醒

**不要把凭据提交到 git 仓库。**

s.yaml 中包含 `FEISHU_APP_SECRET`，建议：

1. 在 `.gitignore` 中添加 `s.yaml` 和 `s.env`
2. 或使用 Serverless Devs 的密钥管理：`s config add` 存储阿里云 AccessKey
3. 飞书应用凭据通过 `s.yaml` 的 `environmentVariables` 传入，但不提交到版本控制
4. 推荐：在 `.gitattributes` 中设置 `bootstrap text eol=lf`，避免 Windows CRLF 问题

## 一、部署 API 到阿里云 FC3

### 1.1 前置准备

```bash
# 安装 Serverless Devs
npm install -g @serverless-devs/s

# 配置阿里云密钥（AccessKey ID + AccessKey Secret）
s config add
```

### 1.2 创建 s.yaml

```yaml
edition: 3.0.0
name: your-project-name
access: default

vars:
  region: cn-hangzhou    # 选择离你用户最近的区域

resources:
  your-project:
    component: fc3
    props:
      region: ${vars.region}
      functionName: your-function-name
      description: 你的项目描述
      runtime: custom.debian10
      code: ./
      handler: dummy          # custom runtime 不需要真实 handler
      memorySize: 512         # 512MB 足够
      timeout: 30
      environmentVariables:
        FEISHU_APP_ID: your_app_id           # 从飞书开放平台获取
        FEISHU_APP_SECRET: your_app_secret   # 从飞书开放平台获取
        NODE_ENV: production
      triggers:
        - triggerName: httpTrigger
          triggerType: http
          triggerConfig:
            authType: anonymous    # 允许匿名访问
            methods:
              - GET
              - POST
              - PUT
              - DELETE
              - PATCH
              - HEAD
              - OPTIONS           # 必须：CORS preflight 请求需要
```

### 1.3 创建 bootstrap（FC3 冷启动脚本）

FC3 的 `custom.debian10` 运行时需要自己准备 Node.js 环境。bootstrap 脚本在冷启动时自动下载 Node.js：

```bash
#!/bin/bash
set -e

NODE_VERSION="v20.11.0"
NODE_DIR="/tmp/node-runtime"
NODE_BIN="$NODE_DIR/bin/node"

if [ ! -f "$NODE_BIN" ]; then
  echo "Downloading Node.js ${NODE_VERSION}..."
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://npmmirror.com/mirrors/node/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C "$NODE_DIR" --strip-components=1
  echo "Node.js installed: $($NODE_BIN --version)"
fi

cd "$(dirname "$0")"
exec "$NODE_BIN" server.js
```

**注意：** 这个文件在 Windows 下创建后上传到 FC3，需要确保换行符是 LF（不是 CRLF）。可以用 `dos2unix bootstrap` 或 `sed -i 's/\r$//' bootstrap` 转换。

### 1.4 创建 index.js（FC3 占位入口）

```javascript
module.exports.handler = (request, response, context) => {
  response.setStatusCode(200);
  response.setHeader('Content-Type', 'text/html');
  response.send('<h1>OK</h1>');
};
```

### 1.5 创建 package.json

```json
{
  "name": "your-project-name",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@webserverless/fc-express": "^1.0.0",
    "express": "^4.21.0"
  }
}
```

### 1.6 创建 .gitignore

```
node_modules/
.env
```

### 1.7 安装依赖并部署

```bash
cd your-project/
npm install
s deploy
```

部署成功后，记下 FC3 HTTP 触发器的 URL，格式如：
`https://your-function-name.xxx.cn-hangzhou.fcapp.run`

### 1.8 验证 API

```bash
# 测试 API 是否正常
curl https://your-function-name.xxx.cn-hangzhou.fcapp.run/api/questions

# 应该返回 JSON：{"questions": [...], "dimensions": [...]}
```

## 二、部署 HTML 到 GitHub Pages

### 2.1 创建 GitHub 仓库

在 GitHub 上创建一个新仓库（如 `scoreboard-pages`），可以是私有或公开。

### 2.2 准备 HTML 文件

创建以下文件：

**index.html**（入口页，提供链接导航）:
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>项目名称</title>
<style>
body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:system-ui;background:#f5f5f5}
.card{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
h1{margin:0 0 8px;color:#1B2A4A;font-size:24px}
p{color:#666;margin:0 0 24px}
a{display:inline-block;padding:14px 32px;background:#1B2A4A;color:#fff;text-decoration:none;border-radius:8px;font-size:16px}
a:hover{background:#2D4A7A}
</style></head><body>
<div class="card">
<h1>项目名称</h1>
<p>请选择：</p>
<a href="rating.html" style="margin-bottom:12px">打开评分页面（手机）</a>
<br>
<a href="dashboard.html" style="background:#0B0F1A;margin-top:12px">打开大屏展示</a>
</div></body></html>
```

**rating.html 和 dashboard.html** 中必须设置 `API_BASE` 指向你的 FC3 URL：

```javascript
// 在 <script> 开头设置
const API_BASE = 'https://your-function-name.xxx.cn-hangzhou.fcapp.run';
```

### 2.3 推送并开启 Pages

```bash
cd scoreboard-pages/
git init
echo "node_modules/" > .gitignore
touch .nojekyll    # 防止 GitHub Pages 忽略下划线开头的文件
git add .
git commit -m "init: scoreboard pages"
git remote add origin https://github.com/your-username/scoreboard-pages.git
git push -u origin main
```

然后在 GitHub 仓库的 Settings → Pages 中：
- Source: Deploy from a branch
- Branch: `main` / `/ (root)`
- 点击 Save

等待 1-2 分钟后，访问：`https://your-username.github.io/scoreboard-pages/rating.html`

### 2.4 验证

在浏览器中打开：
1. `https://your-username.github.io/scoreboard-pages/rating.html` → 应该显示注册界面
2. `https://your-username.github.io/scoreboard-pages/dashboard.html` → 应该显示暗色大屏

## 三、本地开发调试

在部署到云之前，可以先本地测试：

```bash
cd your-project/
npm install
node server.js
# 服务器启动在 http://localhost:3000
```

本地调试时，HTML 文件中的 `API_BASE` 可以改为：
- `const API_BASE = '';` — 使用相对路径（HTML 和 API 在同一服务器）
- 或 `const API_BASE = 'http://localhost:3000';` — 如果 HTML 是直接打开的文件

**本地开发完成后，记得把 `API_BASE` 改回 FC3 的 URL 再推送到 GitHub。**

## 四、FC3 费用说明

阿里云函数计算 FC3 有免费额度：
- 每月 100 万次调用
- 每月 40 万 GB-秒 内存使用

评分场景（几十到几百人，持续几小时）完全在免费额度内。

## 五、更新部署

### 更新 API 代码
```bash
cd your-project/
# 修改代码后
s deploy
```

### 更新 HTML 页面
```bash
cd scoreboard-pages/
# 修改代码后
git add .
git commit -m "update: 描述修改内容"
git push
# GitHub Pages 会自动重新部署（约1-2分钟）
```

## 六、备选部署方案

如果 GitHub Pages 在中国访问不稳定，备选方案（按推荐度排序）：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **自有服务器 + Nginx** | 完全可控，国内速度快 | 需要购买服务器（约¥50-100/月） |
| **阿里云 OSS + 自定义域名** | 速度快 | 需要已备案的域名 |
| **Cloudflare Pages** | 免费全球 CDN | 国内速度不如直连 |
| **Gitee Pages** | 国内访问快 | 需要实名认证，功能受限 |
