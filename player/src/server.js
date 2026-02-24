/**
 * IDS Player — HTTP Server
 *
 * Endpoints:
 * - GET /fetch → return current campaign item (with state display)
 * - POST /events → accept { type, data } and transition to next item
 * - GET / → simple status page
 */

const http = require("http");

class CampaignExecutor {
  constructor(config) {
    this.campaigns = config.campaigns;
    this.currentCampaignIdx = 0;
    this.currentItemIdx = 0;
    this.state = "idle";
  }

  getCurrentItem() {
    const campaign = this.campaigns[this.currentCampaignIdx];
    if (!campaign) return null;
    const item = campaign.items[this.currentItemIdx];
    return item || null;
  }

  nextItem() {
    const campaign = this.campaigns[this.currentCampaignIdx];
    if (!campaign) return;
    if (this.currentItemIdx < campaign.items.length - 1) {
      this.currentItemIdx++;
    } else {
      this.currentCampaignIdx = (this.currentCampaignIdx + 1) % this.campaigns.length;
      this.currentItemIdx = 0;
    }
  }

  handleEvent(event) {
    const { type } = event;
    this.state = type;
    if (type === "tap" || type === "visitor") {
      this.nextItem();
    }
    return { status: "ok", state: this.state, item: this.getCurrentItem() };
  }

  getStatus() {
    return {
      state: this.state,
      campaignIdx: this.currentCampaignIdx,
      itemIdx: this.currentItemIdx,
      currentItem: this.getCurrentItem(),
    };
  }
}

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function html(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function createServer({ config, port = 7070 }) {
  const executor = new CampaignExecutor(config);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      const item = executor.getCurrentItem();
      const itemName = item ? item.itemName : "NONE";
      const state = executor.state;
      const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IDS Player</title>
  <style>
    body { font: 24px monospace; background: #1a1a1a; color: #00ff00; padding: 40px; }
    .state { font-size: 48px; margin: 20px 0; }
    .item { background: #222; padding: 20px; margin: 20px 0; }
    .status { opacity: 0.7; }
    button { font: 20px monospace; padding: 10px 20px; margin: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>IDS Player</h1>
  <div class="state" id="state">${state.toUpperCase()}</div>
  <div class="item">
    <strong>Current Item:</strong> ${itemName}
  </div>
  <div class="status">
    <p>Campaign: ${executor.currentCampaignIdx + 1} / ${executor.campaigns.length}</p>
    <p>Item: ${executor.currentItemIdx + 1} / ${executor.campaigns[executor.currentCampaignIdx]?.items.length || 0}</p>
  </div>
  <div>
    <button onclick="sendEvent('idle')">IDLE</button>
    <button onclick="sendEvent('connect')">CONNECT</button>
    <button onclick="sendEvent('nfc')">NFC</button>
    <button onclick="sendEvent('tap')">TAP</button>
    <button onclick="sendEvent('visitor')">VISITOR</button>
  </div>
  <script>
    function sendEvent(type) {
      fetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      }).then(r => r.json()).then(data => {
        document.getElementById('state').innerText = data.state.toUpperCase();
        location.reload();
      });
    }
  </script>
</body>
</html>
      `;
      return html(res, 200, body);
    }

    if (req.method === "GET" && url.pathname === "/fetch") {
      const status = executor.getStatus();
      return json(res, 200, status);
    }

    if (req.method === "POST" && url.pathname === "/events") {
      let event;
      try {
        event = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
      const result = executor.handleEvent(event);
      return json(res, 200, result);
    }

    return json(res, 404, { error: "not_found" });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[Player] Listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer };
