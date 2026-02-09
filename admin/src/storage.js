/**
 * IDS Admin — Append-only storage for configs.
 * Stores one JSON record per line (JSONL).
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "configs.jsonl");

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "", "utf8");
  }
}

function appendConfigRecord(record) {
  ensureDataFile();
  const line = JSON.stringify(record);
  fs.appendFileSync(DATA_FILE, `${line}\n`, "utf8");
}

function readAllRecords() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  if (!raw.trim()) return [];

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Invalid JSONL at line ${idx + 1}`);
    }
  });
}

function listConfigMeta() {
  const records = readAllRecords();
  return records.map((r) => r.meta);
}

function getConfigById(configId) {
  const records = readAllRecords();
  for (const r of records) {
    if (r && r.meta && r.meta.configId === configId) return r;
  }
  return null;
}

module.exports = {
  appendConfigRecord,
  listConfigMeta,
  getConfigById,
};
