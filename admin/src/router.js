/**
 * IDS Admin — HTTP route dispatcher.
 */

const fs = require("fs");
const path = require("path");

function parsePathnameComponent(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

function createAdminRouter(deps) {
  const {
    json,
    text,
    logger,
    startedAt,
    renderAdminPage,
    adminUiJsPath,
    uploadDir,
    resolveMimeByExtension,
    readRawBody,
    readJsonBody,
    processUploadMultipart,
    sendValidationError,
    storage,
  } = deps;

  return async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return text(res, 200, renderAdminPage(), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/admin-ui.js") {
      const script = fs.readFileSync(adminUiJsPath, "utf8");
      return text(res, 200, script, "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/health") {
      const state = storage.readState();
      return json(res, 200, {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptimeMs: Date.now() - startedAt,
        storage: {
          ...storage.getStorageHealth(),
          idleCampaigns: state.idleCampaigns.length,
          visitorCampaigns: state.visitorCampaigns.length,
          students: state.students.length,
        },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const state = storage.readState();
      return json(res, 200, { state });
    }

    if (req.method === "GET" && url.pathname === "/runtime-config") {
      const state = storage.readState();
      return json(res, 200, storage.toRuntimeConfig(state));
    }

    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const filename = parsePathnameComponent(url.pathname, "/media/");
      if (!filename || filename.includes("/") || filename.includes("..")) {
        return json(res, 400, {
          error: "validation_failed",
          issues: [{ path: "filename", message: "Invalid media filename", code: "invalid_path" }],
        });
      }

      const filePath = path.join(uploadDir, filename);
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
          throw new storage.ValidationError([
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
        logger.warn("media_upload_failed", { message: e?.message });
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/campaigns") {
      try {
        const body = await readJsonBody(req);
        const state = storage.createCampaign(body);
        return json(res, 201, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const body = await readJsonBody(req);
        const state = storage.updateCampaign(campaignId, body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = storage.deleteCampaign(campaignId);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/active") {
      try {
        const body = await readJsonBody(req);
        const state = storage.setActiveCampaigns(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      try {
        const body = await readJsonBody(req);
        const state = storage.setSettings(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/menu-campaign") {
      try {
        const body = await readJsonBody(req);
        const state = storage.setMenuCampaign(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/students") {
      try {
        const body = await readJsonBody(req);
        const state = storage.upsertStudent(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/students/")) {
      const uid = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = storage.deleteStudent(uid);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    return json(res, 404, { error: `not_found: ${url.pathname}` });
  };
}

module.exports = { createAdminRouter };
