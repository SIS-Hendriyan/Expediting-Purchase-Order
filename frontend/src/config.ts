const rawBase = import.meta.env.VITE_API_BASE_URL || "";

export const CONFIG = {
  apiBaseUrl: rawBase.replace(/\/+$/, ""), // hapus trailing slash
};

export const API = {
  LOGIN: () => `${CONFIG.apiBaseUrl}/api/auth/login`,
  VERIFY_OTP: () => `${CONFIG.apiBaseUrl}/api/auth/verify-otp`,
  SUMMARYPO: () => `${CONFIG.apiBaseUrl}/api/purchase-order/summary`,
  LISTUSER: () => `${CONFIG.apiBaseUrl}/api/user/`, // GET
  CREATEUSER: () => `${CONFIG.apiBaseUrl}/api/user/`, // POST
  DETAILUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // GET
  UPDATEUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // PUT
  DELETEUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // DELETE
  LISTVENDOR: () => `${CONFIG.apiBaseUrl}/api/vendor/`,
  DETAILVENDOR: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/vendor/${id}`, // GET
  ACCESSVENDOR: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/vendor/${id}/access`, // POST
  IMPORT_PO: () => `${CONFIG.apiBaseUrl}/api/purchase-order/import`,
  DETAILPO: (poid: number | string) =>
    `${CONFIG.apiBaseUrl}/api/purchase-order/${poid}/detail`,
  MASTERPO: () => `${CONFIG.apiBaseUrl}/api/purchase-order/master`,
  // Re-ETA
  REETA_LIST: () => `${CONFIG.apiBaseUrl}/api/re-eta/requests`,
  REETA_DETAIL: (id: number | string, item?: string | null) =>
    item
      ? `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}?purchaseDocument=${encodeURIComponent(String(id))}&item=${encodeURIComponent(item)}`
      : `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}`,
  REETA_CREATE: () => `${CONFIG.apiBaseUrl}/api/re-eta/requests`,
  REETA_APPROVE: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}/approve`,
  REETA_REJECT: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}/reject`,
  REETA_VENDOR_RESPONSE: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}/vendor-response`,
  REETA_LOGS: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/re-eta/requests/${id}/logs`,
  REETA_DOC: (docId: number | string) =>
    `${CONFIG.apiBaseUrl}/api/re-eta/documents/${docId}`,

  // PO items eligible (buat Create Request dropdown)
  PO_ITEMS: () => `${CONFIG.apiBaseUrl}/api/purchase-order/items`,

  // PO needing update
  PO_NEEDING_UPDATE: () => `${CONFIG.apiBaseUrl}/api/purchase-order/needing-update`,

  // SSO helper - backend should expose an endpoint that calls the SOAP SSO service
  SSO_GETUSER: (nrp: string) =>
    `${CONFIG.apiBaseUrl}/api/sso/get-user?nrp=${encodeURIComponent(nrp)}`,
  SUMMARYDASHBOARD: () => `${CONFIG.apiBaseUrl}/api/dashboard/summary`,

  DASHBOARD_PO_TREND: (vendor?: string) =>
    vendor
      ? `${CONFIG.apiBaseUrl}/api/dashboard/po-trend?vendor=${encodeURIComponent(vendor)}`
      : `${CONFIG.apiBaseUrl}/api/dashboard/po-trend`,
  DASHBOARD_STATUS_DISTRIBUTION: (vendor?: string) =>
    vendor
      ? `${CONFIG.apiBaseUrl}/api/dashboard/status-distribution?vendor=${encodeURIComponent(vendor)}`
      : `${CONFIG.apiBaseUrl}/api/dashboard/status-distribution`,
  DASHBOARD_MONTHLY_COMPLETION_DELAY: (vendor?: string) =>
    vendor
      ? `${CONFIG.apiBaseUrl}/api/dashboard/monthly-completion-delay?vendor=${encodeURIComponent(vendor)}`
      : `${CONFIG.apiBaseUrl}/api/dashboard/monthly-completion-delay`,
  DASHBOARD_VENDOR_SCORECARD: (vendor?: string) =>
    vendor
      ? `${CONFIG.apiBaseUrl}/api/dashboard/scorecard?vendor=${encodeURIComponent(vendor)}`
      : `${CONFIG.apiBaseUrl}/api/dashboard/scorecard`,
  MASTER_FILTER_DASHBOARD: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/master-filters`,

  DASHBOARD_VENDOR_PERFORMANCE: (vendorName: string) =>
    `${CONFIG.apiBaseUrl}/api/dashboard/vendor-performance?vendorName=${encodeURIComponent(vendorName)}`,
  DASHBOARD_VENDOR_EVALUATION: (role: string, vendorName?: string) =>
    vendorName
      ? `${CONFIG.apiBaseUrl}/api/dashboard/vendor-evaluation?role=${role}&vendorName=${encodeURIComponent(vendorName)}`
      : `${CONFIG.apiBaseUrl}/api/dashboard/vendor-evaluation?role=${role}`,

  POSTATUS_UPSERT: () => `${CONFIG.apiBaseUrl}/api/PoStatus/upsert`,
  POSTATUS_DETAIL: (idPoItem: number | string) =>
    `${CONFIG.apiBaseUrl}/api/PoStatus/${idPoItem}`,
  POSTATUS_LIST: () => `${CONFIG.apiBaseUrl}/api/PoStatus`,
  POSTATUS_ON_DELIVERY: () => `${CONFIG.apiBaseUrl}/api/PoStatus/on-delivery`,

  // Delay Reasons
  DELAY_REASONS_LIST: () => `${CONFIG.apiBaseUrl}/api/delayreasons`,
  DELAY_REASONS_CREATE: () => `${CONFIG.apiBaseUrl}/api/delayreasons`,
  DELAY_REASONS_UPDATE: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/delayreasons/${id}`,
  DELAY_REASONS_DELETE: (id: number | string) =>
    `${CONFIG.apiBaseUrl}/api/delayreasons/${id}`,
};
