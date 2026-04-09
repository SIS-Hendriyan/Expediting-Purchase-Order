using ClosedXML.Excel;
using Dapper;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services;

public interface IPurchaseOrderImportService
{
    Task<Dictionary<string, int>> ImportPurchaseOrderTransactionsAsync(
        IFormFile me2nFile,
        IFormFile me5aFile,
        IFormFile zmm013rFile,
        CancellationToken ct = default);
}

public class PurchaseOrderImportService : IPurchaseOrderImportService
{
    private const string SP_PURCHASE_ORDER_TRANSACTION_LOAD = "[exp].[PURCHASE_ORDER_TRANSACTION_LOAD_SP]";

    private readonly IDbConnectionFactory _db;

    public PurchaseOrderImportService(IDbConnectionFactory db)
    {
        _db = db;
    }

    /// <param name="Columns">Nama kolom sesuai UDT SQL (dipakai sebagai nama kolom DataTable).</param>
    /// <param name="DateColumns">Subset Columns yang bertipe DateTime.</param>
    /// <param name="NumericColumns">Subset Columns yang bertipe decimal/float.</param>
    /// <param name="SourceAliases">
    ///   Pemetaan: UDT column name → nama kolom di file CSV/Excel.
    ///   Diisi jika nama header di file berbeda dengan nama kolom UDT.
    /// </param>
    /// <param name="OptionalColumns">
    ///   Kolom UDT yang boleh tidak ada di file (diisi NULL jika tidak ditemukan).
    /// </param>
    private sealed record SheetSpec(
        string[] Columns,
        string[] DateColumns,
        string[] NumericColumns,
        Dictionary<string, string>? SourceAliases = null,
        string[]? OptionalColumns = null);

   
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
            "Qty Order",
            "Quantity Received",
            "Still to be delivered (qty)",
            "Plant",
            "Storage location",
    },
    DateColumns: new[] { "Document Date", "Delivery date" },
    NumericColumns: new[] { "Qty Order", "Quantity Received", "Still to be delivered (qty)" }, // ← tambah "Qty Order"
    SourceAliases: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["Name of Supplier"] = "Supplier/Supplying Plant",
        ["Qty Order"] = "Order Quantity",
        ["Delivery date"] = "Delivery Date",
        ["Still to be delivered (qty)"] = "Still to be delivered (value)",
    },
    OptionalColumns: new[] { "Quantity Received", "Storage location" }
);


    // ─────────────────────────────────────────────────────────────────────────
    // ME5A — semua nama kolom cocok dengan CSV (case-insensitive match cukup)
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // ZMM013R — semua nama kolom cocok dengan CSV
    // ─────────────────────────────────────────────────────────────────────────
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

    private const string UDT_ME2N = "exp.UDT_ME2N";
    private const string UDT_ME5A = "exp.UDT_ME5A";
    private const string UDT_ZMM = "exp.UDT_ZMM013R";

    // =========================================================================

    public async Task<Dictionary<string, int>> ImportPurchaseOrderTransactionsAsync(
        IFormFile me2nFile,
        IFormFile me5aFile,
        IFormFile zmm013rFile,
        CancellationToken ct = default)
    {
        ValidateExcelFile(me2nFile, "ME2N");
        ValidateExcelFile(me5aFile, "ME5A");
        ValidateExcelFile(zmm013rFile, "ZMM013R");

        var me2nTable = await PrepareSingleFileAsDataTableAsync(me2nFile, "ME2N", ME2N_SPEC, ct);
        var me5aTable = await PrepareSingleFileAsDataTableAsync(me5aFile, "ME5A", ME5A_SPEC, ct);
        var zmmTable = await PrepareSingleFileAsDataTableAsync(zmm013rFile, "ZMM013R", ZMM013R_SPEC, ct);

        await ExecuteImportAsync(me2nTable, me5aTable, zmmTable, ct);

        return new Dictionary<string, int>
        {
            ["ME2N"] = me2nTable.Rows.Count,
            ["ME5A"] = me5aTable.Rows.Count,
            ["ZMM013R"] = zmmTable.Rows.Count,
        };
    }

    // =========================================================================

    private static void ValidateExcelFile(IFormFile? file, string label)
    {
        if (file == null || string.IsNullOrWhiteSpace(file.FileName))
            throw new ArgumentException($"{label} file is required");

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException($"{label} file must be an .xlsx Excel file");

        if (file.Length <= 0)
            throw new ArgumentException($"{label} file is empty");
    }

    private static async Task<DataTable> PrepareSingleFileAsDataTableAsync(
        IFormFile upload,
        string expectedSheetName,
        SheetSpec spec,
        CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await upload.CopyToAsync(ms, ct);

        if (ms.Length == 0)
            throw new ArgumentException($"{expectedSheetName} file is empty");

        ms.Position = 0;

        using var wb = new XLWorkbook(ms);

        if (!wb.Worksheets.Any())
            throw new ArgumentException($"{expectedSheetName} file does not contain any worksheet");

        var ws =
            wb.Worksheets.FirstOrDefault(x => x.Name.Equals(expectedSheetName, StringComparison.OrdinalIgnoreCase))
            ?? wb.Worksheet(1);

        return PrepareWorksheetAsDataTable(ws, expectedSheetName, spec);
    }

    private static DataTable PrepareWorksheetAsDataTable(IXLWorksheet ws, string sheetName, SheetSpec spec)
    {
        var headerRow = ws.Row(1);
        var lastCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
        if (lastCol <= 0) return CreateEmptyTable(spec);

        // Bangun map: header (case-insensitive) → nomor kolom
        var normalized = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int c = 1; c <= lastCol; c++)
        {
            var header = ws.Cell(1, c).GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(header))
                normalized[header] = c;
        }

        var optionalCols = new HashSet<string>(
            spec.OptionalColumns ?? Array.Empty<string>(),
            StringComparer.OrdinalIgnoreCase);

        var resolvedCols = new List<int>();   // -1 = kolom opsional tidak ditemukan
        var missing = new List<string>();

        foreach (var canonical in spec.Columns)
        {
            // Cek alias dulu, fallback ke nama canonical
            var lookupName = (spec.SourceAliases?.TryGetValue(canonical, out var alias) == true)
                ? alias!
                : canonical;

            if (normalized.TryGetValue(lookupName, out var colIndex))
            {
                resolvedCols.Add(colIndex);
            }
            else if (!string.Equals(lookupName, canonical, StringComparison.OrdinalIgnoreCase)
                     && normalized.TryGetValue(canonical, out colIndex))
            {
                // Alias tidak ditemukan, tapi canonical ada — pakai canonical
                resolvedCols.Add(colIndex);
            }
            else if (optionalCols.Contains(canonical))
            {
                resolvedCols.Add(-1);   // opsional → NULL
            }
            else
            {
                missing.Add(canonical);
            }
        }

        if (missing.Count > 0)
            throw new ArgumentException(
                $"sheet '{sheetName}' is missing column(s): {string.Join(", ", missing)}");

        var dt = CreateEmptyTable(spec);
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        if (lastRow < 2) return dt;

        var dateCols = new HashSet<string>(spec.DateColumns, StringComparer.OrdinalIgnoreCase);
        var numCols = new HashSet<string>(spec.NumericColumns, StringComparer.OrdinalIgnoreCase);

        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            var values = new object?[spec.Columns.Length];
            var allNull = true;

            for (int i = 0; i < spec.Columns.Length; i++)
            {
                var columnName = spec.Columns[i];
                var colIndex = resolvedCols[i];

                if (colIndex < 0)   // kolom opsional tidak ada di file
                {
                    values[i] = null;
                    continue;
                }

                var cell = row.Cell(colIndex);
                object? raw = GetCellRawValue(cell);
                var cleaned = CleanValue(columnName, raw, dateCols, numCols);
                values[i] = cleaned;

                if (cleaned != null) allNull = false;
            }

            if (allNull) continue;

            for (int i = 0; i < values.Length; i++)
                values[i] ??= DBNull.Value;

            dt.Rows.Add(values);
        }

        return dt;
    }

    private static DataTable CreateEmptyTable(SheetSpec spec)
    {
        var dt = new DataTable();
        var dateCols = new HashSet<string>(spec.DateColumns, StringComparer.OrdinalIgnoreCase);
        var numCols = new HashSet<string>(spec.NumericColumns, StringComparer.OrdinalIgnoreCase);

        foreach (var col in spec.Columns)
        {
            Type t =
                dateCols.Contains(col) ? typeof(DateTime) :
                numCols.Contains(col) ? typeof(decimal) :
                                          typeof(string);

            dt.Columns.Add(col, t);
        }

        return dt;
    }

    private static object? GetCellRawValue(IXLCell cell)
    {
        if (cell == null || cell.IsEmpty()) return null;

        return cell.DataType switch
        {
            XLDataType.DateTime => cell.GetDateTime(),
            XLDataType.Number => cell.GetDouble(),
            XLDataType.Boolean => cell.GetBoolean(),
            XLDataType.Text => cell.GetString(),
            _ => cell.GetString(),
        };
    }

    private static object? CleanValue(
        string column,
        object? value,
        HashSet<string> dateColumns,
        HashSet<string> numericColumns)
    {
        if (value == null) return null;

        if (dateColumns.Contains(column))
        {
            if (value is DateTime dt)
                return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);

            if (value is double d)
            {
                try { return DateTime.SpecifyKind(DateTime.FromOADate(d), DateTimeKind.Unspecified); }
                catch { return null; }
            }

            var s = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ||
                DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out parsed))
                return DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);

            return null;
        }

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
                throw new ArgumentException($"invalid numeric value for column '{column}': {s}");

            return outDec;
        }

        if (value is DateTime dt2) return DateTime.SpecifyKind(dt2, DateTimeKind.Unspecified);

        if (value is double f)
        {
            if (double.IsNaN(f) || double.IsInfinity(f)) return null;
            if (Math.Abs(f % 1) < 0.0000001) return (long)f;
        }

        var text = value.ToString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private async Task ExecuteImportAsync(
        DataTable me2n, DataTable me5a, DataTable zmm, CancellationToken ct)
    {
        try
        {
            using var cn = _db.CreateMain();

            var p = new DynamicParameters();
            p.Add("@ME2N", me2n.AsTableValuedParameter(UDT_ME2N));
            p.Add("@ME5A", me5a.AsTableValuedParameter(UDT_ME5A));
            p.Add("@ZMM013R", zmm.AsTableValuedParameter(UDT_ZMM));

            await cn.ExecuteAsync(new CommandDefinition(
                SP_PURCHASE_ORDER_TRANSACTION_LOAD,
                p,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct));
        }
        catch (SqlException ex)
        {
            var info = BuildInputInfo(me2n, me5a, zmm);
            throw new Exception(
                $"Import failed (SQL). SP={SP_PURCHASE_ORDER_TRANSACTION_LOAD}. " +
                $"UDTs=[{UDT_ME2N},{UDT_ME5A},{UDT_ZMM}]. {info}. " +
                $"SQL#{ex.Number} State={ex.State} Proc={ex.Procedure} Line={ex.LineNumber}. " +
                $"Message={ex.Message}", ex);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            var info = BuildInputInfo(me2n, me5a, zmm);
            throw new Exception(
                $"Import failed. SP={SP_PURCHASE_ORDER_TRANSACTION_LOAD}. {info}. Message={ex.Message}", ex);
        }
    }

    private static string BuildInputInfo(DataTable? me2n, DataTable? me5a, DataTable? zmm) =>
        $"ME2N rows={me2n?.Rows.Count ?? 0}, cols={me2n?.Columns.Count ?? 0}; " +
        $"ME5A rows={me5a?.Rows.Count ?? 0}, cols={me5a?.Columns.Count ?? 0}; " +
        $"ZMM  rows={zmm?.Rows.Count ?? 0}, cols={zmm?.Columns.Count ?? 0}";
}
