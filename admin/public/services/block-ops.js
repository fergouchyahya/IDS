/**
 * Admin UI block mutation and drag/drop helpers.
 *
 * Responsibilities:
 * - Mutate builder/menu block collections.
 * - Keep reorder and selection logic out of admin-ui.js.
 */

(function initAdminBlockOps(global) {
  /**
   * Reassigns sequential order values to a block list.
   *
   * @param {Array<object>} blocks - Target block list.
   */
  function normalizeBlockOrder(blocks) {
    blocks.forEach((block, idx) => {
      block.order = idx + 1;
    });
  }

  /**
   * Duplicates one builder block and selects the copy.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {number} idx - Source block index.
   */
  function duplicateBlockState(deps, idx) {
    if (!deps.builder.blocks[idx]) return;

    const newBlock = { ...deps.builder.blocks[idx] };
    newBlock.contentId = `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    deps.builder.blocks.splice(idx + 1, 0, newBlock);
    deps.setSelectedBlockIndex(idx + 1);
    deps.syncUiStateStore();
    deps.renderBlocks();
    deps.renderInspector();
    deps.setStatus("Block duplicated", true);
  }

  /**
   * Starts dragging one builder block card.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {DragEvent} event - Native drag event.
   * @param {number} idx - Drag source block index.
   */
  function startDragBlockState(deps, event, idx) {
    deps.setDragSourceIndex(idx);
    deps.syncUiStateStore();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("blockIndex", idx);
    const card = event.currentTarget?.closest(".block-card");
    if (card) {
      card.classList.add("dragging");
    }
  }

  /**
   * Allows a block drop target.
   *
   * @param {DragEvent} event - Native drag event.
   */
  function allowDropState(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  /**
   * Highlights a block drop target on drag enter.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {DragEvent} event - Native drag event.
   * @param {number} targetIdx - Drop target index.
   */
  function dragEnterBlockState(deps, event, targetIdx) {
    event.preventDefault();
    if (targetIdx === deps.getDragSourceIndex()) return;
    const card = event.currentTarget?.closest(".block-card");
    if (card) card.classList.add("drop-target");
  }

  /**
   * Clears drop highlight on drag leave.
   *
   * @param {DragEvent} event - Native drag event.
   */
  function dragLeaveBlockState(event) {
    const card = event.currentTarget?.closest(".block-card");
    if (card) card.classList.remove("drop-target");
  }

  /**
   * Resets drag state and clears temporary DOM classes.
   *
   * @param {object} deps - Runtime dependencies.
   */
  function endDragBlockState(deps) {
    deps.setDragSourceIndex(null);
    deps.syncUiStateStore();
    document.querySelectorAll(".block-card.dragging, .block-card.drop-target").forEach((el) => {
      el.classList.remove("dragging");
      el.classList.remove("drop-target");
    });
  }

  /**
   * Drops a dragged block into a new position.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {DragEvent} event - Native drag event.
   * @param {number} targetIdx - Target index.
   */
  function dropBlockState(deps, event, targetIdx) {
    event.preventDefault();

    const sourceIdxRaw = event.dataTransfer.getData("blockIndex");
    const sourceIdx = Number(sourceIdxRaw || deps.getDragSourceIndex());
    if (sourceIdx === targetIdx) return;

    const selectedBlockIndex = deps.getSelectedBlockIndex();
    if (selectedBlockIndex !== null) {
      if (selectedBlockIndex === sourceIdx) {
        deps.setSelectedBlockIndex(targetIdx);
      } else if (sourceIdx < selectedBlockIndex && targetIdx >= selectedBlockIndex) {
        deps.setSelectedBlockIndex(selectedBlockIndex - 1);
      } else if (sourceIdx > selectedBlockIndex && targetIdx <= selectedBlockIndex) {
        deps.setSelectedBlockIndex(selectedBlockIndex + 1);
      }
    }

    const block = deps.builder.blocks[sourceIdx];
    deps.builder.blocks.splice(sourceIdx, 1);
    deps.builder.blocks.splice(targetIdx, 0, block);
    normalizeBlockOrder(deps.builder.blocks);
    endDragBlockState(deps);
    deps.syncUiStateStore();
    deps.renderBlocks();
    deps.renderInspector();
    deps.updateSaveButtons();
  }

  /**
   * Adds one new builder block.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} type - New block type.
   */
  function addBlockState(deps, type) {
    deps.builder.blocks.push(deps.makeBlockByType(type, deps.builder.blocks.length + 1));
    deps.syncFormFromBuilder();
  }

  /**
   * Adds one new menu block.
   *
   * @param {object} deps - Runtime dependencies.
   */
  function addMenuBlockState(deps) {
    deps.menuBlocks.push(deps.makeBlockByType("TEXT", deps.menuBlocks.length + 1));
    deps.renderMenuEditor();
    deps.updateSaveButtons();
  }

  /**
   * Removes one block from builder/menu editor.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} containerId - `blocks` or `menuBlocks`.
   * @param {number} idx - Target index.
   */
  function removeBlockState(deps, containerId, idx) {
    const target = containerId === "menuBlocks" ? deps.menuBlocks : deps.builder.blocks;
    if (target.length <= 1) return;

    target.splice(idx, 1);
    if (containerId !== "menuBlocks") {
      normalizeBlockOrder(target);
      const selectedBlockIndex = deps.getSelectedBlockIndex();
      if (selectedBlockIndex !== null) {
        deps.setSelectedBlockIndex(Math.min(selectedBlockIndex, target.length - 1));
      }
    }

    if (containerId === "menuBlocks") {
      deps.renderMenuEditor();
    } else {
      deps.renderBlocks();
      deps.renderInspector();
    }
    deps.updateSaveButtons();
  }

  /**
   * Moves one block up/down inside builder or menu editor.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} containerId - `blocks` or `menuBlocks`.
   * @param {number} idx - Current index.
   * @param {number} dir - Direction delta.
   */
  function moveBlockState(deps, containerId, idx, dir) {
    const target = containerId === "menuBlocks" ? deps.menuBlocks : deps.builder.blocks;
    const next = idx + dir;
    if (next < 0 || next >= target.length) return;

    const tmp = target[idx];
    target[idx] = target[next];
    target[next] = tmp;
    normalizeBlockOrder(target);

    if (containerId === "menuBlocks") {
      deps.renderMenuEditor();
    } else {
      deps.renderBlocks();
      deps.renderInspector();
    }
    deps.updateSaveButtons();
  }

  /**
   * Updates one block field and refreshes affected UI.
   *
   * @param {object} deps - Runtime dependencies.
   * @param {string} containerId - `blocks` or `menuBlocks`.
   * @param {number} idx - Block index.
   * @param {string} field - Field name.
   * @param {*} value - New field value.
   */
  function updateBlockFieldState(deps, containerId, idx, field, value) {
    const target = containerId === "menuBlocks" ? deps.menuBlocks : deps.builder.blocks;
    if (!target[idx]) return;

    if (field === "order" || field === "durationSec") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        if (field === "order") {
          deps.setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be a number >= 1" }]);
        } else {
          deps.setStatus("Invalid duration", false, [{ path: `items[${idx}].durationSec`, message: "Duration must be a number >= 1" }]);
        }
        return;
      }
      target[idx][field] = parsed;
    } else {
      target[idx][field] = value;
    }

    if (field === "type") {
      const currentOrder = Number(target[idx].order) || idx + 1;
      target[idx] = deps.makeBlockByType(value, currentOrder);
    }

    if (field === "order") {
      if (!Number.isInteger(target[idx].order) || target[idx].order < 1) {
        deps.setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be an integer >= 1" }]);
        return;
      }
      const selectedContentId = target[idx].contentId;
      target.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      normalizeBlockOrder(target);
      if (containerId !== "menuBlocks" && selectedContentId) {
        deps.setSelectedBlockIndex(target.findIndex((b) => b.contentId === selectedContentId));
      }
    }

    if (containerId === "menuBlocks") {
      if (field === "type" || field === "order") {
        deps.renderMenuEditor();
      }
    } else if (field === "type" || field === "order") {
      deps.renderBlocks();
      deps.renderInspector();
    } else {
      deps.renderBlocks();
    }

    deps.updateSaveButtons();
  }

  global.AdminBlockOps = {
    normalizeBlockOrder,
    duplicateBlockState,
    startDragBlockState,
    allowDropState,
    dragEnterBlockState,
    dragLeaveBlockState,
    endDragBlockState,
    dropBlockState,
    addBlockState,
    addMenuBlockState,
    removeBlockState,
    moveBlockState,
    updateBlockFieldState,
  };
}(window));
