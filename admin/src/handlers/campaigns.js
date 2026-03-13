/**
 * Admin campaign handlers.
 *
 * Responsibilities:
 * - Create, update and delete idle/visitor campaigns.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Extracts campaign id from /api/campaigns/:id path.
 *
 * @param {string} pathname - Request pathname.
 * @returns {string} Campaign id.
 */
function extractCampaignId(pathname) {
  return decodeURIComponent(pathname.split("/")[3] || "");
}

/**
 * Handles POST /api/campaigns.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleCreateCampaign(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = await deps.services.campaigns.create(body);
    return json(res, 201, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles PUT /api/campaigns/:id.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleUpdateCampaign(req, res, url, deps) {
  const campaignId = extractCampaignId(url.pathname);
  try {
    const body = await deps.readJsonBody(req);
    const state = await deps.services.campaigns.update(campaignId, body);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles DELETE /api/campaigns/:id.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleDeleteCampaign(req, res, url, deps) {
  const campaignId = extractCampaignId(url.pathname);
  try {
    const state = await deps.services.campaigns.remove(campaignId);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

module.exports = {
  handleCreateCampaign,
  handleUpdateCampaign,
  handleDeleteCampaign,
};
