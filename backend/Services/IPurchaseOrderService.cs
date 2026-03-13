namespace EXPOAPI.Services
{
    public interface IPurchaseOrderService
    {
        Task<Dictionary<string, object?>> GetPurchaseOrderSummaryAsync(Dictionary<string, object?>? parameters = null, CancellationToken ct = default);

        Task<Dictionary<string, object?>> GetPoDashboardSummaryAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default
        );

        Task<Dictionary<string, object?>> GetPoVendorScorecardAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string docType = "All",
            string? vendor = null,
            CancellationToken ct = default
        );

        Task<List<Dictionary<string, object?>>> GetPoTrendAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default
        );

        Task<List<Dictionary<string, object?>>> GetPoStatusDistributionAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default
        );

        Task<List<Dictionary<string, object?>>> GetPoMonthlyCompletionDelayAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default
        );
        Task<Dictionary<string, object?>> GetPurchaseOrderItemsAsync(
           string? poNumber = null,
           string? status = null,
           string? attention = null,
           string? vendor = null,
           string? q = null,
           int page = 1,
           int pageSize = 50,
           bool eligibleOnly = true,
           CancellationToken ct = default);
    

        Task<Dictionary<string, object?>> GetPoDashboardMasterfiltersAsync(CancellationToken ct = default);

        Task<(List<Dictionary<string, object?>> StatusFlow, List<Dictionary<string, object?>> ReEtaRequests)>
            GetPurchaseOrderDetailAsync(string poid, CancellationToken ct = default);
    }
}
