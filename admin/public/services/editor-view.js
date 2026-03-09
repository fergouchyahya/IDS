/**
 * Admin UI editor and validation view helpers.
 *
 * Responsibilities:
 * - Synchronize builder state into DOM controls.
 * - Render validation summaries and duplicate-source controls.
 */

(function initAdminEditorView(global) {
  /**
   * Replaces select options and selects one value.
   *
   * @param {HTMLSelectElement|null} selectEl - Target select element.
   * @param {Array<object>} options - Value/label options.
   * @param {string} selectedValue - Selected option value.
   */
  function fillSelect(selectEl, options, selectedValue) {
    if (!selectEl) return;

    selectEl.innerHTML = "";
    for (const optData of options) {
      const opt = document.createElement("option");
      opt.value = optData.value;
      opt.textContent = optData.label;
      if (String(optData.value) === String(selectedValue)) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  /**
   * Updates header controls and badges from builder state.
   *
   * @param {object} deps - View dependencies.
   */
  function updateCampaignHeader(deps) {
    const nameInput = document.getElementById("campaignNameInput");
    const typeSelect = document.getElementById("builderType");
    const statusBadge = document.getElementById("statusBadge");

    if (nameInput) nameInput.value = deps.builder.campaignName;
    if (typeSelect) typeSelect.value = deps.builder.type;

    if (statusBadge) {
      statusBadge.textContent = deps.builder.blocks.length > 0 ? "Ready" : "Draft";
      statusBadge.className = `status-indicator ${deps.builder.blocks.length > 0 ? "live" : "draft"}`;
    }

    const studentUidWrap = document.getElementById("studentUidWrap");
    if (studentUidWrap) {
      studentUidWrap.style.display = deps.builder.type === "student" ? "block" : "none";
      const studentUidInput = document.getElementById("studentUid");
      if (studentUidInput) studentUidInput.value = deps.builder.studentUid;
    }
  }

  /**
   * Renders builder campaign type options.
   *
   * @param {object} deps - View dependencies.
   */
  function renderBuilderTypeOptions(deps) {
    fillSelect(
      document.getElementById("builderType"),
      [
        { value: "idle", label: "Idle" },
        { value: "visitor", label: "Visitor" },
        { value: "student", label: "Student" },
        { value: "menu", label: "Menu" },
      ],
      deps.builder.type,
    );
  }

  /**
   * Renders duplicate-source controls for duplicate mode.
   *
   * @param {object} deps - View dependencies.
   */
  function renderDuplicateOptions(deps) {
    const wrap = document.getElementById("duplicateWrap");
    const select = document.getElementById("duplicateSource");
    if (!wrap || !select) return;

    if (deps.builder.mode !== "duplicate") {
      wrap.style.display = "none";
      deps.builder.sourceId = "";
      select.innerHTML = "";
      return;
    }

    const options = deps.getCampaignsByType(deps.builder.type).map((c) => {
      const id = deps.builder.type === "student" ? c.nfcUid : c.campaignId;
      const suffix = deps.builder.type === "student" ? `UID: ${c.nfcUid}` : c.campaignId;
      return { value: id, label: `${c.campaignName} (${suffix})` };
    });

    wrap.style.display = "block";
    if (options.length === 0) {
      fillSelect(select, [{ value: "", label: "No source available" }], "");
      deps.builder.sourceId = "";
      return;
    }

    if (!deps.builder.sourceId) {
      deps.builder.sourceId = options[0].value;
    }

    fillSelect(select, options, deps.builder.sourceId);
  }

  /**
   * Renders issue summary list and target links.
   *
   * @param {object} deps - View dependencies.
   * @param {string} targetId - Target container id.
   * @param {Array<object>} issues - Validation issues.
   * @param {string} scope - Validation scope.
   */
  function renderIssues(deps, targetId, issues, scope) {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (!issues || issues.length === 0) {
      el.style.display = "none";
      el.innerHTML = "";
      return;
    }

    const blockNotes = issues
      .filter((i) => /^items\[\d+\]/.test(i.path))
      .map((i) => {
        const m = /items\[(\d+)\]/.exec(i.path);
        const blockIndex = m ? Number(m[1]) + 1 : "?";
        return `Problem in block ${blockIndex}: ${i.message}`;
      });

    const summary = Array.from(new Set(blockNotes));
    const rows = issues
      .map((i) => {
        const inputId = deps.issuePathToInputId(scope, i.path);
        return `<li><a href="#${deps.escapeHtml(inputId)}" data-target="${deps.escapeHtml(inputId)}">${deps.escapeHtml(i.message)}</a></li>`;
      })
      .join("");
    const summaryHtml = summary.map((s) => `<div>${deps.escapeHtml(s)}</div>`).join("");

    el.style.display = "block";
    el.innerHTML = `${summaryHtml}<ul>${rows}</ul>`;

    el.querySelectorAll("a[data-target]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const inputId = link.getAttribute("data-target");
        const target = document.getElementById(inputId);
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  /**
   * Synchronizes inline field-level error labels for one block editor.
   *
   * @param {object} deps - View dependencies.
   * @param {string} containerId - Target container id.
   * @param {Array<object>} blocks - Rendered blocks.
   * @param {Array<object>} issues - Validation issues.
   */
  function syncInlineBlockErrors(deps, containerId, blocks, issues) {
    const fields = ["contentId", "type", "order", "durationSec", "data"];
    for (let idx = 0; idx < blocks.length; idx += 1) {
      for (const field of fields) {
        const el = document.getElementById(`${containerId}-err-${idx}-${field}`);
        if (!el) continue;
        const msg = deps.getBlockIssues(issues, idx, field);
        el.textContent = msg || "";
      }
    }
  }

  /**
   * Syncs builder state into form controls and derived UI.
   *
   * @param {object} deps - View dependencies.
   */
  function syncFormFromBuilder(deps) {
    const campaignNameInput = document.getElementById("campaignNameInput");
    if (campaignNameInput) campaignNameInput.value = deps.builder.campaignName;

    const typeSelect = document.getElementById("builderType");
    if (typeSelect) typeSelect.value = deps.builder.type;

    const studentUidInput = document.getElementById("studentUid");
    if (studentUidInput) studentUidInput.value = deps.builder.studentUid;

    renderDuplicateOptions(deps);
    deps.renderBlocks();
    deps.updateSaveButtons();
  }

  /**
   * Resets builder state for a new campaign type draft.
   *
   * @param {object} deps - View dependencies.
   * @param {string} type - New builder campaign type.
   */
  function resetBuilderForType(deps, type) {
    deps.builder.type = type;
    deps.builder.campaignId = null;
    deps.builder.mode = "new";
    deps.builder.sourceId = "";
    deps.builder.campaignName = "";
    deps.builder.studentUid = "";
    deps.builder.blocks = [deps.defaultBlock(1)];
    syncFormFromBuilder(deps);
  }

  /**
   * Loads a campaign snapshot into the builder state.
   *
   * @param {object} deps - View dependencies.
   * @param {object} campaign - Campaign payload.
   * @param {string} type - Builder type.
   * @param {string} [studentUid=""] - Student uid for student campaigns.
   */
  function setBuilderFromCampaign(deps, campaign, type, studentUid = "") {
    deps.builder.campaignId = campaign?.campaignId || null;
    deps.builder.type = type;
    deps.builder.campaignName = campaign?.campaignName || "";
    deps.builder.studentUid = studentUid;
    deps.builder.blocks = Array.isArray(campaign?.items) && campaign.items.length > 0
      ? campaign.items.map((item) => ({ ...item }))
      : [deps.defaultBlock(1)];
    syncFormFromBuilder(deps);
  }

  /**
   * Renders the initial builder view after state load.
   *
   * @param {object} deps - View dependencies.
   */
  function fillInitialData(deps) {
    renderBuilderTypeOptions(deps);

    if (!deps.builder.blocks.length) {
      deps.builder.blocks = [deps.defaultBlock(1)];
    }

    deps.renderSidebar();
    deps.renderBlocks();
    deps.renderInspector();
    updateCampaignHeader(deps);
    deps.updateSaveButtons();
  }

  global.AdminEditorView = {
    fillSelect,
    updateCampaignHeader,
    renderBuilderTypeOptions,
    renderDuplicateOptions,
    renderIssues,
    syncInlineBlockErrors,
    syncFormFromBuilder,
    resetBuilderForType,
    setBuilderFromCampaign,
    fillInitialData,
  };
}(window));
