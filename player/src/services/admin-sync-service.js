/**
 * Admin synchronization service.
 *
 * Responsibilities:
 * - Pull runtime config from admin API.
 * - Pull student campaign by NFC UID.
 * - Keep sync health status and timer lifecycle.
 */

/**
 * Pulls runtime configuration from admin service.
 *
 * @param {string} adminUrl - Admin base URL.
 * @returns {Promise<object>} Runtime config payload.
 */
async function pullRuntimeConfig(adminUrl) {
  const res = await fetch(`${adminUrl.replace(/\/$/, "")}/runtime-config`);
  if (!res.ok) throw new Error(`runtime-config fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Pulls generated student campaign from admin by UID.
 *
 * @param {string} adminUrl - Admin base URL.
 * @param {string} nfcUid - Student NFC UID.
 * @returns {Promise<object|null>} Student campaign payload or null when unknown.
 */
async function pullStudentCampaign(adminUrl, nfcUid) {
  const uid = String(nfcUid || "").trim();
  if (!uid) return null;

  const endpoint = `${adminUrl.replace(/\/$/, "")}/api/students/${encodeURIComponent(uid)}/campaign`;
  const res = await fetch(endpoint);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`student-campaign fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Creates sync service bound to one state machine instance.
 *
 * @param {object} options - Service options.
 * @param {string} options.adminUrl - Admin base URL.
 * @param {object} options.stateMachine - State machine instance.
 * @param {object} options.logger - Logger instance.
 * @param {number} options.syncIntervalMs - Sync interval.
 * @returns {object} Sync service API.
 */
function createAdminSyncService({ adminUrl, stateMachine, logger, syncIntervalMs }) {
  const status = {
    configured: Boolean(adminUrl),
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
  };

  let syncTimer = null;

  /**
   * Synchronizes runtime config from admin and applies it.
   *
   * @returns {Promise<boolean>} True when sync succeeds.
   */
  async function syncRuntime() {
    if (!adminUrl) return false;
    status.lastAttemptAt = new Date().toISOString();
    try {
      const runtime = await pullRuntimeConfig(adminUrl);
      const applied = stateMachine.setRuntimeConfig(runtime);
      if (!applied) {
        throw new Error("invalid_runtime_config");
      }
      status.lastSuccessAt = new Date().toISOString();
      status.lastError = null;
      return true;
    } catch (e) {
      status.lastErrorAt = new Date().toISOString();
      status.lastError = String(e?.message || e);
      logger.warn("runtime_sync_failed", { error: status.lastError });
      return false;
    }
  }

  /**
   * Loads generated student campaign for a UID.
   *
   * @param {string} uid - NFC UID.
   * @returns {Promise<object|null>} Student campaign payload.
   */
  async function loadStudentCampaign(uid) {
    if (!adminUrl) return null;
    return pullStudentCampaign(adminUrl, uid);
  }

  /**
   * Starts periodic sync cycle.
   */
  function start() {
    if (!adminUrl) return;
    syncRuntime();
    syncTimer = setInterval(syncRuntime, syncIntervalMs);
  }

  /**
   * Stops periodic sync cycle.
   */
  function stop() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  /**
   * Returns read-only sync status snapshot.
   *
   * @returns {object} Sync status payload.
   */
  function getStatus() {
    return { ...status };
  }

  /**
   * Returns whether admin sync is configured.
   *
   * @returns {boolean} True when admin URL is configured.
   */
  function isConfigured() {
    return Boolean(adminUrl);
  }

  return {
    start,
    stop,
    syncRuntime,
    loadStudentCampaign,
    getStatus,
    isConfigured,
  };
}

module.exports = {
  createAdminSyncService,
  pullRuntimeConfig,
  pullStudentCampaign,
};
