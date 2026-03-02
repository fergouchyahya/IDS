"use strict";

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res, code, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(
  req,
  {
    maxBytes = 100_000,
    onTooLarge = () => new Error("Body too large"),
    onInvalidJson = () => new Error("Invalid JSON"),
  } = {},
) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const rejectOnce = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        rejectOnce(onTooLarge());
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      try {
        const data = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(data || "{}"));
      } catch {
        rejectOnce(onInvalidJson());
      }
    });

    req.on("error", (err) => rejectOnce(err));
  });
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = {
  json,
  text,
  readJsonBody,
  escapeHtml,
};
