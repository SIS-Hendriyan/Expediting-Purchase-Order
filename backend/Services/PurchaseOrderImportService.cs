using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using Microsoft.AspNetCore.Http;

using EXPOAPI.Services;
using ClosedXML.Excel; // IDbConnectionFactory

namespace EXPOAPI.Services;

public interface IPurchaseOrderImportService
{
    Task<Dictionary<string, int>> ImportPurchaseOrderTransactionsAsync(IFormFile upload, CancellationToken ct = default);
}

public class PurchaseOrderImportService : IPurchaseOrderImportService
{
    private const string SP_PURCHASE_ORDER_TRANSACTION_LOAD = "[exp].[PURCHASE_ORDER_TRANSACTION_LOAD_SP]";

    private readonly IDbConnectionFactory _db;

    public PurchaseOrderImportService(IDbConnectionFactory db)
    {
        _db = db;
    }

    // =========================
    // Specs (mirror Python)
    // =========================
    private sealed record SheetSpec(string[] Columns, string[] DateColumns, string[] NumericColumns);

    private static readonly SheetSpec ME2N_SPEC = new(
        Columns: new[]
        {
            "Purchase Requisition",
            "Item of requisition",
            "Purchasing Document",
            "Item",
            "Document Date",
            "Delivery date",
            "Purchasing Doc. Type",
            "Purchasing Group",
            "Short Text",
            "Material",
            "Name of Supplier",
            "Quantity Received",
            "Still to be delivered (qty)",
            "Plant",
            "Storage location",
        },
        DateColumns: new[] { "Document Date", "Delivery date" },
        NumericColumns: new[] { "Quantity Received", "Still to be delivered (qty)" }
    );

    private static readonly SheetSpec ME5A_SPEC = new(
        Columns: new[]
        {
            "Order",
            "Changed On",
            "Purchase order",
            "Purchase Requisition",
            "Item of requisition",
            "Material",
            "Purchase Order Date",
            "Created by",
        },
        DateColumns: new[] { "Changed On", "Purchase Order Date" },
        NumericColumns: Array.Empty<string>()
    );

    private static readonly SheetSpec ZMM013R_SPEC = new(
        Columns: new[]
        {
            "Purchase Order",
            "Purchase Requisition",
            "Purchase Order Item",
            "GR Created Date",
        },
        DateColumns: new[] { "GR Created Date" },
        NumericColumns: Array.Empty<string>()
    );

