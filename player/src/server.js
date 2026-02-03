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

function createServer({ scheduler, port = 7070 } = {}) {
  let state = STATES.IDLE;

  if (scheduler) {
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

    if (req.method === "GET" && url.pathname === "/state") {
      return json(res, 200, { state });
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

        if (scheduler) scheduler.handleEvent(event.type);

        return json(res, 200, { ok: true, prevState: prev, nextState: state, changed: t.changed });

      } catch (e) {
        console.log("=== STATE ERROR ===");
        console.log(e.message);
        return json(res, 409, { error: e.message, state });
      }
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
