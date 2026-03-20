#!/usr/bin/env node
/**
 * NFC tag reader — polls libnfc for tags and forwards UIDs to the player.
 *
 * Usage:
 *   node nfc-reader.js [--player-url http://127.0.0.1:7070] [--poll-ms 800] [--cooldown-ms 3000]
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

const PLAYER_URL = argVal("--player-url", "http://127.0.0.1:7070");
const POLL_MS = Number(argVal("--poll-ms", "800"));
const COOLDOWN_MS = Number(argVal("--cooldown-ms", "3000"));

let lastUid = "";
let lastUidAt = 0;

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
            console.log(`[nfc] player response: state=${parsed.state} action=${parsed.action}`);
          } catch (_) {
            console.log(`[nfc] player response: ${res.statusCode}`);
          }
          resolve();
        });
      },
    );
    req.on("error", (e) => {
      console.error(`[nfc] player unreachable: ${e.message}`);
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

    console.log(`[nfc] tag detected: ${uid}`);
    await sendNfcTap(uid);
  } catch (e) {
    console.error(`[nfc] error: ${e.message}`);
  }
}

console.log(`[nfc] polling every ${POLL_MS}ms — player at ${PLAYER_URL} — cooldown ${COOLDOWN_MS}ms`);
console.log("[nfc] place a tag on the reader...");

setInterval(tick, POLL_MS);
tick();
