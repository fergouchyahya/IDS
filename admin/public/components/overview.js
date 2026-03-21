/**
 * Admin overview component helpers.
 *
 * Responsibilities:
 * - Render campaign timeline mini-bars for overview cards.
 * - Render overview card grid with filtering and counters.
 */

(function initAdminOverviewComponent(global) {
  /**
   * Renders timeline bar HTML from campaign items.
   *
   * @param {Array<object>} items - Campaign items.
   * @returns {string} Timeline HTML snippet.
   */
  function renderTimelineBars(items) {
    const list = Array.isArray(items) ? items.slice(0, 6) : [];
    if (list.length === 0) {
      return '<div class="overview-timeline-empty">No blocks yet</div>';
    }

    const maxDuration = Math.max(...list.map((item) => Math.max(1, Number(item.durationSec) || 1)), 1);
    return `
      <div class="overview-timeline-bars">
        ${list
    .map((item) => {
      const duration = Math.max(1, Number(item.durationSec) || 1);
      const width = Math.max(12, Math.round((duration / maxDuration) * 100));
      return `<span class="overview-bar" style="width:${width}%"></span>`;
    })
    .join("")}
      </div>
    `;
  }

  /**
   * Renders the overview card grid and updates counters.
   *
   * @param {object} params - Render dependencies and state.
   * @param {HTMLElement|null} params.sidebarContent - Overview grid element.
   * @param {object|null} params.state - Runtime admin state.
   * @param {string} params.sidebarQuery - Active search query.
   * @param {string} params.overviewTypeFilter - Active type filter.
   * @param {string} params.overviewStatusFilter - Active status filter.
   * @param {string|null} params.selectedCampaignId - Selected campaign id.
   * @param {function(): Array<object>} params.getCards - Returns normalized card data.
   * @param {function(string): string} params.escapeHtml - Escapes output for HTML.
   * @param {function(string): string} params.cardTypeLabel - Label resolver.
   * @param {function(string): string} params.toRelativeTime - Relative time formatter.
   */
  function renderSidebar({
    sidebarContent,
    state,
    sidebarQuery,
    overviewTypeFilter,
    overviewStatusFilter,
    selectedCampaignId,
    getCards,
    escapeHtml,
    cardTypeLabel,
    toRelativeTime,
  }) {
    if (!sidebarContent) return;
    if (!state) {
      sidebarContent.innerHTML = '<div class="overview-empty">Loading campaigns...</div>';
      return;
    }

    const query = String(sidebarQuery || "").trim().toLowerCase();
    const cards = getCards().filter((card) => {
      if (query && !String(card.name || "").toLowerCase().includes(query) && !String(card.subtitle || "").toLowerCase().includes(query)) {
        return false;
      }
      if (overviewTypeFilter !== "all" && card.kind !== overviewTypeFilter) return false;
      if (overviewStatusFilter !== "all" && card.status !== overviewStatusFilter) return false;
      return true;
    });

    const liveCount = cards.filter((card) => card.status === "live").length;
    const totalCount = cards.length;
    const countEl = document.getElementById("overviewCount");
    if (countEl) {
      countEl.textContent = `${totalCount} campaigns`;
    }
    const liveEl = document.getElementById("overviewLiveCount");
    if (liveEl) {
      liveEl.textContent = `${liveCount} live`;
    }

    const html = cards.map((card) => {
      const isActive = selectedCampaignId === card.id;
      const safeKind = escapeHtml(card.kind);
      const kindArg = JSON.stringify(String(card.kind || ""));
      const idArg = JSON.stringify(String(card.id || ""));
      return `
        <article class="overview-card type-${safeKind} status-${escapeHtml(card.status)} ${isActive ? "active" : ""}" onclick='loadCampaignToEditor(${kindArg}, ${idArg})'>
          <div class="overview-card-accent"></div>
          <div class="overview-card-top">
            <span class="type-badge">${escapeHtml(cardTypeLabel(card.kind))}</span>
            <span class="status-pill ${escapeHtml(card.status)}">${escapeHtml(card.status === "live" ? "Live" : "Draft")}</span>
          </div>
          <h3 class="overview-card-title">${escapeHtml(card.name)}</h3>
          <p class="overview-card-subtitle">${escapeHtml(card.subtitle)}</p>
          <div class="overview-meta">
            <span>${card.items.length} blocks</span>
            <span>Modified ${escapeHtml(toRelativeTime(card.updatedAt))}</span>
          </div>
          ${renderTimelineBars(card.items)}
          <div class="overview-actions" onclick="event.stopPropagation()">
            <button class="overview-action" onclick='loadCampaignToEditor(${kindArg}, ${idArg})'>Edit</button>
            <button class="overview-action" onclick='duplicateCampaignFromOverview(${kindArg}, ${idArg})'>Duplicate</button>
            <button class="overview-action primary" onclick='deployCampaignFromOverview(${kindArg}, ${idArg}, this)'>Deploy</button>
          </div>
        </article>
      `;
    }).join("");

    sidebarContent.innerHTML = html || '<div class="overview-empty">No campaigns match your filters.</div>';
  }

  global.AdminOverviewComponent = {
    renderTimelineBars,
    renderSidebar,
  };
}(window));
