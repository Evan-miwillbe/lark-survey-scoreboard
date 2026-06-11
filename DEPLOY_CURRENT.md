# Current Deployment Notes

This project follows the repository deployment model:

- Feishu Form: participants fill the official Feishu questionnaire.
- FC3 API: `src/server.js` reads Feishu Base records and calculates the live stats.
- GitHub Pages: `public/` hosts the static entry page and dashboard.

## 1. Deploy API to FC3

Do not commit real Feishu credentials.

```bash
cp s.yaml.example s.yaml
# Edit s.yaml and fill FEISHU_APP_ID / FEISHU_APP_SECRET.
bash scripts/deploy-fc3.sh
```

After deployment, keep the FC3 HTTP trigger URL.

## 2. Point GitHub Pages to FC3

Edit `public/config.js`:

```js
window.SCOREBOARD_API_BASE = "https://your-function.cn-hangzhou.fcapp.run";
```

For a quick test without editing the file, append the API URL:

```text
https://<user>.github.io/<repo>/dashboard.html?api=https://your-function.cn-hangzhou.fcapp.run
```

## 3. Enable GitHub Pages

Push the repository, then in GitHub:

- Settings -> Pages
- Source: GitHub Actions
- The included `.github/workflows/pages.yml` publishes the `public/` folder.
- The workflow runs on both `main` and `master`.

The important URLs are:

- `index.html`: entry page
- `rating.html`: Feishu questionnaire entrance
- `dashboard.html`: live scoreboard
