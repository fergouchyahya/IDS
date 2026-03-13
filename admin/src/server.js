/**
 * IDS Admin HTTP server composition root.
 *
 * Responsibilities:
 * - Configure shared dependencies.
 * - Create and start HTTP server.
 * - Handle unhandled request-level errors.
 */

const path = require("path");
const http = require("http");
const { json } = require("../../shared/utils/http-helpers");
const { createLogger } = require("../../shared/utils/logger");
const { renderAdminPage } = require("./render-admin-page");
const { createAdminRouter } = require("./router");
const { FileRepository } = require("./storage/repository");
const { createStorage } = require("./storage");
const {
  ensureUploadDir,
  processUploadMultipart,
  resolveMimeByExtension,
} = require("./utils/media-utils");
const {
  createJsonBodyReader,
  createRawBodyReader,
  sendValidationError,
} = require("./utils/request-utils");
const { createCampaignService } = require("./services/campaign-service");
const { createConfigService } = require("./services/config-service");
const { createStudentService } = require("./services/student-service");
const { createStateService } = require("./services/state-service");
const { createHealthService } = require("./services/health-service");
const { createMediaService } = require("./services/media-service");

const logger = createLogger("ids-admin-server");

const ADMIN_UI_JS_PATH = path.resolve(__dirname, "../public/admin-ui.js");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const DATA_DIR = process.env.IDS_ADMIN_DATA_DIR
  ? path.resolve(process.env.IDS_ADMIN_DATA_DIR)
  : path.resolve(__dirname, "../data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

/**
 * Processes multipart upload using admin defaults.
 *
 * @param {object} storage - Storage facade.
 * @param {object} params - Upload options.
 * @returns {object} Uploaded media metadata.
 */
function processUploadMultipartWithDefaults(storage, params) {
  return processUploadMultipart({
    ...params,
    uploadDir: UPLOAD_DIR,
    maxUploadSize: MAX_UPLOAD_SIZE,
    storage,
  });
}

/**
 * Builds all admin domain services.
 *
 * @param {object} storage - Storage facade.
 * @returns {object} Service registry.
 */
function buildServices(storage) {
  const campaigns = createCampaignService({ storage });
  const config = createConfigService({ storage });
  const students = createStudentService({ storage });
  const state = createStateService({ storage, studentService: students });
  const health = createHealthService({ storage });
  const media = createMediaService({
    uploadDir: UPLOAD_DIR,
    resolveMimeByExtension,
    processUploadMultipart: (params) => processUploadMultipartWithDefaults(storage, params),
  });

  return {
    campaigns,
    config,
    students,
    state,
    health,
    media,
  };
}

/**
 * Creates and starts admin HTTP server.
 *
 * @param {object} [options={}] - Server options.
 * @param {number} [options.port=8081] - Server port.
 * @returns {import('http').Server} Started HTTP server instance.
 */
function createServer({ port = 8081 } = {}) {
  ensureUploadDir(UPLOAD_DIR);
  const startedAt = Date.now();

  const repository = new FileRepository({ dataDir: DATA_DIR });
  const storage = createStorage(repository);

  const readJsonBody = createJsonBodyReader(storage);
  const readRawBody = createRawBodyReader(storage, MAX_UPLOAD_SIZE);
  const services = buildServices(storage);

  /**
   * Sends normalized validation error for handlers.
   *
   * @param {import('http').ServerResponse} res - HTTP response.
   * @param {Error} err - Validation error.
   */
  function handleValidationError(res, err) {
    return sendValidationError(res, err, storage);
  }

  const handleRequest = createAdminRouter({
    logger,
    startedAt,
    renderAdminPage,
    adminUiJsPath: ADMIN_UI_JS_PATH,
    publicDir: PUBLIC_DIR,
    uploadDir: UPLOAD_DIR,
    resolveMimeByExtension,
    readRawBody,
    readJsonBody,
    sendValidationError: handleValidationError,
    storage,
    services,
  });

  /**
   * Handles incoming requests with top-level error safety.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {import('http').ServerResponse} res - HTTP response.
   * @returns {Promise<void>}
   */
  async function handleIncomingRequest(req, res) {
    try {
      await handleRequest(req, res);
    } catch (error) {
      logger.error("unhandled_request_error", {
        message: error?.message,
        method: req.method,
        url: req.url,
      });
      if (!res.headersSent) {
        json(res, 500, { error: "internal_error" });
      }
    }
  }

  /**
   * Logs server listening event.
   */
  function handleServerListening() {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    logger.info("server_listening", { url: `http://127.0.0.1:${boundPort}` });
  }

  const server = http.createServer(handleIncomingRequest);
  server.listen(port, "127.0.0.1", handleServerListening);

  return server;
}

module.exports = {
  createServer,
  MAX_UPLOAD_SIZE,
  UPLOAD_DIR,
};
