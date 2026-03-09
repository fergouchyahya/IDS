/**
 * Admin UI controller helpers.
 *
 * Responsibilities:
 * - Coordinate campaign-level editor state transitions.
 * - Keep validation/status orchestration out of admin-ui.js.
 */

(function initAdminEditorController(global) {
  /**
   * Starts a new campaign draft and refreshes the main editor view.
   *
   * @param {object} deps - Controller dependencies.
   */
  function createNewCampaignState(deps) {
    deps.setSelectedCampaignId(null);
    deps.setSelectedBlockIndex(null);
    deps.resetBuilderForType("idle");
    deps.syncUiStateStore();
    deps.renderSidebar();
    deps.renderBlocks();
    deps.renderInspector();
    deps.updateCampaignHeader();
    deps.setStatus("New campaign started", true);
  }

  /**
   * Selects one block in the builder.
   *
   * @param {object} deps - Controller dependencies.
   * @param {number} idx - Block index.
   */
  function selectBlockState(deps, idx) {
    deps.setSelectedBlockIndex(idx);
    deps.syncUiStateStore();
    deps.renderBlocks();
    deps.renderInspector();
  }

  /**
   * Updates campaign name and keeps header display in sync.
   *
   * @param {object} deps - Controller dependencies.
   * @param {string} newName - New campaign name.
   */
  function updateCampaignNameState(deps, newName) {
    deps.builder.campaignName = newName;
    deps.updateCampaignHeader();
  }

  /**
   * Updates student uid and refreshes validation/save state.
   *
   * @param {object} deps - Controller dependencies.
   * @param {string} value - Student uid.
   */
  function updateStudentUidState(deps, value) {
    deps.builder.studentUid = value;
    deps.updateCampaignHeader();
    deps.updateSaveButtons();
  }

  /**
   * Changes builder type from the inspector context.
   *
   * @param {object} deps - Controller dependencies.
   * @param {string} newType - New campaign type.
   */
  function changeCampaignTypeState(deps, newType) {
    deps.builder.type = newType;
    deps.builder.campaignId = null;
    deps.setSelectedCampaignId(null);
    deps.syncUiStateStore();
    deps.updateCampaignHeader();
    deps.renderInspector();
  }

  /**
   * Resolves the current campaign id after create/update flows.
   *
   * @param {object} deps - Controller dependencies.
   * @param {string} kind - Campaign kind.
   * @param {string} campaignName - Campaign name.
   * @returns {string|null} Campaign identifier.
   */
  function resolveCampaignIdFromState(deps, kind, campaignName) {
    const state = deps.getState();
    if (!state) return null;
    if (kind === "menu") return state.menuCampaign?.campaignId || "menu-default";
    if (kind === "student") return `student-${String(deps.builder.studentUid || "").trim()}`;

    const list = kind === "idle" ? state.idleCampaigns || [] : state.visitorCampaigns || [];
    const exact = list.find((c) => c.campaignName === campaignName);
    if (exact) return exact.campaignId;
    return list[list.length - 1]?.campaignId || null;
  }

  /**
   * Deploys a campaign directly from the overview panel.
   *
   * @param {object} deps - Controller dependencies.
   * @param {string} type - Campaign type.
   * @param {string} id - Campaign id or student uid.
   * @returns {Promise<void>}
   */
  async function deployCampaignFromOverviewState(deps, type, id) {
    const state = deps.getState();
    if (!state) return;

    try {
      if (type === "idle" || type === "visitor") {
        await deps.api("/api/active", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idleCampaignId: type === "idle" ? id : state.active?.idleCampaignId,
            visitorCampaignId: type === "visitor" ? id : state.active?.visitorCampaignId,
          }),
        });
        await deps.refresh();
        deps.setStatus(`${deps.cardTypeLabel(type)} campaign deployed`, true);
        return;
      }

      if (type === "menu") {
        deps.loadCampaignToEditor("menu", id);
        await deps.publishCampaign();
        return;
      }

      deps.loadCampaignToEditor("student", id);
      deps.setStatus("Student campaigns are available on NFC tap", true);
    } catch (e) {
      deps.setStatus("Deploy failed", false, e.issues || []);
    }
  }

  /**
   * Updates validation summaries, inline errors, and header field errors.
   *
   * @param {object} deps - Controller dependencies.
   */
  function updateSaveButtonsState(deps) {
    const builderIssues = deps.validateBuilder();
    const menuIssues = deps.validateMenu();

    deps.setBuilderIssues(builderIssues);
    deps.setMenuIssues(menuIssues);
    deps.syncUiStateStore();

    deps.renderIssues("builderIssues", builderIssues, "builder");
    deps.renderIssues("menuIssues", menuIssues, "menu");
    deps.syncInlineBlockErrors("blocks", deps.builder.blocks, builderIssues);
    deps.syncInlineBlockErrors("menuBlocks", deps.menuBlocks, menuIssues);

    const nameIssue = builderIssues.find((i) => i.path === "campaignName");
    const campaignNameErrorEl = document.getElementById("campaignNameError");
    if (campaignNameErrorEl) campaignNameErrorEl.textContent = nameIssue ? nameIssue.message : "";

    const uidIssue = builderIssues.find((i) => i.path === "studentUid");
    const studentUidErrorEl = document.getElementById("studentUidError");
    if (studentUidErrorEl) studentUidErrorEl.textContent = uidIssue ? uidIssue.message : "";
  }

  global.AdminEditorController = {
    createNewCampaignState,
    selectBlockState,
    updateCampaignNameState,
    updateStudentUidState,
    changeCampaignTypeState,
    resolveCampaignIdFromState,
    deployCampaignFromOverviewState,
    updateSaveButtonsState,
  };
}(window));
