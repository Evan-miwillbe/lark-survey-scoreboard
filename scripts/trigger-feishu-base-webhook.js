require('../src/env').loadEnv();

const API_BASE = (process.env.SCOREBOARD_API_BASE || 'https://lark-suoreboard-nxoslkqvrq.cn-hangzhou.fcapp.run').replace(/\/+$/, '');
const token = process.env.WEBHOOK_TOKEN || process.env.ADMIN_TOKEN || '';

async function main() {
  if (!token) throw new Error('Missing WEBHOOK_TOKEN or ADMIN_TOKEN.');

  const res = await fetch(`${API_BASE}/api/webhook/feishu-base`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-token': token,
    },
    body: JSON.stringify({ source: 'manual-verification' }),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Webhook failed with HTTP ${res.status}`);
  }
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
