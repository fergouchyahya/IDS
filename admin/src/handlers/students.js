/**
 * Admin student handlers.
 *
 * Responsibilities:
 * - Upsert/delete student mappings.
 * - Import student profiles.
 * - Resolve generated student campaign.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Extracts student uid from student path.
 *
 * @param {string} pathname - Request path.
 * @returns {string} Student UID.
 */
function extractStudentUid(pathname) {
  return decodeURIComponent(pathname.split("/")[3] || "");
}

/**
 * Handles POST /api/students.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleUpsertStudent(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = await deps.services.students.upsert(body);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles POST /api/students/import.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleImportStudents(req, res, deps) {
  try {
    const body = await deps.readJsonBody(req);
    const state = await deps.services.students.importProfiles(body);
    return json(res, 200, {
      state,
      imported: state.studentProfiles.length,
    });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles GET /api/students/:uid/campaign.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleGetStudentCampaign(req, res, url, deps) {
  const uid = extractStudentUid(url.pathname);
  try {
    const generated = await deps.services.students.getGeneratedCampaign(uid);
    return json(res, 200, generated);
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

/**
 * Handles DELETE /api/students/:uid.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleDeleteStudent(req, res, url, deps) {
  const uid = extractStudentUid(url.pathname);
  try {
    const state = await deps.services.students.remove(uid);
    return json(res, 200, { state });
  } catch (e) {
    return deps.sendValidationError(res, e);
  }
}

module.exports = {
  handleUpsertStudent,
  handleImportStudents,
  handleGetStudentCampaign,
  handleDeleteStudent,
};
