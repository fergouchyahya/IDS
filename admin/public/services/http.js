/**
 * Admin HTTP and UI status helpers.
 *
 * Responsibilities:
 * - Escape HTML output.
 * - Call admin API endpoints.
 * - Display transient status toasts.
 */

(function initAdminHttp(global) {
  let toastTimeout = null;

  /**
   * Escapes HTML special characters.
   *
   * @param {*} input - Input value.
   * @returns {string} Escaped text.
   */
  function escapeHtml(input) {
    return String(input)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /**
   * Sets status toast in UI.
   *
   * @param {string} msg - Status message.
   * @param {boolean} [ok=true] - Success state.
   * @param {Array<object>} [issues=[]] - Validation issues.
   */
  function setStatus(msg, ok = true, issues = []) {
    const el = document.getElementById("status");
    if (!el) return;
    el.className = `status-toast ${ok ? "good" : "bad"}`;
    const list = Array.isArray(issues) ? issues : [];
    if (!ok && list.length > 0) {
      const detailItems = list
        .slice(0, 4)
        .map((i) => `<li>${escapeHtml(i.path || "field")}: ${escapeHtml(i.message || "invalid value")}</li>`)
        .join("");
      const more = list.length > 4 ? `<div style="margin-top:6px;font-size:11px;opacity:.85;">+${list.length - 4} more error(s)</div>` : "";
      el.innerHTML = `<div><strong>${escapeHtml(msg)}</strong></div><ul style="margin:6px 0 0 16px;padding:0;">${detailItems}</ul>${more}`;
    } else {
      el.textContent = msg;
    }
    el.classList.add("show");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      el.classList.remove("show");
    }, 4000);
  }

  /**
   * Calls JSON admin API and throws normalized errors on non-2xx.
   *
   * @param {string} url - Request URL.
   * @param {object} [options={}] - Fetch options.
   * @returns {Promise<object>} Parsed JSON response.
   */
  async function api(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.issues = Array.isArray(data.issues) ? data.issues : [];
      throw err;
    }

    return data;
  }

  global.AdminHttp = {
    setStatus,
    escapeHtml,
    api,
  };
}(window));
