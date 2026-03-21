#!/usr/bin/env node
/**
 * NFC tag reader — polls libnfc for tags and forwards UIDs to the player.
 *
 * Usage:
 *   node nfc-reader.js [--player-url http://127.0.0.1:7070] [--poll-ms 800] [--cooldown-ms 3000]
 *
 * Environment variables (used as fallbacks when CLI args are not provided):
 *   PLAYER_PORT  — player port (builds URL as http://127.0.0.1:${PLAYER_PORT})
 *   NFC_POLL_MS  — poll interval in ms (default 800)
 *   NFC_COOLDOWN_MS — cooldown between same-tag reads in ms (default 3000)
 *
 * Requires: libnfc-bin (nfc-list) installed.
 * The reader must be connected before starting this script.
 */

const { execFile } = require("child_process");
const http = require("http");

/* ── CLI args ── */
const args = process.argv.slice(2);
function argVal(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const PLAYER_URL = argVal(
  "--player-url",
  process.env.PLAYER_PORT
    ? `http://127.0.0.1:${process.env.PLAYER_PORT}`
    : "http://127.0.0.1:7070",
);
const POLL_MS = Number(argVal("--poll-ms", process.env.NFC_POLL_MS || "800"));
const COOLDOWN_MS = Number(argVal("--cooldown-ms", process.env.NFC_COOLDOWN_MS || "3000"));

/* ── Structured logging ── */
function log(level, msg, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: "ids-nfc-reader",
    msg,
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  };
  const out = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(out + "\n");
  } else {
    process.stdout.write(out + "\n");
  }
}

let lastUid = "";
let lastUidAt = 0;
let pollTimer = null;

/**
 * Checks whether nfc-list is available on the system.
 *
 * @returns {Promise<boolean>}
 */
function checkNfcListInstalled() {
  return new Promise((resolve) => {
    execFile("which", ["nfc-list"], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Runs nfc-list and parses any tag UID from the output.
 *
 * @returns {Promise<string|null>} Tag UID hex string or null.
 */
function pollNfcList() {
  return new Promise((resolve) => {
    execFile("nfc-list", { timeout: 4000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);

      // nfc-list output contains lines like:
      //   UID (NFCID1): 04  a2  b3  c4  d5  e6  f7
      const match = stdout.match(/UID\s*\(NFCID1\)\s*:\s*(.+)/i);
      if (!match) return resolve(null);

      const uid = match[1].replace(/\s+/g, "").toLowerCase();
      return resolve(uid || null);
    });
  });
}

/**
 * Posts an nfc_tap event to the player service.
 *
 * @param {string} uid - Tag UID.
 * @returns {Promise<void>}
 */
function sendNfcTap(uid) {
  return new Promise((resolve, reject) => {
    const url = new URL("/events", PLAYER_URL);
    const payload = JSON.stringify({ type: "nfc_tap", nfcUid: uid, source: "nfc_reader" });

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
        timeout: 3000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            log("info", "player_response", { state: parsed.state, action: parsed.action });
          } catch (_) {
            log("info", "player_response", { statusCode: res.statusCode });
          }
          resolve();
        });
      },
    );
    req.on("error", (e) => {
      log("error", "player_unreachable", { message: e.message });
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

async function tick() {
  try {
    const uid = await pollNfcList();
    if (!uid) return;

    const now = Date.now();
    const isSameTap = uid === lastUid && now - lastUidAt < COOLDOWN_MS;
    if (isSameTap) return;

    lastUid = uid;
    lastUidAt = now;

    log("info", "tag_detected", { uid });
    await sendNfcTap(uid);
  } catch (e) {
    log("error", "poll_error", { message: e.message });
  }
}

/* ── Graceful shutdown ── */
function shutdown(signal) {
  log("info", "shutdown", { signal });
  if (pollTimer) clearInterval(pollTimer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* ── Main ── */
(async () => {
  const hasNfcList = await checkNfcListInstalled();
  if (!hasNfcList) {
    log("error", "nfc_list_not_found", {
      message: "nfc-list is not installed. Install libnfc-bin: sudo apt install libnfc-bin",
    });
    process.exit(1);
  }

  log("info", "started", { playerUrl: PLAYER_URL, pollMs: POLL_MS, cooldownMs: COOLDOWN_MS });

  pollTimer = setInterval(tick, POLL_MS);
  tick();
})();
