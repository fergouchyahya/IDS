/**
 * Admin campaign selector helpers.
 *
 * Responsibilities:
 * - Read and normalize campaign data from admin state.
 * - Provide reusable selectors for UI rendering and actions.
 */

(function initAdminCampaignSelectors(global) {
  /**
   * Returns generated student campaigns list from state.
   *
   * @param {object|null} state - Admin API state payload.
   * @returns {Array<object>} Generated student campaign records.
   */
  function getGeneratedStudentCampaigns(state) {
    return Array.isArray(state?.generatedStudentCampaigns) ? state.generatedStudentCampaigns : [];
  }

  /**
   * Finds student campaign by NFC UID (manual preferred over generated).
   *
   * @param {object|null} state - Admin API state payload.
   * @param {string} uid - Student UID.
   * @returns {object|null} Student campaign metadata and campaign payload.
   */
  function findStudentCampaignByUid(state, uid) {
    const key = String(uid || "").trim();
    if (!key) return null;

    const manual = (state?.students || []).find((s) => s.nfcUid === key);
    if (manual && manual.campaign) {
      return {
        source: "manual",
        nfcUid: key,
        name: manual.name || "Unnamed student",
        campaign: manual.campaign,
      };
    }

    const generated = getGeneratedStudentCampaigns(state).find((item) => item.nfcUid === key);
    if (generated && generated.campaign) {
      return {
        source: "generated",
        nfcUid: key,
        name: generated.name || "Generated student",
        campaign: generated.campaign,
      };
    }

    return null;
  }

  /**
   * Returns campaigns for a given kind from admin state.
   *
   * @param {object|null} state - Admin API state payload.
   * @param {string} type - Campaign type.
   * @returns {Array<object>} Campaign list.
   */
  function getCampaignsByType(state, type) {
    if (!state) return [];
    if (type === "idle") return state.idleCampaigns || [];
    if (type === "visitor") return state.visitorCampaigns || [];
    if (type === "student") {
      const manual = (state.students || []).map((s) => ({
        campaignId: s.campaign?.campaignId || `student-${s.nfcUid}`,
        campaignName: s.name,
        kind: "student",
        nfcUid: s.nfcUid,
        items: s.campaign?.items || [],
        updatedAt: s.updatedAt || s.campaign?.updatedAt || state.updatedAt || "",
        source: "manual",
      }));

      const existing = new Set(manual.map((item) => item.nfcUid));
      const generated = getGeneratedStudentCampaigns(state)
        .filter((item) => !existing.has(item.nfcUid))
        .map((item) => ({
          campaignId: item.campaign?.campaignId || `student-${item.nfcUid}`,
          campaignName: item.name,
          kind: "student",
          nfcUid: item.nfcUid,
          items: item.campaign?.items || [],
          updatedAt: item.campaign?.updatedAt || state.updatedAt || "",
          source: "generated",
        }));

      return [...manual, ...generated];
    }
    return [];
  }

  /**
   * Formats an ISO timestamp as relative time text.
   *
   * @param {string} isoString - ISO date string.
   * @returns {string} Human-readable relative time.
   */
  function toRelativeTime(isoString) {
    const value = String(isoString || "").trim();
    if (!value) return "Unknown";
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return "Unknown";

    const delta = Date.now() - ts;
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 8) return `${days}d ago`;

    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /**
   * Normalizes all campaign-like entities into overview cards.
   *
   * @param {object|null} state - Admin API state payload.
   * @returns {Array<object>} Sorted card list.
   */
  function normalizeCampaignCards(state) {
    if (!state) return [];

    const cards = [];

    for (const campaign of state.idleCampaigns || []) {
      cards.push({
        kind: "idle",
        id: campaign.campaignId,
        name: campaign.campaignName || "Untitled idle campaign",
        status: campaign.campaignId === state.active?.idleCampaignId ? "live" : "draft",
        items: Array.isArray(campaign.items) ? campaign.items : [],
        updatedAt: campaign.updatedAt || campaign.generatedAt || state.updatedAt || "",
        subtitle: campaign.campaignId || "",
      });
    }

    for (const campaign of state.visitorCampaigns || []) {
      cards.push({
        kind: "visitor",
        id: campaign.campaignId,
        name: campaign.campaignName || "Untitled visitor campaign",
        status: campaign.campaignId === state.active?.visitorCampaignId ? "live" : "draft",
        items: Array.isArray(campaign.items) ? campaign.items : [],
        updatedAt: campaign.updatedAt || campaign.generatedAt || state.updatedAt || "",
        subtitle: campaign.campaignId || "",
      });
    }

    for (const student of getCampaignsByType(state, "student")) {
      const isGenerated = student.source === "generated";
      cards.push({
        kind: "student",
        id: student.nfcUid,
        name: student.campaignName || "Unnamed student profile",
        status: "live",
        items: Array.isArray(student.items) ? student.items : [],
        updatedAt: student.updatedAt || state.updatedAt || "",
        subtitle: `UID: ${student.nfcUid || "n/a"}${isGenerated ? " | Auto-generated" : ""}`,
      });
    }

    if (state.menuCampaign) {
      cards.push({
        kind: "menu",
        id: state.menuCampaign.campaignId || "menu-default",
        name: state.menuCampaign.campaignName || "Menu",
        status: "live",
        items: Array.isArray(state.menuCampaign.items) ? state.menuCampaign.items : [],
        updatedAt: state.menuCampaign.updatedAt || state.updatedAt || "",
        subtitle: state.menuCampaign.campaignId || "menu-default",
      });
    }

    return cards.sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  /**
   * Returns human-readable label for campaign kind.
   *
   * @param {string} kind - Campaign kind.
   * @returns {string} Display label.
   */
  function cardTypeLabel(kind) {
    return {
      idle: "Idle",
      visitor: "Visitor",
      student: "Student",
      menu: "Menu",
    }[kind] || "Campaign";
  }

  global.AdminCampaignSelectors = {
    getGeneratedStudentCampaigns,
    findStudentCampaignByUid,
    getCampaignsByType,
    toRelativeTime,
    normalizeCampaignCards,
    cardTypeLabel,
  };
}(window));
