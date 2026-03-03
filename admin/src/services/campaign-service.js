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
   * @returns {object} Updated state.
   */
  function create(payload) {
    return storage.createCampaign(payload);
  }

  /**
   * Updates a campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @param {object} patch - Campaign patch.
   * @returns {object} Updated state.
   */
  function update(campaignId, patch) {
    return storage.updateCampaign(campaignId, patch);
  }

  /**
   * Deletes a campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @returns {object} Updated state.
   */
  function remove(campaignId) {
    return storage.deleteCampaign(campaignId);
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
