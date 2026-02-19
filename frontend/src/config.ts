const rawBase = import.meta.env.VITE_API_BASE_URL || '';

export const CONFIG = {
  apiBaseUrl: rawBase.replace(/\/+$/, ''), // hapus trailing slash
};

export const API = {
  LOGIN:      () => `${CONFIG.apiBaseUrl}/api/auth/login`,
  VERIFY_OTP: () => `${CONFIG.apiBaseUrl}/api/auth/verify-otp`,
  SUMMARYPO: () => `${CONFIG.apiBaseUrl}/api/purchase-order/summary`,
   LISTUSER:   () => `${CONFIG.apiBaseUrl}/api/user/`,              // GET
    CREATEUSER: () => `${CONFIG.apiBaseUrl}/api/user/`,              // POST
    DETAILUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // GET
    UPDATEUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // PUT
    DELETEUSER: (id: number | string) => `${CONFIG.apiBaseUrl}/api/user/${id}`, // DELETE
    LISTVENDOR:   () => `${CONFIG.apiBaseUrl}/api/vendor/`,   
    DETAILVENDOR: (id: number | string) => `${CONFIG.apiBaseUrl}/api/vendor/${id}`, // GET
    ACCESSVENDOR: (id: number | string) => `${CONFIG.apiBaseUrl}/api/vendor/${id}/access`, // POST
    IMPORT_PO: () => `${CONFIG.apiBaseUrl}/api/purchase-order/import`,

    // SSO helper - backend should expose an endpoint that calls the SOAP SSO service
    SSO_GETUSER: (nrp: string) => `${CONFIG.apiBaseUrl}/api/sso/get-user?nrp=${encodeURIComponent(nrp)}`,
    SUMMARYDASHBOARD:  () => `${CONFIG.apiBaseUrl}/api/dashboard/summary`,

    DASHBOARD_PO_TREND: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/po-trend`,
  DASHBOARD_STATUS_DISTRIBUTION: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/status-distribution`,
  DASHBOARD_MONTHLY_COMPLETION_DELAY: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/monthly-completion-delay`,
  DASHBOARD_VENDOR_SCORECARD: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/scorecard`,
  MASTER_FILTER_DASHBOARD: () =>
    `${CONFIG.apiBaseUrl}/api/dashboard/master-filters`,
};
