/**
 * Student service.
 *
 * Responsibilities:
 * - Encapsulate student CRUD and profile import operations.
 * - Provide generated student campaign queries.
 */

/**
 * Creates student service.
 *
 * @param {object} deps - Service dependencies.
 * @param {object} deps.storage - Storage module.
 * @returns {object} Student service API.
 */
function createStudentService({ storage }) {
  /**
   * Upserts a student mapping.
   *
   * @param {object} payload - Student payload.
   * @returns {Promise<object>} Updated state.
   */
  async function upsert(payload) {
    return await storage.upsertStudent(payload);
  }

  /**
   * Imports student profiles.
   *
   * @param {object} payload - Import payload.
   * @returns {Promise<object>} Updated state.
   */
  async function importProfiles(payload) {
    return await storage.importStudentProfiles(payload);
  }

  /**
   * Gets generated campaign by uid.
   *
   * @param {string} uid - Student uid.
   * @returns {Promise<object>} Generated campaign payload.
   */
  async function getGeneratedCampaign(uid) {
    return await storage.getGeneratedStudentCampaignByUid(uid);
  }

  /**
   * Deletes a student mapping.
   *
   * @param {string} uid - Student uid.
   * @returns {Promise<object>} Updated state.
   */
  async function remove(uid) {
    return await storage.deleteStudent(uid);
  }

  /**
   * Lists generated student campaigns.
   *
   * @returns {Promise<Array<object>>} Generated student campaign list.
   */
  async function listGeneratedCampaigns() {
    return await storage.listGeneratedStudentCampaigns();
  }

  return {
    upsert,
    importProfiles,
    getGeneratedCampaign,
    remove,
    listGeneratedCampaigns,
  };
}

module.exports = {
  createStudentService,
};
