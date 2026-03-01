/**
 * IDS Admin — HTTP API + web UI.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const {
  ValidationError,
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
const DATA_DIR = process.env.IDS_ADMIN_DATA_DIR
  ? path.resolve(process.env.IDS_ADMIN_DATA_DIR)
  : path.resolve(__dirname, "../data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readJsonBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        reject(new ValidationError([{ path: "body", message: "Body too large", code: "too_large" }]));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new ValidationError([{ path: "body", message: "Invalid JSON body", code: "invalid_json" }]));
      }
    });
  });
}

function readRawBody(req, maxBytes = MAX_UPLOAD_SIZE + 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new ValidationError([{ path: "file", message: "Upload too large", code: "too_large" }]));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
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

function sendValidationError(res, err) {
  if (err instanceof ValidationError) {
    return json(res, 400, {
      error: "validation_failed",
      issues: err.issues,
    });
  }

  return json(res, 400, {
    error: "validation_failed",
    issues: [{ path: "request", message: err.message || "Invalid request", code: "invalid_request" }],
  });
}

function sanitizeFilename(filename) {
  return String(filename || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getExtFromMime(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  return "";
}

function isAllowedMimeType(mimeType) {
  return /^image\//.test(mimeType) || /^video\//.test(mimeType);
}

function buildAbsoluteUrl(req, pathname) {
  const configured = process.env.IDS_PUBLIC_ADMIN_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}${pathname}`;
  }

  const host = req.headers.host || "127.0.0.1:8081";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}${pathname}`;
}

function parseMultipartFile(bodyBuffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || "");
  if (!boundaryMatch) {
    throw new ValidationError([{ path: "file", message: "Missing multipart boundary", code: "invalid_multipart" }]);
  }

  const boundary = boundaryMatch[1].trim();
  const body = bodyBuffer.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = body.split(delimiter);

  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part || part === "--") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headerText = part.slice(0, headerEnd);
    const contentText = part.slice(headerEnd + 4).replace(/\r\n--$/, "");

    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText);
    if (!disposition) continue;

    const nameMatch = /name="([^"]+)"/i.exec(disposition[1]);
    const filenameMatch = /filename="([^"]*)"/i.exec(disposition[1]);

    if (!nameMatch || nameMatch[1] !== "file") continue;

    const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
    const mimeType = (mimeMatch?.[1] || "application/octet-stream").trim().toLowerCase();
    const originalName = filenameMatch?.[1] || "upload.bin";

    const fileBuffer = Buffer.from(contentText, "latin1");

    return {
      originalName,
      mimeType,
      buffer: fileBuffer,
      size: fileBuffer.length,
    };
  }

  throw new ValidationError([{ path: "file", message: "Missing file field in multipart payload", code: "required" }]);
}

function processUploadMultipart({ bodyBuffer, contentType, reqLike }) {
  const file = parseMultipartFile(bodyBuffer, contentType);

  if (file.size < 1) {
    throw new ValidationError([{ path: "file", message: "File is empty", code: "empty_file" }]);
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new ValidationError([{ path: "file", message: "File exceeds 20MB limit", code: "too_large" }]);
  }

  if (!isAllowedMimeType(file.mimeType)) {
    throw new ValidationError([
      { path: "file", message: "Only image/* and video/* uploads are allowed", code: "invalid_mime_type" },
    ]);
  }

  const safeBaseName = sanitizeFilename(file.originalName.replace(/\.[^.]+$/, "")) || "media";
  const ext = getExtFromMime(file.mimeType) || path.extname(file.originalName).toLowerCase() || ".bin";
  const mediaId = crypto.randomBytes(6).toString("hex");
  const filename = `${safeBaseName}-${mediaId}${ext}`;

  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);

  const urlPath = `/media/${filename}`;
  const absoluteUrl = buildAbsoluteUrl(reqLike || { headers: {} }, urlPath);

  return {
    mediaId,
    url: absoluteUrl,
    urlPath,
    mimeType: file.mimeType,
    size: file.size,
    filename,
  };
}

function resolveMimeByExtension(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function renderAdminPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Digital Signage Campaign Builder</title>
  <style>
    :root {
      --bg-primary: #f3f5f8;
      --bg-secondary: #ffffff;
      --bg-elevated: #f8fafc;
      --border: #e4e8ee;
      --border-light: #eef2f7;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-tertiary: #94a3b8;
      --accent: #0f6bff;
      --accent-light: #dbeafe;
      --accent-dark: #1d4ed8;
      --success: #059669;
      --danger: #dc2626;
      --warning: #ca8a04;
      --idle-accent: #2065d1;
      --visitor-accent: #0f9b8e;
      --student-accent: #9358c7;
      --menu-accent: #d4701f;
      --inspector-width: 320px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    body {
      font-family: "Inter", "SF Pro Text", "Segoe UI", "Helvetica Neue", "Arial", sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
    }

    /* Main Layout */
    .app-container {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--inspector-width);
      height: 100vh;
      gap: 0;
    }

    /* ===== CENTER CANVAS ===== */
    .center-canvas {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-primary);
    }

    .overview-shell {
      margin: 18px 20px 0 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      max-height: 42vh;
      display: flex;
      flex-direction: column;
    }

    .overview-floating-head {
      position: sticky;
      top: 0;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 16px;
      backdrop-filter: blur(8px);
      background: rgba(255, 255, 255, 0.88);
      border-bottom: 1px solid var(--border-light);
    }

    .overview-title {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .overview-sub {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .overview-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .overview-search,
    .overview-filter {
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 10px;
      font-size: 12px;
      padding: 8px 10px;
      transition: all 0.18s ease;
    }

    .overview-search {
      min-width: 190px;
    }

    .overview-search:focus,
    .overview-filter:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .btn-create {
      padding: 8px 12px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .btn-create:hover {
      background: var(--accent-dark);
      box-shadow: 0 8px 18px rgba(15, 107, 255, 0.25);
      transform: translateY(-1px);
    }

    .overview-grid {
      flex: 1;
      overflow: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      padding: 12px;
    }

    .overview-card {
      position: relative;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
      min-height: 170px;
      padding: 12px;
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      overflow: hidden;
    }

    .overview-card:hover {
      transform: translateY(-3px) scale(1.01);
      box-shadow: 0 14px 26px rgba(15, 23, 42, 0.13);
      border-color: #c8d1dd;
    }

    .overview-card.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-light), 0 16px 28px rgba(15, 23, 42, 0.12);
    }

    .overview-card.status-live:hover {
      box-shadow: 0 0 0 1px rgba(15, 107, 255, 0.25), 0 18px 32px rgba(15, 107, 255, 0.16);
    }

    .overview-card-accent {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--accent);
      opacity: 0.95;
    }

    .overview-card.type-idle .overview-card-accent { background: var(--idle-accent); }
    .overview-card.type-visitor .overview-card-accent { background: var(--visitor-accent); }
    .overview-card.type-student .overview-card-accent { background: var(--student-accent); }
    .overview-card.type-menu .overview-card-accent { background: var(--menu-accent); }

    .overview-card-top {
      margin-top: 2px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .type-badge,
    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 4px 8px;
    }

    .type-badge {
      color: #0f172a;
      background: #e9eef5;
    }

    .status-pill.live {
      color: #065f46;
      background: #d1fae5;
    }

    .status-pill.draft {
      color: #475569;
      background: #e2e8f0;
    }

    .overview-card-title {
      margin: 10px 0 2px;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: -0.02em;
      font-weight: 630;
      color: var(--text-primary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .overview-card-subtitle {
      margin: 0;
      font-size: 11px;
      color: var(--text-tertiary);
      min-height: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .overview-meta {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-secondary);
      gap: 10px;
    }

    .overview-timeline-bars {
      margin-top: 10px;
      display: flex;
      gap: 5px;
      align-items: flex-end;
      min-height: 12px;
    }

    .overview-bar {
      display: block;
      height: 7px;
      min-width: 12px;
      border-radius: 999px;
      background: linear-gradient(90deg, #d5ddeb 0%, #c7d4e6 100%);
      opacity: 0.95;
      transition: transform 0.18s ease;
    }

    .overview-card:hover .overview-bar {
      transform: translateY(-1px);
    }

    .overview-timeline-empty {
      margin-top: 10px;
      font-size: 11px;
      color: var(--text-tertiary);
    }

    .overview-actions {
      margin-top: 12px;
      display: flex;
      gap: 6px;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .overview-card:hover .overview-actions,
    .overview-card.active .overview-actions {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .overview-action {
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      padding: 6px 8px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .overview-action:hover {
      border-color: #bac7d8;
      color: var(--text-primary);
      background: #f8fbff;
    }

    .overview-action.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .overview-action.primary:hover {
      background: var(--accent-dark);
      border-color: var(--accent-dark);
    }

    .overview-empty {
      grid-column: 1 / -1;
      text-align: center;
      padding: 32px 16px;
      color: var(--text-tertiary);
      font-size: 13px;
    }

    .canvas-header {
      margin: 14px 20px 0 20px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 14px 14px 0 0;
      flex-shrink: 0;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
    }

    .canvas-header-top {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .header-title-block {
      flex: 1;
    }

    .header-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-title input {
      font: inherit;
      font-weight: 600;
      border: 1px solid var(--border);
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      flex: 1;
      max-width: 400px;
    }

    .header-title input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .status-indicator.live {
      background: #dcfce7;
      color: #166534;
    }

    .status-indicator.draft {
      background: #fef3c7;
      color: #92400e;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-dark);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-secondary {
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-secondary);
      border-color: var(--text-secondary);
    }

    .canvas-header-bottom {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .form-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .form-row label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .form-row select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .form-row select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .canvas-scroll {
      flex: 1;
      overflow-y: auto;
      margin: 0 20px 20px 20px;
      padding: 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 14px 14px;
    }

    .blocks-container {
      max-width: 700px;
    }

    .blocks-empty {
      text-align: center;
      padding: 40px 24px;
      color: var(--text-tertiary);
    }

    .blocks-empty svg {
      width: 48px;
      height: 48px;
      opacity: 0.3;
      margin-bottom: 12px;
    }

    .blocks-empty p {
      margin: 8px 0;
      font-size: 14px;
    }

    /* Block Cards */
    .block-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
      transition: all 0.2s;
      position: relative;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .block-card:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .block-card.selected {
      border-color: var(--accent);
      background: #f0f9ff;
      box-shadow: 0 0 0 3px var(--accent-light);
    }
    .block-card.dragging {
      opacity: 0.55;
      transform: scale(0.995);
    }
    .block-card.drop-target {
      border-color: var(--accent-dark);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
      background: #eef6ff;
    }

    .block-drag-handle {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      cursor: grab;
      flex-shrink: 0;
      font-size: 12px;
    }

    .block-drag-handle:active {
      cursor: grabbing;
    }

    .block-content {
      flex: 1;
      min-width: 0;
    }

    .block-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .block-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      background: var(--accent-light);
      color: var(--accent-dark);
      border-radius: 4px;
      text-transform: uppercase;
    }

    .block-preview {
      font-size: 13px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 300px;
    }

    .block-duration {
      font-size: 12px;
      color: var(--text-tertiary);
      background: var(--bg-primary);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .block-menu {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .block-menu:hover {
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .add-block-button {
      width: 100%;
      padding: 12px;
      border: 2px dashed var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      margin: 20px 0;
    }

    .add-block-button:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-light);
    }

    /* ===== INSPECTOR PANEL ===== */
    .inspector {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .inspector-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .inspector-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-tertiary);
      letter-spacing: 0.5px;
      margin: 0;
    }

    .inspector-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .form-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: all 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
      background: var(--bg-secondary);
    }

    .form-textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      cursor: pointer;
    }

    .form-select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .inspector-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-light);
    }

    .inspector-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }

    .validation-error {
      font-size: 12px;
      color: var(--danger);
      margin-top: 4px;
      display: none;
    }

    .validation-error.show {
      display: block;
    }

    /* Status Messages */
    #status {
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 400px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      display: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    }

    #status.show {
      display: block;
    }

    #status.good {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    #status.bad {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    @keyframes slideIn {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-tertiary);
    }

    /* Responsive */
    @media (max-width: 1400px) {
      :root {
        --inspector-width: 280px;
      }
    }

    @media (max-width: 1200px) {
      .app-container {
        grid-template-columns: 1fr;
      }

      .inspector {
        display: none;
      }

      .overview-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }

      .canvas-scroll {
        margin: 0 16px 16px 16px;
      }

      .canvas-header,
      .overview-shell {
        margin-left: 16px;
        margin-right: 16px;
      }
    }

    @media (max-width: 900px) {
      .overview-floating-head {
        flex-direction: column;
        align-items: stretch;
      }

      .overview-controls {
        justify-content: flex-start;
      }

      .overview-search {
        min-width: 0;
        width: 100%;
      }

      .overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 680px) {
      .overview-grid {
        grid-template-columns: 1fr;
      }

      .canvas-header,
      .canvas-scroll,
      .overview-shell {
        margin-left: 12px;
        margin-right: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- CENTER: Campaign Editor -->
    <div class="center-canvas">
      <section class="overview-shell">
        <div class="overview-floating-head">
          <div>
            <h2 class="overview-title">Campaign Overview</h2>
            <p class="overview-sub">
              <span id="overviewCount">0 campaigns</span>
              <span>|</span>
              <span id="overviewLiveCount">0 live</span>
            </p>
          </div>
          <div class="overview-controls">
            <input type="text" class="overview-search" id="sidebarSearch" placeholder="Search by name, UID, or ID" />
            <select class="overview-filter" id="overviewTypeFilter">
              <option value="all">All types</option>
              <option value="idle">Idle</option>
              <option value="visitor">Visitor</option>
              <option value="student">Student</option>
              <option value="menu">Menu</option>
            </select>
            <select class="overview-filter" id="overviewStatusFilter">
              <option value="all">All status</option>
              <option value="live">Live</option>
              <option value="draft">Draft</option>
            </select>
            <button class="btn-create" onclick="createNewCampaign()">+ Create</button>
          </div>
        </div>
        <div class="overview-grid" id="overviewGrid"></div>
      </section>

      <header class="canvas-header">
        <div class="canvas-header-top">
          <div class="header-title-block">
            <h1 class="header-title">
              <input type="text" id="campaignNameInput" placeholder="Untitled Campaign" value="" />
            </h1>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="publishBtn" onclick="publishCampaign()">Publish</button>
            <button class="btn btn-primary" id="saveCampaignBtn" onclick="saveBuilderCampaign()">Save</button>
          </div>
        </div>

        <div class="canvas-header-bottom">
          <div class="form-row">
            <label for="builderType">Type:</label>
            <select id="builderType"></select>
          </div>
          <div class="form-row" id="studentUidWrap" style="display:none">
            <label for="studentUid">Student UID:</label>
            <input type="text" id="studentUid" placeholder="e.g. stu-001" style="width: 120px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="margin-left: auto;">
            <span class="status-indicator" id="statusBadge">Draft</span>
          </div>
        </div>
      </header>

      <div class="canvas-scroll">
        <div class="blocks-container">
          <div id="blocks"></div>
          <button class="add-block-button" id="addBlockBtn" onclick="showAddBlockMenu()">
            + Add Block
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT: Inspector Panel -->
    <aside class="inspector">
      <div class="inspector-header">
        <h3 class="inspector-title">Properties</h3>
      </div>
      <div class="inspector-content" id="inspectorContent">
        <div class="blocks-empty" style="text-align: center; color: var(--text-tertiary); font-size: 12px;">
          Select a campaign or block to view properties
        </div>
      </div>
    </aside>
  </div>

  <!-- Status Toast -->
  <div id="status" class="status-toast"></div>

  <script src="/admin-ui.js"></script>
</body>
</html>`;
}

function parsePathnameComponent(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

function createServer({ port = 8081 } = {}) {
  ensureUploadDir();

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

    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const filename = parsePathnameComponent(url.pathname, "/media/");
      if (!filename || filename.includes("/") || filename.includes("..")) {
        return json(res, 400, {
          error: "validation_failed",
          issues: [{ path: "filename", message: "Invalid media filename", code: "invalid_path" }],
        });
      }

      const filePath = path.join(UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return json(res, 404, {
          error: "validation_failed",
          issues: [{ path: "filename", message: "Media file not found", code: "not_found" }],
        });
      }

      const mime = resolveMimeByExtension(filename);
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=604800",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      try {
        const contentType = req.headers["content-type"] || "";
        if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
          throw new ValidationError([
            {
              path: "file",
              message: "content-type must be multipart/form-data",
              code: "invalid_content_type",
            },
          ]);
        }

        const rawBody = await readRawBody(req);
        const uploaded = processUploadMultipart({ bodyBuffer: rawBody, contentType, reqLike: req });
        return json(res, 201, uploaded);
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/campaigns") {
      try {
        const body = await readJsonBody(req);
        const state = createCampaign(body);
        return json(res, 201, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const body = await readJsonBody(req);
        const state = updateCampaign(campaignId, body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteCampaign(campaignId);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/active") {
      try {
        const body = await readJsonBody(req);
        const state = setActiveCampaigns(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      try {
        const body = await readJsonBody(req);
        const state = setSettings(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/menu-campaign") {
      try {
        const body = await readJsonBody(req);
        const state = setMenuCampaign(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/students") {
      try {
        const body = await readJsonBody(req);
        const state = upsertStudent(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/students/")) {
      const uid = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteStudent(uid);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    return json(res, 404, { error: `not_found: ${url.pathname}` });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`IDS Admin listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer, MAX_UPLOAD_SIZE, UPLOAD_DIR, processUploadMultipart };
