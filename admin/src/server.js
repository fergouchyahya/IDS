/**
 * IDS Admin — HTTP API + simple web UI.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const {
  readState,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setActiveCampaigns,
  setSettings,
  upsertStudent,
  deleteStudent,
  setMenuCampaign,
  toRuntimeConfig,
} = require("./storage");

const ADMIN_UI_JS_PATH = path.resolve(__dirname, "../public/admin-ui.js");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res, code, body, contentType) {
  res.writeHead(code, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function renderAdminPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDS Admin</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; color: #111; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #ddd; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    input, select, textarea, button { font: inherit; padding: 8px 10px; }
    textarea { width: 100%; min-height: 90px; }
    .list { margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; }
    .item { border: 1px solid #e9e9e9; border-radius: 8px; padding: 8px; margin-bottom: 8px; background: #fafafa; }
    .mono { font-family: monospace; font-size: 12px; }
    .good { color: #0a7a3f; }
    .bad { color: #b52222; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>IDS Admin</h1>
    <div id="status"></div>

    <div class="grid">
      <section class="card">
        <h2>Settings</h2>
        <div class="row">
          <label>Inactivity timeout (ms)</label>
          <input id="timeoutMs" type="number" min="100" step="100" />
          <button onclick="saveSettings()">Save</button>
        </div>
      </section>

      <section class="card">
        <h2>Active Campaign Selection</h2>
        <div class="row">
          <label>Idle:</label>
          <select id="activeIdle"></select>
          <label>Visitor:</label>
          <select id="activeVisitor"></select>
          <button onclick="saveActive()">Apply</button>
        </div>
      </section>

      <section class="card">
        <h2>Menu Campaign</h2>
        <div class="row">
          <input id="menuName" placeholder="Menu name" />
        </div>
        <textarea id="menuItems" placeholder='JSON array of items: [{"type":"TEXT","data":"Student or Visitor","order":1,"durationSec":60}]'></textarea>
        <div class="row">
          <button onclick="saveMenu()">Save Menu</button>
        </div>
      </section>

      <section class="card">
        <h2>Create Campaign (Idle/Visitor)</h2>
        <div class="row">
          <select id="campaignKind">
            <option value="idle">Idle</option>
            <option value="visitor">Visitor</option>
          </select>
          <input id="campaignName" placeholder="Campaign name" />
        </div>
        <textarea id="campaignItems" placeholder='JSON array of items: [{"type":"TEXT","data":"Page 1","order":1,"durationSec":30}]'></textarea>
        <div class="row">
          <button onclick="createCampaignUI()">Create campaign</button>
        </div>
      </section>

      <section class="card">
        <h2>Students (NFC UID -> personal campaign)</h2>
        <div class="row">
          <input id="studentUid" placeholder="NFC UID" />
          <input id="studentName" placeholder="Student name" />
        </div>
        <textarea id="studentItems" placeholder='JSON array of items: [{"type":"TEXT","data":"Timetable...","order":1,"durationSec":30}]'></textarea>
        <div class="row">
          <button onclick="saveStudent()">Save/Update student</button>
        </div>
      </section>

      <section class="card">
        <h2>Current Data</h2>
        <div id="lists"></div>
      </section>
    </div>
  </div>
  <script src="/admin-ui.js"></script>
</body>
</html>`;
}

function createServer({ port = 8081 } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return text(res, 200, renderAdminPage(), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/admin-ui.js") {
      const script = fs.readFileSync(ADMIN_UI_JS_PATH, "utf8");
      return text(res, 200, script, "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const state = readState();
      return json(res, 200, { state });
    }

    if (req.method === "GET" && url.pathname === "/runtime-config") {
      const state = readState();
      return json(res, 200, toRuntimeConfig(state));
    }

    if (req.method === "POST" && url.pathname === "/api/campaigns") {
      try {
        const body = await readJsonBody(req);
        const state = createCampaign(body);
        return json(res, 201, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const body = await readJsonBody(req);
        const state = updateCampaign(campaignId, body);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteCampaign(campaignId);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/active") {
      try {
        const body = await readJsonBody(req);
        const state = setActiveCampaigns(body);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      try {
        const body = await readJsonBody(req);
        const state = setSettings(body);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/menu-campaign") {
      try {
        const body = await readJsonBody(req);
        const state = setMenuCampaign(body);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/students") {
      try {
        const body = await readJsonBody(req);
        const state = upsertStudent(body);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/students/")) {
      const uid = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteStudent(uid);
        return json(res, 200, { state });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    return json(res, 404, { error: `not_found: ${url.pathname}` });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`IDS Admin listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer };
