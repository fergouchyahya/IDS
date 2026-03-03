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
   * @returns {object} Health response payload.
   */
  function getHealthPayload(startedAt) {
    const state = storage.readState();
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - startedAt,
      storage: {
        ...storage.getStorageHealth(),
        idleCampaigns: state.idleCampaigns.length,
        visitorCampaigns: state.visitorCampaigns.length,
        students: state.students.length,
        studentProfiles: state.studentProfiles.length,
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
