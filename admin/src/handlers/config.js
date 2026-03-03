/**
 * Admin config and activation handlers.
 *
 * Responsibilities:
 * - Update active campaign selection.
 * - Update settings and menu campaign.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Handles POST /api/active.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleSetActive(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = deps.services.config.setActive(body);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles POST /api/settings.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleSetSettings(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = deps.services.config.setSettings(body);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles POST /api/menu-campaign.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleSetMenuCampaign(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = deps.services.config.setMenuCampaign(body);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

module.exports = {
  handleSetActive,
  handleSetSettings,
  handleSetMenuCampaign,
};
