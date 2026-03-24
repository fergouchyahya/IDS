/**
 * Admin inspector component helpers.
 *
 * Responsibilities:
 * - Render active campaign selector panel.
 * - Render inspector content for selected block/campaign state.
 */

(function initAdminInspectorComponent(global) {
  /**
   * Renders active campaign selector panel.
   *
   * @param {object} params - Render dependencies and state.
   * @param {object|null} params.state - Admin runtime state.
   * @param {function(string): string} params.escapeHtml - Escapes text for HTML.
   * @returns {string} Inspector panel HTML.
   */
  function renderActiveCampaignPanel({ state, escapeHtml }) {
    if (!state) return "";

    const idleOptions = (state.idleCampaigns || [])
      .map((c) => `<option value="${escapeHtml(c.campaignId)}"${c.campaignId === state.active?.idleCampaignId ? " selected" : ""}>${escapeHtml(c.campaignName)}</option>`)
      .join("");
    const visitorOptions = (state.visitorCampaigns || [])
      .map((c) => `<option value="${escapeHtml(c.campaignId)}"${c.campaignId === state.active?.visitorCampaignId ? " selected" : ""}>${escapeHtml(c.campaignName)}</option>`)
      .join("");

    const menuOption = state.menuCampaign
      ? `<option value="${escapeHtml(state.menuCampaign.campaignId || "menu-default")}" selected>${escapeHtml(state.menuCampaign.campaignName || "Menu")}</option>`
      : '<option value="" selected>No menu campaign</option>';

    return `
      <div class="inspector-section">
        <h4 class="section-title">Active Campaigns</h4>
        <div class="form-group">
          <label class="form-label">Idle</label>
          <select class="form-select" id="activeIdleSelect">${idleOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Visitor</label>
          <select class="form-select" id="activeVisitorSelect">${visitorOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Menu</label>
          <select class="form-select" id="activeMenuSelect" disabled>${menuOption}</select>
        </div>
        <button class="btn btn-primary" style="width: 100%;" onclick="applyActiveSelections()">Apply</button>
      </div>
    `;
  }

  /**
   * Renders the inspector panel for current selection.
   *
   * @param {object} params - Render dependencies and state.
   * @param {HTMLElement|null} params.inspectorContent - Target inspector container.
   * @param {number|null} params.selectedBlockIndex - Selected block index.
   * @param {string|null} params.selectedCampaignId - Selected campaign id.
   * @param {object} params.builder - Builder state.
   * @param {function(string): string} params.escapeHtml - Escapes text for HTML.
   * @param {string} params.activeCampaignPanelHtml - Rendered active campaign panel.
   */
  function renderInspector({
    inspectorContent,
    selectedBlockIndex,
    selectedCampaignId,
    builder,
    escapeHtml,
    activeCampaignPanelHtml,
  }) {
    if (!inspectorContent) return;

    if (selectedBlockIndex !== null && builder.blocks[selectedBlockIndex]) {
      const block = builder.blocks[selectedBlockIndex];
      const type = String(block.type || "TEXT").toUpperCase();

      inspectorContent.innerHTML = `
        <div class="inspector-section">
          <h4 class="section-title">Block Details</h4>
          <div class="form-group">
            <label class="form-label">Block ID</label>
            <input class="form-input" value="${escapeHtml(block.contentId)}" onclick="selectBlock(${selectedBlockIndex})" readonly style="opacity: 0.6; cursor: not-allowed;" />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" onchange="updateBlockField('blocks', ${selectedBlockIndex}, 'type', this.value)">
              <option value="TEXT" ${type === "TEXT" ? "selected" : ""}>Text</option>
              <option value="IMAGE" ${type === "IMAGE" ? "selected" : ""}>Image</option>
              <option value="VIDEO" ${type === "VIDEO" ? "selected" : ""}>Video</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Duration (seconds)</label>
            <input type="number" class="form-input" min="1" value="${block.durationSec || 30}" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'durationSec', this.value)" />
          </div>
          <div class="form-group">
            <label class="form-label">Order</label>
            <input type="number" class="form-input" min="1" value="${block.order || (selectedBlockIndex + 1)}" onchange="updateBlockField('blocks', ${selectedBlockIndex}, 'order', this.value)" />
          </div>
        </div>

        <div class="inspector-section">
          <h4 class="section-title">${type === "TEXT" ? "Content" : "Media"}</h4>
          ${type === "TEXT"
          ? `<textarea class="form-input form-textarea" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'data', this.value)">${escapeHtml(block.data || "")}</textarea>`
          : `
                <input type="text" class="form-input" value="${escapeHtml(block.data || "")}" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'data', this.value)" placeholder="Paste image/video URL" />
                <div style="margin-top: 10px;">
                  <label class="form-label">Upload ${type.toLowerCase()}</label>
                  <input type="file" id="blocks-file-${selectedBlockIndex}" accept="${type === "IMAGE" ? "image/*" : "video/*"}" />
                  <button class="btn btn-secondary" style="width: 100%; margin-top: 8px;" onclick="uploadForBlock('blocks', ${selectedBlockIndex})">Upload</button>
                </div>
              `}
        </div>

        <div class="inspector-section">
          <h4 class="section-title">Actions</h4>
          <button class="btn btn-secondary" style="width: 100%; margin-bottom: 8px;" onclick="duplicateBlock(${selectedBlockIndex})">Duplicate</button>
          <button class="btn btn-secondary" style="width: 100%; color: var(--danger); border-color: var(--danger);" onclick="removeBlock('blocks', ${selectedBlockIndex})">Delete</button>
        </div>
      `;
      return;
    }

    if (selectedCampaignId || builder) {
      inspectorContent.innerHTML = `
        <div class="inspector-section">
          <h4 class="section-title">Campaign Settings</h4>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" id="inspectorCampaignName" value="${escapeHtml(builder.campaignName)}" oninput="updateCampaignName(this.value)" />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" id="inspectorType" onchange="changeCampaignType(this.value)">
              <option value="idle" ${builder.type === "idle" ? "selected" : ""}>Idle</option>
              <option value="visitor" ${builder.type === "visitor" ? "selected" : ""}>Visitor</option>
              <option value="student" ${builder.type === "student" ? "selected" : ""}>Student</option>
              <option value="menu" ${builder.type === "menu" ? "selected" : ""}>Menu</option>
            </select>
          </div>
          ${builder.type === "student"
          ? `<div class="form-group">
                  <label class="form-label">Student UID</label>
                  <input type="text" class="form-input" value="${escapeHtml(builder.studentUid)}" oninput="updateStudentUidFromInspector(this.value)" />
                </div>`
          : ""}
        </div>

        <div class="inspector-section">
          <h4 class="section-title">Status</h4>
          <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; font-size: 13px;">
            <span class="status-indicator ${builder.blocks.length > 0 ? "live" : "draft"}">
              ${builder.blocks.length > 0 ? "Ready" : "Draft"}
            </span>
          </div>
        </div>
        <div class="inspector-section">
          <h4 class="section-title">Campaign Actions</h4>
          <button class="btn btn-secondary" style="width: 100%; color: var(--danger); border-color: var(--danger);" onclick="deleteCurrentCampaign()">Delete Campaign</button>
        </div>
        ${activeCampaignPanelHtml}
      `;
      return;
    }

    inspectorContent.innerHTML = '<div class="blocks-empty" style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 24px;">Select a campaign or block to view properties</div>';
  }

  global.AdminInspectorComponent = {
    renderActiveCampaignPanel,
    renderInspector,
  };
}(window));
