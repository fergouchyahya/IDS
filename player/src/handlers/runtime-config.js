/**
 * Runtime-config route handler.
 *
 * Responsibilities:
 * - Accept runtime config payload and apply it to state machine.
 */

const { json, readJsonBody } = require("../../../shared/utils/http-helpers");

/**
 * Handles POST /runtime-config requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleRuntimeConfig(req, res, url, deps) {
  let runtime;
  try {
    runtime = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  const ok = deps.stateMachine.setRuntimeConfig(runtime);
  if (!ok) {
    return json(res, 400, { error: "invalid_runtime_config" });
  }

  return json(res, 200, { status: "ok", current: deps.stateMachine.getStatus() });
}

module.exports = {
  handleRuntimeConfig,
};
