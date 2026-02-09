/**
 * IDS Admin — Minimal HTTP API (Phase 6)
 *
 * Endpoints:
 *   POST /configs      upload + validate
 *   GET  /configs      list metadata
 *   GET  /configs/:id  fetch full config
 */

const http = require("http");
const path = require("path");
const crypto = require("crypto");

const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const { appendConfigRecord, listConfigMeta, getConfigById } = require("./storage");

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

function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) return ["Unknown validation error"];
  return errors.map((e) => {
    const where = e.instancePath && e.instancePath.length > 0 ? e.instancePath : "/";
    return `${where} ${e.message}`;
  });
}

function buildValidator() {
  const schemaPath = path.resolve(__dirname, "../../shared/contract/schema/config.schema.json");
  const schema = JSON.parse(require("fs").readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function checksumOf(obj) {
  const raw = JSON.stringify(obj);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function createServer({ port = 8081 } = {}) {
  const validate = buildValidator();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/configs") {
      const configs = listConfigMeta();
      return json(res, 200, { configs });
    }

    if (req.method === "GET" && url.pathname.startsWith("/configs/")) {
      const id = url.pathname.split("/")[2];
      const record = getConfigById(id);
      if (!record) return json(res, 404, { error: "not_found" });
      return json(res, 200, record);
    }

    if (req.method === "POST" && url.pathname === "/configs") {
      let config;
      try {
        config = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: "invalid_json", details: [e.message] });
      }

      const ok = validate(config);
      if (!ok) {
        return json(res, 400, { error: "validation_error", details: formatAjvErrors(validate.errors) });
      }

      const meta = {
        configId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        checksum: checksumOf(config),
      };

      appendConfigRecord({ meta, config });
      return json(res, 201, meta);
    }

    return json(res, 404, { error: "not_found" });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`IDS Admin listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer };
