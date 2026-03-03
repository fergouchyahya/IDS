/**
 * Admin editor state transition helpers.
 *
 * Responsibilities:
 * - Handle builder state transitions for campaign load/duplicate flows.
 * - Keep campaign selection logic outside monolithic admin-ui file.
 */

(function initAdminEditorState(global) {
  /**
   * Loads a campaign into builder editor by type/id.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} type - Campaign type.
   * @param {string} campaignId - Campaign identifier or student uid.
   */
  function loadCampaignToEditorState(deps, type, campaignId) {
    deps.setSelectedCampaignId(campaignId);
    deps.setSelectedBlockIndex(null);

    if (type === "menu") {
      if (deps.state.menuCampaign) {
        deps.builder.campaignId = "menu";
        deps.builder.type = "menu";
        deps.builder.campaignName = deps.state.menuCampaign.campaignName || "Menu";
        deps.builder.blocks = Array.isArray(deps.state.menuCampaign.items)
          ? deps.state.menuCampaign.items.map((b) => ({ ...b }))
          : [deps.defaultBlock(1)];
      }
    } else if (type === "student") {
      const student = deps.findStudentCampaignByUid(campaignId);
      if (student) {
        deps.builder.campaignId = `student-${campaignId}`;
        deps.builder.type = "student";
        deps.builder.campaignName = student.name || "";
        deps.builder.studentUid = campaignId;
        deps.builder.blocks = Array.isArray(student.campaign?.items) && student.campaign.items.length > 0
          ? student.campaign.items.map((b) => ({ ...b }))
          : [deps.defaultBlock(1)];
      }
    } else {
      const campaign = deps.getCampaignsByType(type).find((c) => c.campaignId === campaignId);
      if (campaign) {
        deps.builder.campaignId = campaignId;
        deps.builder.type = type;
        deps.builder.campaignName = campaign.campaignName || "";
        deps.builder.blocks = Array.isArray(campaign.items) && campaign.items.length > 0
          ? campaign.items.map((b) => ({ ...b }))
          : [deps.defaultBlock(1)];
      }
    }

    deps.syncUiStateStore();
    deps.renderSidebar();
    deps.renderBlocks();
    deps.renderInspector();
    deps.updateCampaignHeader();
  }

  /**
   * Loads a duplicated campaign into draft builder state.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} type - Campaign type.
   * @param {string} id - Campaign identifier.
   */
  function duplicateCampaignFromOverviewState(deps, type, id) {
    if (!deps.state) return;

    deps.setSelectedCampaignId(null);
    deps.setSelectedBlockIndex(null);

    if (type === "student") {
      const student = deps.findStudentCampaignByUid(id);
      if (!student) {
        deps.setStatus("Student campaign not found", false);
        return;
      }
      deps.setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
      deps.builder.campaignId = null;
      deps.builder.studentUid = "";
      deps.builder.campaignName = `${student.name || "Student"} Copy`;
    } else if (type === "menu") {
      if (!deps.state.menuCampaign) {
        deps.setStatus("Menu campaign not found", false);
        return;
      }
      deps.setBuilderFromCampaign(deps.state.menuCampaign, "menu");
      deps.builder.campaignId = null;
      deps.builder.campaignName = `${deps.state.menuCampaign.campaignName || "Menu"} Copy`;
    } else {
      const campaign = deps.getCampaignsByType(type).find((c) => c.campaignId === id);
      if (!campaign) {
        deps.setStatus("Campaign not found", false);
        return;
      }
      deps.setBuilderFromCampaign(campaign, type);
      deps.builder.campaignId = null;
      deps.builder.campaignName = `${campaign.campaignName || "Campaign"} Copy`;
    }

    deps.syncFormFromBuilder();
    deps.renderSidebar();
    deps.renderInspector();
    deps.updateCampaignHeader();
    deps.setStatus("Duplicate loaded into editor draft", true);
  }

  /**
   * Loads duplicate source from builder duplicate mode.
   *
   * @param {object} deps - Runtime dependencies.
   */
  function loadDuplicateSourceState(deps) {
    if (deps.builder.mode !== "duplicate") {
      deps.setStatus("Switch to duplicate mode to load a source campaign", false);
      return;
    }

    if (!deps.builder.sourceId) {
      deps.setStatus("No source campaign selected", false);
      return;
    }

    if (deps.builder.type === "student") {
      const student = deps.findStudentCampaignByUid(deps.builder.sourceId);
      if (!student) {
        deps.setStatus("Selected student source not found", false);
        return;
      }
      deps.setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
      deps.builder.campaignId = null;
      deps.builder.studentUid = "";
      deps.builder.campaignName = `${student.name} Copy`;
    } else {
      const campaign = deps.getCampaignsByType(deps.builder.type).find((c) => c.campaignId === deps.builder.sourceId);
      if (!campaign) {
        deps.setStatus("Selected campaign source not found", false);
        return;
      }
      deps.setBuilderFromCampaign(campaign, deps.builder.type);
      deps.builder.campaignId = null;
      deps.builder.campaignName = `${campaign.campaignName} Copy`;
    }

    deps.syncFormFromBuilder();
    deps.syncUiStateStore();
    deps.setStatus("Duplicate source loaded", true);
  }

  /**
   * Loads an existing campaign as duplicate source.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} type - Campaign type.
   * @param {string} campaignId - Campaign id.
   */
  function loadExistingCampaignState(deps, type, campaignId) {
    const campaign = deps.getCampaignsByType(type).find((c) => c.campaignId === campaignId);
    if (!campaign) return;

    deps.builder.mode = "duplicate";
    deps.builder.sourceId = campaignId;
    deps.setBuilderFromCampaign(campaign, type);
    deps.syncUiStateStore();
    deps.syncFormFromBuilder();
  }

  /**
   * Loads an existing student campaign as duplicate source.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} uid - Student uid.
   */
  function loadExistingStudentState(deps, uid) {
    const student = deps.findStudentCampaignByUid(uid);
    if (!student) return;

    deps.builder.mode = "duplicate";
    deps.builder.sourceId = uid;
    deps.setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
    deps.syncUiStateStore();
    deps.syncFormFromBuilder();
  }

  global.AdminEditorState = {
    loadCampaignToEditorState,
    duplicateCampaignFromOverviewState,
    loadDuplicateSourceState,
    loadExistingCampaignState,
    loadExistingStudentState,
  };
}(window));
