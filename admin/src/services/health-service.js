/**
 * Health service.
 *
 * Responsibilities:
 * - Build structured health payload.
 */

/**
 * Creates health service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.storage - Storage module.
 * @returns {object} Health service API.
 */
function createHealthService({ storage }) {
  /**
   * Returns health payload.
   *
   * @param {number} startedAt - Service startup timestamp in ms.
   * @returns {Promise<object>} Health response payload.
   */
  async function getHealthPayload(startedAt) {
    const state = await storage.readState();
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - startedAt,
      storage: {
        ...(await storage.getStorageHealth()),
        idleCampaigns: state.idleCampaigns.length,
        visitorCampaigns: state.visitorCampaigns.length,
        students: state.students.length,
        studentProfiles: storage.getStudentProfileCount(),
      },
    };
  }

  return {
    getHealthPayload,
  };
}

module.exports = {
  createHealthService,
};
