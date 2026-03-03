/**
 * State projection service.
 *
 * Responsibilities:
 * - Provide full state payload with generated student campaigns.
 * - Provide runtime-config projection for player sync.
 */

/**
 * Creates state service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.storage - Storage module.
 * @param {object} deps.studentService - Student service.
 * @returns {object} State service API.
 */
function createStateService({ storage, studentService }) {
  /**
   * Returns full admin state with generated student campaigns.
   *
   * @returns {object} Full state payload.
   */
  function getApiState() {
    const state = storage.readState();
    return {
      state: {
        ...state,
        generatedStudentCampaigns: studentService.listGeneratedCampaigns(),
      },
    };
  }

  /**
   * Returns runtime config projection for player service.
   *
   * @returns {object} Runtime config payload.
   */
  function getRuntimeConfig() {
    const state = storage.readState();
    return storage.toRuntimeConfig(state);
  }

  return {
    getApiState,
    getRuntimeConfig,
  };
}

module.exports = {
  createStateService,
};
