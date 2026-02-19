using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Controllers
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize]
    public sealed class DashboardController : ControllerBase
    {
        private readonly IPurchaseOrderService _po;

        public DashboardController(IPurchaseOrderService po)
        {
            _po = po ?? throw new ArgumentNullException(nameof(po));
        }

        [HttpGet("summary")]
        public async Task<IActionResult> Summary(
            [FromQuery(Name = "start_date")] string? startDateStr,
            [FromQuery(Name = "end_date")] string? endDateStr,
            [FromQuery] string? plant,
            [FromQuery] string? group,
            [FromQuery] string? vendor,
            [FromQuery(Name = "doc_type")] string? docType = "All",
            CancellationToken ct = default)
        {
            if (!TryParseDate(startDateStr, out var startDate, out var err))
                return BadRequestResponse(err!);

            if (!TryParseDate(endDateStr, out var endDate, out err))
                return BadRequestResponse(err!);

            if (startDate.HasValue && endDate.HasValue && startDate.Value.Date > endDate.Value.Date)
                return BadRequestResponse("start_date cannot be after end_date");

            try
            {
                var data = await _po.GetPoDashboardSummaryAsync(
                    startDate: startDate,
                    endDate: endDate,
                    plant: plant,
                    group: group,
                    vendor: vendor,
                    docType: docType ?? "All",
                    ct: ct
                );

                return OkResponse("Dashboard summary retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch dashboard summary");
            }
        }

        [HttpGet("scorecard")]
        public async Task<IActionResult> Scorecard(
            [FromQuery(Name = "start_date")] string? startDateStr,
            [FromQuery(Name = "end_date")] string? endDateStr,
            [FromQuery] string? plant,
            [FromQuery] string? group,
            [FromQuery(Name = "doc_type")] string? docType = "All",
            [FromQuery] string? vendor = null,
            CancellationToken ct = default)
        {
            if (!TryParseDate(startDateStr, out var startDate, out var err))
                return BadRequestResponse(err!);

            if (!TryParseDate(endDateStr, out var endDate, out err))
                return BadRequestResponse(err!);

            if (startDate.HasValue && endDate.HasValue && startDate.Value.Date > endDate.Value.Date)
                return BadRequestResponse("start_date cannot be after end_date");

            try
            {
                var data = await _po.GetPoVendorScorecardAsync(
                    startDate: startDate,
                    endDate: endDate,
                    plant: plant,
                    group: group,
                    docType: docType ?? "All",
                    vendor: vendor,
                    ct: ct
                );

                return OkResponse("Vendor scorecard data retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch vendor scorecard data");
            }
        }

        [HttpGet("po-trend")]
        public async Task<IActionResult> PoTrend(
            [FromQuery(Name = "start_date")] string? startDateStr,
            [FromQuery(Name = "end_date")] string? endDateStr,
            [FromQuery] string? plant,
            [FromQuery(Name = "purchasing_group")] string? purchasingGroup,
            [FromQuery] string? vendor,
            [FromQuery(Name = "doc_type")] string? docType = "All",
            CancellationToken ct = default)
        {
            if (!TryParseDate(startDateStr, out var startDate, out var err))
                return BadRequestResponse(err!);

            if (!TryParseDate(endDateStr, out var endDate, out err))
                return BadRequestResponse(err!);

            if (startDate.HasValue && endDate.HasValue && startDate.Value.Date > endDate.Value.Date)
                return BadRequestResponse("start_date cannot be after end_date");

            try
            {
                var data = await _po.GetPoTrendAsync(
                    startDate: startDate,
                    endDate: endDate,
                    plant: plant,
                    purchasingGroup: purchasingGroup,
                    vendor: vendor,
                    docType: docType ?? "All",
                    ct: ct
                );

                return OkResponse("PO trend data retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch PO trend data");
            }
        }

        [HttpGet("status-distribution")]
        public async Task<IActionResult> StatusDistribution(
            [FromQuery(Name = "start_date")] string? startDateStr,
            [FromQuery(Name = "end_date")] string? endDateStr,
            [FromQuery] string? plant,
            [FromQuery(Name = "purchasing_group")] string? purchasingGroup,
            [FromQuery] string? vendor,
            [FromQuery(Name = "doc_type")] string? docType = "All",
            CancellationToken ct = default)
        {
            if (!TryParseDate(startDateStr, out var startDate, out var err))
                return BadRequestResponse(err!);

            if (!TryParseDate(endDateStr, out var endDate, out err))
                return BadRequestResponse(err!);

            if (startDate.HasValue && endDate.HasValue && startDate.Value.Date > endDate.Value.Date)
                return BadRequestResponse("start_date cannot be after end_date");

            try
            {
                var data = await _po.GetPoStatusDistributionAsync(
                    startDate: startDate,
                    endDate: endDate,
                    plant: plant,
                    purchasingGroup: purchasingGroup,
                    vendor: vendor,
                    docType: docType ?? "All",
                    ct: ct
                );

                return OkResponse("PO status distribution retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch PO status distribution");
            }
        }

        [HttpGet("monthly-completion-delay")]
        public async Task<IActionResult> MonthlyCompletionDelay(
            [FromQuery(Name = "start_date")] string? startDateStr,
            [FromQuery(Name = "end_date")] string? endDateStr,
            [FromQuery] string? plant,
            [FromQuery] string? group,
            [FromQuery] string? vendor,
            [FromQuery(Name = "doc_type")] string? docType = "All",
            CancellationToken ct = default)
        {
            if (!TryParseDate(startDateStr, out var startDate, out var err))
                return BadRequestResponse(err!);

            if (!TryParseDate(endDateStr, out var endDate, out err))
                return BadRequestResponse(err!);

            if (startDate.HasValue && endDate.HasValue && startDate.Value.Date > endDate.Value.Date)
                return BadRequestResponse("start_date cannot be after end_date");

            try
            {
                var data = await _po.GetPoMonthlyCompletionDelayAsync(
                    startDate: startDate,
                    endDate: endDate,
                    plant: plant,
                    group: group,
                    vendor: vendor,
                    docType: docType ?? "All",
                    ct: ct
                );

                return OkResponse("Monthly completion delay data retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch monthly completion delay data");
            }
        }

        [HttpGet("master-filters")]
        public async Task<IActionResult> MasterFilters(CancellationToken ct = default)
        {
            try
            {
                var data = await _po.GetPoDashboardMasterfiltersAsync(ct);
                return OkResponse("Dashboard master filters retrieved", data);
            }
            catch
            {
                return ServerErrorResponse("Failed to fetch dashboard master filters");
            }
        }

        // =========================
        // Response helpers: responseCode ikut HTTP status
        // =========================
        private IActionResult OkResponse(string message, object? data)
            => Ok(ApiResponse.Ok(message, data, 200));

        private IActionResult BadRequestResponse(string message, object? data = null)
            => BadRequest(ApiResponse.Fail(message, 400, data));

        private IActionResult ServerErrorResponse(string message, object? data = null)
            => StatusCode(500, ApiResponse.Fail(message, 500, data));

        // =========================
        // Date parsing helper
        // =========================
        private static bool TryParseDate(string? input, out DateTime? date, out string? error)
        {
            date = null;
            error = null;

            input = (input ?? "").Trim();
            if (string.IsNullOrEmpty(input))
                return true;

            if (DateTime.TryParseExact(input, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            {
                date = dt.Date;
                return true;
            }

            error = $"Invalid date format. Use YYYY-MM-DD. value='{input}'";
            return false;
        }
    }
}
