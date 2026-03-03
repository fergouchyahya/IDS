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
   * @returns {object} Updated state.
   */
  function setActive(payload) {
    return storage.setActiveCampaigns(payload);
  }

  /**
   * Sets global settings.
   *
   * @param {object} payload - Settings patch.
   * @returns {object} Updated state.
   */
  function setSettings(payload) {
    return storage.setSettings(payload);
  }

  /**
   * Sets menu campaign.
   *
   * @param {object} payload - Menu campaign payload.
   * @returns {object} Updated state.
   */
  function setMenuCampaign(payload) {
    return storage.setMenuCampaign(payload);
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