    private static readonly Dictionary<string, SheetSpec> SHEET_SPECS = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ME2N"] = ME2N_SPEC,
        ["ME5A"] = ME5A_SPEC,
        ["ZMM013R"] = ZMM013R_SPEC
    };

    // UDT names (SQL Server)
    private const string UDT_ME2N = "exp.UDT_ME2N";
    private const string UDT_ME5A = "exp.UDT_ME5A";
    private const string UDT_ZMM = "exp.UDT_ZMM013R";

    // =========================
    // Entry point
    // =========================
    public async Task<Dictionary<string, int>> ImportPurchaseOrderTransactionsAsync(IFormFile upload, CancellationToken ct = default)
    {
        if (upload == null || string.IsNullOrWhiteSpace(upload.FileName))
            throw new ArgumentException("file is required");

        if (!upload.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("file must be an .xlsx Excel file");

        if (upload.Length <= 0)
            throw new ArgumentException("file is empty");

        using var ms = new MemoryStream();
        await upload.CopyToAsync(ms, ct);
        if (ms.Length == 0) throw new ArgumentException("file is empty");
        ms.Position = 0;

        using var wb = new XLWorkbook(ms);

        // Ensure sheets exist
        foreach (var sheetName in SHEET_SPECS.Keys)
        {
            if (!wb.Worksheets.Any(s => s.Name.Equals(sheetName, StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("excel file must contain sheets: ME2N, ME5A, ZMM013R");
        }

        // Prepare DataTables (TVP)
        var me2nTable = PrepareSheetAsDataTable(wb, "ME2N", ME2N_SPEC);
        var me5aTable = PrepareSheetAsDataTable(wb, "ME5A", ME5A_SPEC);
        var zmmTable = PrepareSheetAsDataTable(wb, "ZMM013R", ZMM013R_SPEC);

        // Execute import SP via TVP
        await ExecuteImportAsync(me2nTable, me5aTable, zmmTable, ct);

        return new Dictionary<string, int>
        {
            ["ME2N"] = me2nTable.Rows.Count,
            ["ME5A"] = me5aTable.Rows.Count,
            ["ZMM013R"] = zmmTable.Rows.Count
        };
    }

    // =========================
    // Read & validate sheet -> DataTable
    // =========================
    private static DataTable PrepareSheetAsDataTable(XLWorkbook wb, string sheetName, SheetSpec spec)
    {
        var ws = wb.Worksheet(sheetName);

        // Find header row (assume row 1)
        var headerRow = ws.Row(1);
        var lastCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
        if (lastCol <= 0) return CreateEmptyTable(spec);

        // map actual headers (case-insensitive)
        var normalized = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int c = 1; c <= lastCol; c++)
        {
            var header = headerRow.Cell(c).GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(header))
                normalized[header] = c;
        }

        // resolve required columns
        var resolvedCols = new List<int>();
        var missing = new List<string>();

        foreach (var canonical in spec.Columns)
        {
            if (normalized.TryGetValue(canonical, out var colIndex))
                resolvedCols.Add(colIndex);
            else
                missing.Add(canonical);
        }

        if (missing.Count > 0)
            throw new ArgumentException($"sheet '{sheetName}' is missing column(s): {string.Join(", ", missing)}");

        var dt = CreateEmptyTable(spec);

        // data rows start at row 2
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        if (lastRow < 2) return dt;

        var dateCols = new HashSet<string>(spec.DateColumns, StringComparer.OrdinalIgnoreCase);
        var numCols = new HashSet<string>(spec.NumericColumns, StringComparer.OrdinalIgnoreCase);

        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);

            // Build record following spec.Columns order
            var values = new object?[spec.Columns.Length];
            var allNull = true;

            for (int i = 0; i < spec.Columns.Length; i++)
            {
                var columnName = spec.Columns[i];
                var colIndex = resolvedCols[i];
                var cell = row.Cell(colIndex);

                object? raw = GetCellRawValue(cell);
                var cleaned = CleanValue(columnName, raw, dateCols, numCols);
                values[i] = cleaned;

                if (cleaned != null) allNull = false;
            }

            // dropna(how="all") like pandas
            if (allNull) continue;

            dt.Rows.Add(values);
        }

        return dt;
    }

    private static DataTable CreateEmptyTable(SheetSpec spec)
    {
        var dt = new DataTable();

        // Column names MUST match SQL UDT column names.
        // Here we assume UDT column names are exactly like Excel headers (same as Python).
        foreach (var col in spec.Columns)
        {
            dt.Columns.Add(col, typeof(object));
        }

        return dt;
    }

    private static object? GetCellRawValue(IXLCell cell)
    {
        if (cell == null) return null;
        if (cell.IsEmpty()) return null;

        // ClosedXML already knows types
        return cell.Value switch
        {
            _ => cell.Value
        };
    }

    // =========================
    // Clean value (mirror Python _clean_value)
    // =========================
    private static object? CleanValue(
        string column,
        object? value,
        HashSet<string> dateColumns,
        HashSet<string> numericColumns
    )
    {
        if (value == null) return null;

        // Date columns
        if (dateColumns.Contains(column))
        {
            // ClosedXML may give DateTime, or string/number
            if (value is DateTime dt) return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);

            // Excel numeric date
            if (value is double d)
            {
                // try OADate
                try
                {
                    var od = DateTime.FromOADate(d);
                    return DateTime.SpecifyKind(od, DateTimeKind.Unspecified);
                }
                catch { return null; }
            }

            // parse string
            var s = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ||
                DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out parsed))
            {
                return DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
            }

            return null;
        }

        // Numeric columns -> decimal
        if (numericColumns.Contains(column))
        {
            if (value is decimal dec) return dec;

            if (value is double dd)
            {
                if (double.IsNaN(dd) || double.IsInfinity(dd)) return null;
                return decimal.Parse(dd.ToString(CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);
            }

            if (value is int i) return (decimal)i;
            if (value is long l) return (decimal)l;

            var s = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (!decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var outDec) &&
                !decimal.TryParse(s, NumberStyles.Any, CultureInfo.CurrentCulture, out outDec))
            {
                throw new ArgumentException($"invalid numeric value for column '{column}': {s}");
            }

            return outDec;
        }

        // Other columns:
        if (value is DateTime dt2) return DateTime.SpecifyKind(dt2, DateTimeKind.Unspecified);

        if (value is double f)
        {
            if (double.IsNaN(f) || double.IsInfinity(f)) return null;
            if (Math.Abs(f % 1) < 0.0000001) return (long)f; // integer-like
        }

        var text = value.ToString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    // =========================
    // Execute import SP using TVP
    // =========================
    private async Task ExecuteImportAsync(DataTable me2n, DataTable me5a, DataTable zmm, CancellationToken ct)
    {
        using var cn = _db.CreateMain();

        var p = new DynamicParameters();

        // Dapper TVP:
        // NOTE: requires Microsoft.Data.SqlClient
        p.Add("@ME2N", me2n.AsTableValuedParameter(UDT_ME2N));
        p.Add("@ME5A", me5a.AsTableValuedParameter(UDT_ME5A));
        p.Add("@ZMM013R", zmm.AsTableValuedParameter(UDT_ZMM));

        await cn.ExecuteAsync(
            new CommandDefinition(
                SP_PURCHASE_ORDER_TRANSACTION_LOAD,
                p,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            )
        );
    }
}
