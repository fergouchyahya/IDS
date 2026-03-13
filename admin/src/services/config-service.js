/**
 * Admin config service.
 *
 * Responsibilities:
 * - Encapsulate active/settings/menu updates.
 */

/**
 * Creates config service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.storage - Storage module.
 * @returns {object} Config service API.
 */
function createConfigService({ storage }) {
  /**
   * Sets active campaign ids.
   *
   * @param {object} payload - Active payload.
   * @returns {Promise<object>} Updated state.
   */
  async function setActive(payload) {
    return await storage.setActiveCampaigns(payload);
  }

  /**
   * Sets global settings.
   *
   * @param {object} payload - Settings patch.
   * @returns {Promise<object>} Updated state.
   */
  async function setSettings(payload) {
    return await storage.setSettings(payload);
  }

  /**
   * Sets menu campaign.
   *
   * @param {object} payload - Menu campaign payload.
   * @returns {Promise<object>} Updated state.
   */
  async function setMenuCampaign(payload) {
    return await storage.setMenuCampaign(payload);
  }

  return {
    setActive,
    setSettings,
    setMenuCampaign,
  };
}

module.exports = {
  createConfigService,
};
