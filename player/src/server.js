/**
 * IDS — Local Event Ingestion Server (Phase 3)
 * File: player/src/server.js
 *
 * PURPOSE
 *   Accept events over HTTP so we can simulate NFC/vision without hardware.
 *
 * ENDPOINTS
 *   - POST /events  (JSON body: event)
 *   - GET  /state   (current state snapshot)
 *
 * DESIGN
 *   - No external dependencies (uses Node built-in http).
 *   - Strict JSON parsing and strict event validation.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { validateEvent } = require("./events");
const { STATES, transition } = require("./fsm");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
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

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".otf") return "font/otf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
}

function serveStatic(reqPath, res) {
  const publicDir = path.resolve(__dirname, "../public");
  const requested = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.resolve(publicDir, normalized);

  if (!filePath.startsWith(publicDir)) {
    return json(res, 403, { error: "forbidden" });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return json(res, 404, { error: "not_found" });
  }

  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": data.byteLength,
    "Cache-Control": "no-store",
  });
  res.end(data);
  return null;
}

function createGuidedItem(text) {
  return {
    contentId: "guided-flow-item",
    type: "TEXT",
    data: text,
    durationSec: 9999,
    order: 1,
  };
}

function createServer({ scheduler, port = 7070, guidedFlow = false } = {}) {
  let state = STATES.IDLE;
  const streamClients = new Set();
  let currentView = guidedFlow ? createGuidedItem("Hello") : null;

  function broadcast(event, payload) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of streamClients) {
      client.write(data);
    }
  }

  function renderGuidedText(text) {
    const item = createGuidedItem(text);
    currentView = item;
    broadcast("render", { item, campaignId: "guided-flow", campaignName: "GuidedFlow" });
  }

  if (scheduler) {
    scheduler.onRender = ({ item, campaignId, campaignName }) => {
      broadcast("render", { item, campaignId, campaignName });
    };
    scheduler.onClear = ({ reason }) => {
      broadcast("clear", { reason });
    };
    scheduler.onIdleTimeout = () => {
      const prev = state;
      try {
        const t = transition(state, "IDLE");
        state = t.nextState;
        console.log("=== STATE TRANSITION ===");
        if (t.changed) {
          console.log(`state: ${prev} -> ${state} (inactivity timeout)`);
        } else {
          console.log(`state: ${prev} (no change)`);
        }
      } catch (e) {
        console.log("=== STATE ERROR ===");
        console.log(e.message);
      }
    };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/render-stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write("event: ready\ndata: {\"ok\":true}\n\n");
      if (guidedFlow && currentView) {
        res.write(
          `event: render\ndata: ${JSON.stringify({
            item: currentView,
            campaignId: "guided-flow",
            campaignName: "GuidedFlow",
          })}\n\n`
        );
      }
      streamClients.add(res);
      req.on("close", () => {
        streamClients.delete(res);
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      return json(res, 200, { state });
    }

    if (req.method === "GET" && url.pathname === "/events") {
      return json(res, 200, {
        message: "Use POST /events to inject IDS events",
        example: {
          method: "POST",
          path: "/events",
          body: {
            type: "VISION_PRESENT",
            timestamp: "2026-02-18T10:00:00Z",
          },
        },
      });
    }

    if (req.method === "POST" && url.pathname === "/events") {
      let event;
      try {
        event = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      const v = validateEvent(event);
      if (!v.ok) {
        return json(res, 400, { error: v.error });
      }

      // Log event
      console.log("");
      console.log("=== EVENT RECEIVED ===");
      console.log(JSON.stringify(event, null, 2));

      // Apply transition
      const prev = state;
      try {
        const t = transition(state, event.type);
        state = t.nextState;

        console.log("=== STATE TRANSITION ===");
        if (t.changed) {
          console.log(`state: ${prev} -> ${state}`);
        } else {
          console.log(`state: ${prev} (no change)`);
        }

        if (guidedFlow) {
          if (event.type === "IDLE") {
            renderGuidedText("Hello");
          } else if (event.type === "VISION_PRESENT") {
            renderGuidedText("Visitor\nTap to connect");
          } else if (event.type === "NFC_TAP") {
            const safeName = String(event.studentId || "").trim() || "Visitor";
            renderGuidedText(`Hello ${safeName}`);
          }
        } else if (scheduler) {
          scheduler.handleEvent(event.type);
        }

        return json(res, 200, { ok: true, prevState: prev, nextState: state, changed: t.changed });

      } catch (e) {
        console.log("=== STATE ERROR ===");
        console.log(e.message);
        return json(res, 409, { error: e.message, state });
      }
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    return json(res, 404, { error: "Not found" });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`IDS event server listening on http://127.0.0.1:${port}`);
    console.log("Try:");
    console.log(`  curl -s http://127.0.0.1:${port}/state | jq`);
  });

  return server;
}

module.exports = { createServer };
