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
   * @returns {object} Updated state.
   */
  function upsert(payload) {
    return storage.upsertStudent(payload);
  }

  /**
   * Imports student profiles.
   *
   * @param {object} payload - Import payload.
   * @returns {object} Updated state.
   */
  function importProfiles(payload) {
    return storage.importStudentProfiles(payload);
  }

  /**
   * Gets generated campaign by uid.
   *
   * @param {string} uid - Student uid.
   * @returns {object} Generated campaign payload.
   */
  function getGeneratedCampaign(uid) {
    return storage.getGeneratedStudentCampaignByUid(uid);
  }

  /**
   * Deletes a student mapping.
   *
   * @param {string} uid - Student uid.
   * @returns {object} Updated state.
   */
  function remove(uid) {
    return storage.deleteStudent(uid);
  }

  /**
   * Lists generated student campaigns.
   *
   * @returns {Array<object>} Generated student campaign list.
   */
  function listGeneratedCampaigns() {
    return storage.listGeneratedStudentCampaigns();
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
