/**
 * Campaign service.
 *
 * Responsibilities:
 * - Encapsulate campaign CRUD operations.
 * - Keep handlers free from storage-specific calls.
 */

/**
 * Creates campaign service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.storage - Storage module.
 * @returns {object} Campaign service API.
 */
function createCampaignService({ storage }) {
  /**
   * Creates a campaign.
   *
   * @param {object} payload - Campaign payload.
   * @returns {Promise<object>} Updated state.
   */
  async function create(payload) {
    return await storage.createCampaign(payload);
  }

  /**
   * Updates a campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @param {object} patch - Campaign patch.
   * @returns {Promise<object>} Updated state.
   */
  async function update(campaignId, patch) {
    return await storage.updateCampaign(campaignId, patch);
  }

  /**
   * Deletes a campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @returns {Promise<object>} Updated state.
   */
  async function remove(campaignId) {
    return await storage.deleteCampaign(campaignId);
  }

  return {
    create,
    update,
    remove,
  };
}

module.exports = {
  createCampaignService,
};
