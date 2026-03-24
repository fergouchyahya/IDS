/**
 * Admin builder component helpers.
 *
 * Responsibilities:
 * - Render builder block cards.
 * - Render block form editor markup for builder/menu contexts.
 */

(function initAdminBuilderComponent(global) {
  /**
   * Renders builder block cards list.
   *
   * @param {object} params - Render dependencies and state.
   * @param {HTMLElement|null} params.blocksEl - Blocks container element.
   * @param {object} params.builder - Builder state.
   * @param {number|null} params.selectedBlockIndex - Selected block index.
   * @param {function(string): string} params.escapeHtml - Escapes text for HTML.
   */
  function renderBlocks({ blocksEl, builder, selectedBlockIndex, escapeHtml }) {
    if (!blocksEl) return;

    if (!builder.blocks || builder.blocks.length === 0) {
      blocksEl.innerHTML = '<div class="blocks-empty"><p>No blocks added yet</p><p style="font-size: 12px;">Click "Add Block" to get started</p></div>';
      return;
    }

    const html = builder.blocks
      .map((block, idx) => {
        const type = String(block.type || "TEXT").toUpperCase();
        const isSelected = selectedBlockIndex === idx;
        const preview = type === "TEXT" ? block.data : `${type.toLowerCase()} content`;

        let mediaPreview = "";
        if (type === "IMAGE" && block.data) {
          mediaPreview = `<div class="block-media-preview"><img src="${escapeHtml(block.data)}" alt="preview" /></div>`;
        } else if (type === "VIDEO" && block.data) {
          mediaPreview = `<div class="block-media-preview"><video src="${escapeHtml(block.data)}" muted></video></div>`;
        }

        return `
          <div class="block-card ${isSelected ? "selected" : ""}"
               draggable="true"
               onclick="selectBlock(${idx})"
               ondragstart="startDragBlock(event, ${idx})"
               ondragover="allowDrop(event)"
               ondragenter="dragEnterBlock(event, ${idx})"
               ondragleave="dragLeaveBlock(event)"
               ondrop="dropBlock(event, ${idx})"
               ondragend="endDragBlock()">
            <div class="block-drag-handle">⋮⋮</div>
            <div class="block-content">
              <div class="block-head">
                <span class="block-type-badge">${escapeHtml(type)}</span>
                <span class="block-preview">${escapeHtml(preview.slice(0, 60))}</span>
                <span class="block-duration">${block.durationSec || 30}s</span>
              </div>
              ${mediaPreview}
            </div>
            <div class="block-menu" onclick="event.stopPropagation(); showBlockMenu(${idx})">∴</div>
          </div>
        `;
      })
      .join("");

    blocksEl.innerHTML = html;
  }

  /**
   * Renders block editor controls for builder/menu blocks.
   *
   * @param {object} params - Render dependencies and state.
   * @param {string} params.containerId - Target container element id.
   * @param {Array<object>} params.blocks - Blocks to render.
   * @param {Array<object>} params.issues - Validation issues.
   * @param {boolean} params.isMenu - Whether this renders menu blocks.
   * @param {string} params.builderType - Current builder type.
   * @param {function(string): string} params.escapeHtml - Escapes text for HTML.
   * @param {function(Array<object>, number, string): string} params.getBlockIssues - Issues accessor.
   */
  function renderBlockEditor({
    containerId,
    blocks,
    issues,
    isMenu,
    builderType,
    escapeHtml,
    getBlockIssues,
  }) {
    const html = blocks
      .map((b, idx) => {
        const type = String(b.type || "TEXT").toUpperCase();
        const dataLabel = type === "TEXT" ? "Text content" : `${type} URL`;
        const uploadVisible = type === "IMAGE" || type === "VIDEO";

        return `
          <div class="block">
            <div class="block-head">
              <strong>Block ${idx + 1}</strong>
              <div class="row" style="margin:0">
                <button class="ghost" onclick="moveBlock('${containerId}', ${idx}, -1)" ${idx === 0 ? "disabled" : ""}>Up</button>
                <button class="ghost" onclick="moveBlock('${containerId}', ${idx}, 1)" ${idx === blocks.length - 1 ? "disabled" : ""}>Down</button>
                <button class="danger" onclick="removeBlock('${containerId}', ${idx})" ${blocks.length <= 1 ? "disabled" : ""}>Remove</button>
              </div>
            </div>
            <div class="row">
              <div class="stack">
                <label>contentId</label>
                <input id="${containerId}-input-${idx}-contentId" value="${escapeHtml(b.contentId)}" oninput="updateBlockField('${containerId}', ${idx}, 'contentId', this.value)" />
                <div id="${containerId}-err-${idx}-contentId" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "contentId"))}</div>
              </div>
              <div class="stack">
                <label>type</label>
                <select id="${containerId}-input-${idx}-type" onchange="updateBlockField('${containerId}', ${idx}, 'type', this.value)">
                  <option value="TEXT" ${type === "TEXT" ? "selected" : ""}>TEXT</option>
                  <option value="IMAGE" ${type === "IMAGE" ? "selected" : ""}>IMAGE</option>
                  <option value="VIDEO" ${type === "VIDEO" ? "selected" : ""}>VIDEO</option>
                </select>
                <div id="${containerId}-err-${idx}-type" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "type"))}</div>
              </div>
              <div class="stack">
                <label>order</label>
                <input id="${containerId}-input-${idx}-order" type="number" min="1" value="${Number(b.order)}" onchange="updateBlockField('${containerId}', ${idx}, 'order', this.value)" />
                <div id="${containerId}-err-${idx}-order" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "order"))}</div>
              </div>
              <div class="stack">
                <label>durationSec</label>
                <input id="${containerId}-input-${idx}-durationSec" type="number" min="1" value="${Number(b.durationSec)}" oninput="updateBlockField('${containerId}', ${idx}, 'durationSec', this.value)" />
                <div id="${containerId}-err-${idx}-durationSec" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "durationSec"))}</div>
              </div>
            </div>

            <div class="stack">
              <label>${dataLabel}</label>
              ${type === "TEXT"
          ? `<textarea id="${containerId}-input-${idx}-data" oninput="updateBlockField('${containerId}', ${idx}, 'data', this.value)">${escapeHtml(b.data || "")}</textarea>`
          : `<input id="${containerId}-input-${idx}-data" value="${escapeHtml(b.data || "")}" oninput="updateBlockField('${containerId}', ${idx}, 'data', this.value)" placeholder="https://... or uploaded URL" />`
        }
              <div id="${containerId}-err-${idx}-data" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "data"))}</div>
            </div>

            <div class="row" style="display:${uploadVisible ? "flex" : "none"}">
              <input id="${containerId}-file-${idx}" type="file" accept="${type === "IMAGE" ? "image/*" : "video/*"}" />
              <button class="secondary" onclick="uploadForBlock('${containerId}', ${idx})">Upload ${type.toLowerCase()}</button>
              <div class="mini">Max 20MB, stored in admin uploads.</div>
            </div>
          </div>
        `;
      })
      .join("");

    document.getElementById(containerId).innerHTML = html || "<i>No blocks</i>";

    if (!isMenu) {
      const uidWrap = document.getElementById("studentUidWrap");
      uidWrap.style.display = builderType === "student" ? "block" : "none";
    }
  }

  global.AdminBuilderComponent = {
    renderBlocks,
    renderBlockEditor,
  };
}(window));
