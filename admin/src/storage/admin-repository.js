/**
 * Abstract admin repository interface.
 *
 * Defines the async persistence boundary for admin state.
 * Concrete implementations (file, SQL) extend this class.
 */

class AdminRepository {
  /**
   * Reads current persisted state.
   *
   * @returns {Promise<object>} Current state object.
   */
  async readState() {
    throw new Error("AdminRepository.readState() not implemented");
  }

  /**
   * Writes updated state to persistence.
   *
   * @param {object} state - Updated state object.
   * @returns {Promise<object>} Persisted state snapshot.
   */
  async writeState(state) {
    throw new Error("AdminRepository.writeState() not implemented");
  }

  /**
   * Returns persistence health diagnostics.
   *
   * @returns {Promise<object>} Health payload.
   */
  async getHealth() {
    throw new Error("AdminRepository.getHealth() not implemented");
  }
}

module.exports = { AdminRepository };
