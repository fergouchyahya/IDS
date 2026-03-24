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
   * @returns {Promise<object>} Full state payload.
   */
  async function getApiState() {
    const state = await storage.readState();
    return {
      state: {
        ...state,
        studentProfiles: storage.listStudentProfiles(),
        generatedStudentCampaigns: await studentService.listGeneratedCampaigns(),
      },
    };
  }

  /**
   * Returns runtime config projection for player service.
   *
   * @returns {Promise<object>} Runtime config payload.
   */
  async function getRuntimeConfig() {
    const state = await storage.readState();
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
