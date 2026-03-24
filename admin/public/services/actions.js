/**
 * Admin UI async action helpers.
 *
 * Responsibilities:
 * - Handle API-backed actions (refresh/save/publish/delete/upload).
 * - Keep side effects consolidated outside view rendering modules.
 */

(function initAdminActions(global) {
  /**
   * Refreshes state from backend and triggers UI refresh hook.
   *
   * @param {object} deps - Action dependencies.
   * @returns {Promise<void>}
   */
  async function refreshAction(deps) {
    const data = await deps.api("/api/state");
    deps.setState(data.state);
    deps.afterRefresh();
    deps.setStatus("Loaded", true);
  }

  /**
   * Saves builder draft into backend.
   *
   * @param {object} deps - Action dependencies.
   * @returns {Promise<boolean|undefined>} True on successful save.
   */
  async function saveBuilderCampaignAction(deps) {
    const builderIssues = deps.validateBuilder();
    deps.setBuilderIssues(builderIssues);
    if (builderIssues.length > 0) {
      deps.setStatus("Fix validation errors first", false);
      deps.renderInspector();
      return;
    }

    try {
      if (deps.builder.type === "menu") {
        await deps.api("/api/menu-campaign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campaignName: deps.builder.campaignName.trim(),
            items: deps.builder.blocks.map(deps.normalizeBlock),
          }),
        });
        deps.builder.campaignId = "menu-default";
      } else if (deps.builder.type === "student") {
        await deps.api("/api/students", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nfcUid: deps.builder.studentUid.trim(),
            name: deps.builder.campaignName.trim(),
            items: deps.builder.blocks.map(deps.normalizeBlock),
          }),
        });
        deps.builder.campaignId = `student-${deps.builder.studentUid.trim()}`;
      } else {
        const isExisting = Boolean(deps.builder.campaignId);
        await deps.api(isExisting ? `/api/campaigns/${encodeURIComponent(deps.builder.campaignId)}` : "/api/campaigns", {
          method: isExisting ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: deps.builder.type,
            campaignName: deps.builder.campaignName.trim(),
            items: deps.builder.blocks.map(deps.normalizeBlock),
          }),
        });
        if (!isExisting) {
          await deps.refresh();
          deps.builder.campaignId = deps.resolveCampaignIdFromState(deps.builder.type, deps.builder.campaignName.trim());
        }
      }

      await deps.refresh();
      deps.setStatus("Campaign saved", true);
      return true;
    } catch (e) {
      deps.setBuilderIssues(e.issues || []);
      deps.setStatus("Campaign save failed", false, e.issues || []);
      throw e;
    }
  }

  /**
   * Publishes current builder campaign.
   *
   * @param {object} deps - Action dependencies.
   * @returns {Promise<void>}
   */
  async function publishCampaignAction(deps) {
    try {
      await deps.saveBuilderCampaign();
      const currentType = deps.builder.type;
      const currentId = deps.builder.campaignId || deps.resolveCampaignIdFromState(currentType, deps.builder.campaignName);

      if (!currentId) {
        deps.setStatus("Publish failed: save campaign first", false);
        return;
      }

      if (currentType === "idle" || currentType === "visitor") {
        await deps.api("/api/active", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idleCampaignId: currentType === "idle" ? currentId : deps.getState()?.active?.idleCampaignId,
            visitorCampaignId: currentType === "visitor" ? currentId : deps.getState()?.active?.visitorCampaignId,
          }),
        });
        await deps.refresh();
        deps.setStatus(`${currentType} campaign published and set active`, true);
        return;
      }

      if (currentType === "menu") {
        await deps.refresh();
        deps.setStatus("Menu campaign published", true);
        return;
      }

      deps.setStatus("Student campaign published (saved)", true);
    } catch (e) {
      deps.setStatus("Publish failed", false, e.issues || []);
    }
  }

  /**
   * Applies active idle/visitor campaign selections from inspector.
   *
   * @param {object} deps - Action dependencies.
   * @returns {Promise<void>}
   */
  async function applyActiveSelectionsAction(deps) {
    const idleEl = document.getElementById("activeIdleSelect");
    const visitorEl = document.getElementById("activeVisitorSelect");
    if (!idleEl || !visitorEl) return;

    try {
      await deps.api("/api/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idleCampaignId: idleEl.value,
          visitorCampaignId: visitorEl.value,
        }),
      });
      await deps.refresh();
      deps.setStatus("Active campaigns updated", true);
    } catch (e) {
      deps.setStatus("Active campaigns update failed", false, e.issues || []);
    }
  }

  /**
   * Deletes campaign by id after confirmation.
   *
   * @param {object} deps - Action dependencies.
   * @param {string} campaignId - Campaign id.
   * @returns {Promise<void>}
   */
  async function deleteCampaignAction(deps, campaignId) {
    if (!global.confirm(`Delete campaign "${campaignId}"?\n\nThis cannot be undone.`)) return;
    try {
      await deps.api(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: "DELETE" });
      await deps.refresh();
      deps.setStatus("Campaign deleted", true);
    } catch (e) {
      deps.setStatus("Delete failed", false, e.issues);
    }
  }

  /**
   * Deletes student by uid after confirmation.
   *
   * @param {object} deps - Action dependencies.
   * @param {string} uid - Student uid.
   * @returns {Promise<void>}
   */
  async function deleteStudentAction(deps, uid) {
    if (!global.confirm(`Delete student "${uid}"?\n\nThis cannot be undone.`)) return;
    try {
      await deps.api(`/api/students/${encodeURIComponent(uid)}`, { method: "DELETE" });
      await deps.refresh();
      deps.setStatus("Student deleted", true);
    } catch (e) {
      deps.setStatus("Delete failed", false, e.issues);
    }
  }

  /**
   * Deletes currently selected campaign from builder context.
   *
   * @param {object} deps - Action dependencies.
   * @returns {Promise<void>}
   */
  async function deleteCurrentCampaignAction(deps) {
    if (!deps.builder.campaignId) {
      deps.setStatus("No saved campaign selected to delete", false);
      return;
    }

    if (deps.builder.type === "menu") {
      deps.setStatus("Menu campaign cannot be deleted from here", false);
      return;
    }

    if (deps.builder.type === "student") {
      const uid = String(deps.builder.studentUid || "").trim();
      if (!uid) {
        deps.setStatus("Student UID missing for delete", false);
        return;
      }
      await deps.deleteStudent(uid);
      deps.createNewCampaign();
      return;
    }

    await deps.deleteCampaign(deps.builder.campaignId);
    deps.createNewCampaign();
  }

  /**
   * Uploads media file for one block and updates block data URL.
   *
   * @param {object} deps - Action dependencies.
   * @param {string} containerId - Target container id.
   * @param {number} idx - Block index.
   * @returns {Promise<void>}
   */
  async function uploadForBlockAction(deps, containerId, idx) {
    const input = document.getElementById(`${containerId}-file-${idx}`) || document.getElementById("blockFileUpload");
    const target = containerId === "menuBlocks" ? deps.menuBlocks : deps.builder.blocks;
    const block = target[idx];

    if (!block) return;

    if (!input || !input.files || input.files.length === 0) {
      if ((block.type === "IMAGE" || block.type === "VIDEO") && String(block.data || "").trim()) {
        deps.setStatus("Using pasted media URL (no file upload needed)", true);
        deps.updateSaveButtons();
        return;
      }
      deps.setStatus("Select a file or paste a media URL", false);
      return;
    }

    const file = input.files[0];
    if (file.size > 20 * 1024 * 1024) {
      deps.setStatus("File too large (max 20MB)", false);
      return;
    }

    const allowed = block.type === "IMAGE" ? file.type.startsWith("image/") : file.type.startsWith("video/");
    if (!allowed) {
      deps.setStatus(`Selected file is not a ${block.type.toLowerCase()} file`, false);
      return;
    }

    try {
      const form = new FormData();
      form.append("file", file);
      const result = await deps.api("/api/media/upload", {
        method: "POST",
        body: form,
      });

      block.data = result.url;

      if (containerId === "menuBlocks") {
        deps.renderBlockEditor("menuBlocks", deps.menuBlocks, deps.getMenuIssues(), { isMenu: true });
      } else {
        deps.syncFormFromBuilder();
        deps.renderInspector();
      }

      deps.updateSaveButtons();
      deps.setStatus(`Uploaded ${result.filename}`, true);
    } catch (e) {
      deps.setStatus("Upload failed", false, e.issues);
    }
  }

  global.AdminActions = {
    refreshAction,
    saveBuilderCampaignAction,
    publishCampaignAction,
    applyActiveSelectionsAction,
    deleteCampaignAction,
    deleteStudentAction,
    deleteCurrentCampaignAction,
    uploadForBlockAction,
  };
}(window));
