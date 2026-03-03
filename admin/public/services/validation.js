/**
 * Admin UI validation helpers.
 *
 * Responsibilities:
 * - Validate builder and menu campaign payloads.
 * - Provide issue-path mapping helpers for inline UI errors.
 */

(function initAdminValidation(global) {
  /**
   * Validates campaign block list and returns issue objects.
   *
   * @param {Array<object>} blocks - Campaign blocks.
   * @returns {Array<object>} Validation issues.
   */
  function validateBlocks(blocks) {
    const issues = [];
    const seenContentIds = new Set();

    if (!Array.isArray(blocks) || blocks.length === 0) {
      issues.push({ path: "items", message: "At least one block is required", code: "required" });
      return issues;
    }

    blocks.forEach((block, idx) => {
      const p = `items[${idx}]`;
      const type = String(block.type || "").toUpperCase();
      const contentId = String(block.contentId || "").trim();
      const data = String(block.data || "").trim();
      const order = Number(block.order);
      const durationSec = Number(block.durationSec);

      if (!contentId) {
        issues.push({ path: `${p}.contentId`, message: "contentId is required", code: "required" });
      } else if (seenContentIds.has(contentId)) {
        issues.push({ path: `${p}.contentId`, message: "contentId must be unique", code: "duplicate" });
      }
      if (contentId) seenContentIds.add(contentId);

      if (!["TEXT", "IMAGE", "VIDEO"].includes(type)) {
        issues.push({ path: `${p}.type`, message: "type must be TEXT, IMAGE or VIDEO", code: "invalid_enum" });
      }

      if (!Number.isInteger(order) || order < 1) {
        issues.push({ path: `${p}.order`, message: "order must be an integer >= 1", code: "invalid_number" });
      }

      if (!Number.isInteger(durationSec) || durationSec < 1) {
        issues.push({ path: `${p}.durationSec`, message: "durationSec must be an integer >= 1", code: "invalid_number" });
      }

      if (!data) {
        issues.push({ path: `${p}.data`, message: `${type || "Block"} data is required`, code: "required" });
      }
    });

    return issues;
  }

  /**
   * Validates main builder state.
   *
   * @param {object} builder - Builder state.
   * @returns {Array<object>} Validation issues.
   */
  function validateBuilder(builder) {
    const issues = [];

    if (builder.type === "student") {
      if (!String(builder.campaignName || "").trim()) {
        issues.push({ path: "campaignName", message: "Student name is required", code: "required" });
      }
      if (!String(builder.studentUid || "").trim()) {
        issues.push({ path: "studentUid", message: "Student UID is required", code: "required" });
      }
    } else if (!String(builder.campaignName || "").trim()) {
      issues.push({ path: "campaignName", message: "Campaign name is required", code: "required" });
    }

    issues.push(...validateBlocks(builder.blocks));
    return issues;
  }

  /**
   * Validates menu campaign editor payload.
   *
   * @param {Array<object>} menuBlocks - Menu block list.
   * @param {string} menuName - Menu campaign name.
   * @returns {Array<object>} Validation issues.
   */
  function validateMenu(menuBlocks, menuName) {
    const issues = [];
    if (!String(menuName || "").trim()) {
      issues.push({ path: "campaignName", message: "Menu campaign name is required", code: "required" });
    }
    issues.push(...validateBlocks(menuBlocks));
    return issues;
  }

  /**
   * Returns inline block issue message for one field.
   *
   * @param {Array<object>} issues - Validation issue list.
   * @param {number} idx - Block index.
   * @param {string} field - Block field name.
   * @returns {string} Error message or empty string.
   */
  function getBlockIssues(issues, idx, field) {
    const path = `items[${idx}].${field}`;
    const issue = issues.find((i) => i.path === path);
    return issue ? issue.message : "";
  }

  /**
   * Maps a validation issue path to a DOM input id.
   *
   * @param {string} scope - Validation scope (`builder` or `menu`).
   * @param {string} path - Validation path.
   * @returns {string} Target DOM id.
   */
  function issuePathToInputId(scope, path) {
    if (scope === "builder") {
      if (path === "campaignName") return "campaignName";
      if (path === "studentUid") return "studentUid";
      const m = /^items\[(\d+)\]\.(.+)$/.exec(path);
      if (m) return `blocks-input-${m[1]}-${m[2]}`;
      return "campaignName";
    }

    if (scope === "menu") {
      if (path === "campaignName") return "menuName";
      const m = /^items\[(\d+)\]\.(.+)$/.exec(path);
      if (m) return `menuBlocks-input-${m[1]}-${m[2]}`;
      return "menuName";
    }

    return "status";
  }

  global.AdminValidation = {
    validateBlocks,
    validateBuilder,
    validateMenu,
    getBlockIssues,
    issuePathToInputId,
  };
}(window));
