/**
 * Admin block factory helpers.
 *
 * Responsibilities:
 * - Create default block payloads.
 * - Create block payloads by type.
 */

(function initAdminBlocks(global) {
  /**
   * Creates a default campaign block.
   *
   * @param {number} [order=1] - Block order.
   * @returns {object} Default block payload.
   */
  function defaultBlock(order = 1) {
    return {
      contentId: `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      type: "TEXT",
      data: "",
      order,
      durationSec: 30,
    };
  }

  /**
   * Creates a new block configured for a given type.
   *
   * @param {string} type - Block type.
   * @param {number} order - Block order.
   * @returns {object} New block payload.
   */
  function makeBlockByType(type, order) {
    const upper = String(type || "TEXT").toUpperCase();
    const block = defaultBlock(order);
    block.type = upper;
    if (upper === "IMAGE" || upper === "VIDEO") {
      block.durationSec = 12;
    }
    return block;
  }

  global.AdminBlocks = {
    defaultBlock,
    makeBlockByType,
  };
}(window));
