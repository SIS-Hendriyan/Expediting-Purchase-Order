import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card } from "../ui/card";
import {
  getAccessToken,
  redirectToLoginExpired,
} from "../../utils/authSession";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts";
import {
  Package,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Layers,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Award,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "../ui/pagination";
import { Alert, AlertDescription } from "../ui/alert";
import type { User } from "./Login";
import { API } from "../../config";

interface DashboardProps {
  user: User;
  onPageChange: (page: string) => void;
}

interface SummaryData {
  TotalPO: number;
  OutstandingQuantity: number;
  TotalCompletionRate: number;
  PercentageCompletionRate: number;
  TotalLateOrder: number;
  TotalNotArrivedOrder: number;
  TotalOverdueOrder: number;
  AverageDelay: number;
  TotalRescheduledOrder: number;
  RescheduleETARatio: number;
  TotalVendorResponse: number;
  VendorResponseRate: number;
}

interface PoTrendPoint {
  month: string;
  orders: number;
}

interface StatusDistributionItem {
  name: string;
  value: number;
  rawStatus: string;
  totalAll: number;
  color: string;
}

interface MonthlyTrendPoint {
  month: string;
  completionRate: number;
  avgDelay: number;
}

interface VendorScorecardItemUI {
  poNumber: string;
  itemOfRequisition: string;
  vendorCode: string;
  vendorName: string;
  otd: number;
  communication: number;
  reETAAccepted: number;
  reETARejected: number;
  excellencePoint: number;
  overallScore: number;
}

interface VendorScorecardAggregateUI {
  vendorCode: string;
  vendorName: string;
  otd: number;
  communication: number;
  reETAAccepted: number;
  reETARejected: number;
  excellencePoint: number;
  overallScore: number;
  itemsCount: number;
  items: VendorScorecardItemUI[];
}

interface VendorOption {
  name: string;
  raw: string;
}

const GROUP_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Logistics", value: "logistics" },
  { label: "Operations", value: "operations" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Procurement", value: "procurement" },
] as const;

const CHART_STATUS_LEGENDS = [
  { name: "PO Uploaded", color: "#ED832D" },
  { name: "Work in Progress", color: "#008383" },
  { name: "On Delivery", color: "#5C8CB6" },
  { name: "Received", color: "#6AA75D" },
] as const;

const mapDocTypeForApi = (docType: string): string | undefined => {
  if (!docType) return undefined;
  if (docType === "purchase-order") return "All";
  return docType;
};

const getAuthToken = (): string => {
  const local = localStorage.getItem("accessToken");
  const sessionToken = getAccessToken();
  return local || sessionToken || "";
};

const buildAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await fetch(input, init);

  if (res.status === 401) {
    redirectToLoginExpired();
    throw new Error("Session expired");
  }

  return res;
};

const getJsonData = async <T,>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const json = await res.json();
  return (json?.Data ?? json) as T;
};

const getStatusColor = (name: string): string => {
  switch (name) {
    case "PO Uploaded":
      return "#ED832D";
    case "Work in Progress":
      return "#008383";
    case "On Delivery":
      return "#5C8CB6";
    case "Received":
      return "#6AA75D";
    default:
      return "#9CA3AF";
  }
};

const normalizeStatusLabel = (name: string): string => {
  if (name === "Fully Received") return "Received";
  return name;
};

const shouldExcludeStatusFromChart = (name: string): boolean =>
  name === "Partially Received";

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date: Date | undefined) => {
  if (!date) return "Select date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
};

const downloadCsvFile = (filename: string, rows: (string | number)[][]) => {
  const csvContent = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const downloadXlsLikeTsvFile = (
  filename: string,
  rows: (string | number)[][],
) => {
  const sanitizeCell = (value: string | number) => {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
  };

  const content = rows
    .map((row) => row.map((cell) => sanitizeCell(cell)).join("\t"))
    .join("\n");

  const blob = new Blob([content], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const getFileDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
};

export function Dashboard({ user, onPageChange }: DashboardProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [plant, setPlant] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  const [plantOptions, setPlantOptions] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [poTrendData, setPoTrendData] = useState<PoTrendPoint[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<
    StatusDistributionItem[]
  >([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendPoint[]>([]);

  const [scorecardCurrentPage, setScorecardCurrentPage] = useState(1);
  const [scorecardItemsPerPage, setScorecardItemsPerPage] = useState(10);
  const [expandedVendors, setExpandedVendors] = useState<string[]>([]);
  const [scorecardSortOrder, setScorecardSortOrder] = useState<"asc" | "desc">(
    "desc",
  );

  const [vendorScorecardItems, setVendorScorecardItems] = useState<
    VendorScorecardItemUI[]
  >([]);
  const [vendorScorecardAggregates, setVendorScorecardAggregates] = useState<
    VendorScorecardAggregateUI[]
  >([]);
  const [vendorScorecardLoading, setVendorScorecardLoading] = useState(false);
  const [vendorScorecardError, setVendorScorecardError] = useState<
    string | null
  >(null);

  const totalPO = summary?.TotalPO ?? 0;
  const outstandingQty = summary?.OutstandingQuantity ?? 0;
  const totalCompletion = summary?.TotalCompletionRate ?? 0;
  const percentageCompletion = summary?.PercentageCompletionRate ?? 0;
  const totalLate = summary?.TotalLateOrder ?? 0;
  const totalNotArrived = summary?.TotalNotArrivedOrder ?? 0;
  const totalOverdue = summary?.TotalOverdueOrder ?? 0;
  const totalResched = summary?.TotalRescheduledOrder ?? 0;
  const reschedRatio = summary?.RescheduleETARatio ?? 0;
  const totalVendorResp = summary?.TotalVendorResponse ?? 0;
  const vendorRespRate = summary?.VendorResponseRate ?? 0;

  const selectedVendorOption = useMemo(
    () => vendorOptions.find((opt) => opt.raw === vendor),
    [vendorOptions, vendor],
  );

  const currentVendorAggregate = useMemo(() => {
    if (user.role !== "vendor" || !user.company) return undefined;

    return vendorScorecardAggregates.find(
      (v) => v.vendorName === user.company || v.vendorCode === user.company,
    );
  }, [user.role, user.company, vendorScorecardAggregates]);

  const currentVendorScore = currentVendorAggregate?.overallScore ?? 0;

  const vendorComposition = useMemo(() => {
    if (!currentVendorAggregate) return [];

    return [
      { category: "OTD", value: currentVendorAggregate.otd, color: "#008383" },
      {
        category: "Communication",
        value: currentVendorAggregate.communication,
        color: "#5C8CB6",
      },
      {
        category: "Re-ETA Accepted",
        value: currentVendorAggregate.reETAAccepted,
        color: "#6AA75D",
      },
      {
        category: "Re-ETA Rejected",
        value: currentVendorAggregate.reETARejected,
        color: "#D4183D",
      },
      {
        category: "Excellence Point",
        value: currentVendorAggregate.excellencePoint,
        color: "#ED832D",
      },
    ];
  }, [currentVendorAggregate]);

  const vendorScopedItems = useMemo(() => {
    if (user.role !== "vendor") return [];

    return vendorScorecardItems.filter((item) => {
      if (!user.company) return true;
      return (
        item.vendorName === user.company || item.vendorCode === user.company
      );
    });
  }, [user.role, user.company, vendorScorecardItems]);

  const sortedVendorScopedItems = useMemo(() => {
    return [...vendorScopedItems].sort((a, b) =>
      scorecardSortOrder === "desc"
        ? b.overallScore - a.overallScore
        : a.overallScore - b.overallScore,
    );
  }, [vendorScopedItems, scorecardSortOrder]);

  const sortedVendorAggregates = useMemo(() => {
    return [...vendorScorecardAggregates].sort((a, b) =>
      scorecardSortOrder === "desc"
        ? b.overallScore - a.overallScore
        : a.overallScore - b.overallScore,
    );
  }, [vendorScorecardAggregates, scorecardSortOrder]);

  const scorecardDataLength =
    user.role === "vendor"
      ? sortedVendorScopedItems.length
      : sortedVendorAggregates.length;

  const scorecardTotalPages = Math.max(
    1,
    Math.ceil(scorecardDataLength / scorecardItemsPerPage),
  );

  const scorecardDisplayRange = useMemo(() => {
    if (scorecardDataLength === 0) {
      return { start: 0, end: 0, total: 0 };
    }

    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = Math.min(
      startIndex + scorecardItemsPerPage,
      scorecardDataLength,
    );

    return {
      start: startIndex + 1,
      end: endIndex,
      total: scorecardDataLength,
    };
  }, [scorecardCurrentPage, scorecardItemsPerPage, scorecardDataLength]);

  const paginatedVendorItems = useMemo(() => {
    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = startIndex + scorecardItemsPerPage;
    return sortedVendorScopedItems.slice(startIndex, endIndex);
  }, [sortedVendorScopedItems, scorecardCurrentPage, scorecardItemsPerPage]);

  const paginatedVendorAggregates = useMemo(() => {
    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = startIndex + scorecardItemsPerPage;
    return sortedVendorAggregates.slice(startIndex, endIndex);
  }, [sortedVendorAggregates, scorecardCurrentPage, scorecardItemsPerPage]);

  const buildCommonParams = (
    useDefault: boolean,
    groupParamName: "group" | "purchasing_group",
  ) => {
    const params = new URLSearchParams();

    if (useDefault) return params;

    if (startDate) params.append("start_date", formatLocalDateParam(startDate));
    if (endDate) params.append("end_date", formatLocalDateParam(endDate));
    if (plant) params.append("plant", plant);
    if (group && group !== "All") params.append(groupParamName, group);

    if (user.role === "vendor" && user.company) {
      params.append("Vendor", user.company);
      params.append("Name", user.company);
      params.append("Company", user.company);
    } else if (vendor) {
      params.append("vendor", vendor);
    }

    const mappedDocType = mapDocTypeForApi(docType);
    if (mappedDocType) params.append("doc_type", mappedDocType);

    return params;
  };

  const fetchMasterFilters = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error("Missing authentication token for master filters");
        return;
      }

      const res = await fetchWithAuth(API.MASTER_FILTER_DASHBOARD(), {
        headers: buildAuthHeaders(),
      });

      const data = await getJsonData<{
        plants?: string[];
        suppliers?: Array<{ name: string; raw: string }>;
      }>(res);

      setPlantOptions(Array.isArray(data.plants) ? data.plants : []);
      setVendorOptions(
        Array.isArray(data.suppliers)
          ? data.suppliers.map((s) => ({
              name: s.name,
              raw: s.raw,
            }))
          : [],
      );
    } catch (err) {
      console.error("Failed to fetch master filters", err);
    }
  };

  const fetchSummary = async (useDefault = false) => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);

      const token = getAuthToken();
      if (!token) {
        setSummaryError("Missing authentication token");
        return;
      }

      const params = buildCommonParams(useDefault, "group");

      if (user.role === "vendor" && user.company) {
        params.set("Vendor", user.company);
        params.set("Name", user.company);
        params.set("Company", user.company);
      }

      const url = `${API.SUMMARYDASHBOARD()}?${params.toString()}`;
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<SummaryData>(res);

      setSummary(data);
    } catch (err: any) {
      console.error("Failed to fetch PO dashboard summary", err);
      if (err?.message !== "Session expired") {
        setSummaryError(err?.message || "Failed to fetch PO dashboard summary");
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchPoTrend = async (useDefault = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error("Missing authentication token for PO trend");
        return;
      }

      const params = buildCommonParams(useDefault, "purchasing_group");
      const url = `${API.DASHBOARD_PO_TREND()}?${params.toString()}`;
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<PoTrendPoint[]>(res);

      setPoTrendData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch PO trend", err);
    }
  };

  const fetchStatusDistribution = async (useDefault = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error("Missing authentication token for status distribution");
        return;
      }

      const params = buildCommonParams(useDefault, "purchasing_group");
      const url = `${API.DASHBOARD_STATUS_DISTRIBUTION()}?${params.toString()}`;
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<any[]>(res);

      const mapped: StatusDistributionItem[] = (Array.isArray(data) ? data : [])
        .filter((d) => !shouldExcludeStatusFromChart(d.name))
        .map((d) => {
          const displayName = normalizeStatusLabel(d.name);
          return {
            name: displayName,
            value: Number(d.value ?? 0),
            rawStatus: d.rawStatus ?? "",
            totalAll: Number(d.totalAll ?? 0),
            color: getStatusColor(displayName),
          };
        });

      setStatusDistribution(mapped);
    } catch (err) {
      console.error("Failed to fetch status distribution", err);
    }
  };

  const fetchMonthlyCompletionDelay = async (useDefault = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error(
          "Missing authentication token for monthly completion delay",
        );
        return;
      }

      const params = buildCommonParams(useDefault, "group");
      const url = `${API.DASHBOARD_MONTHLY_COMPLETION_DELAY()}?${params.toString()}`;
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<MonthlyTrendPoint[]>(res);

      setMonthlyTrends(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch monthly completion delay", err);
    }
  };

  const fetchVendorScorecard = async (useDefault = false) => {
    try {
      setVendorScorecardLoading(true);
      setVendorScorecardError(null);

      const token = getAuthToken();
      if (!token) {
        setVendorScorecardError(
          "Missing authentication token for vendor scorecard",
        );
        return;
      }

      const params = new URLSearchParams();

      if (!useDefault) {
        if (startDate)
          params.append("start_date", formatLocalDateParam(startDate));
        if (endDate) params.append("end_date", formatLocalDateParam(endDate));
        if (plant) params.append("plant", plant);
        if (group && group !== "All") params.append("group", group);

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append("doc_type", mappedDocType);

        let vendorFilter: string | undefined;

        if (user.role === "vendor" && user.company) {
          vendorFilter = user.company;
          params.append("Name", user.company);
          params.append("Company", user.company);
        } else if (vendor) {
          vendorFilter = vendor;
        }

        if (vendorFilter) {
          params.append("vendor", vendorFilter);
        }
      }

      const url = `${API.DASHBOARD_VENDOR_SCORECARD()}?${params.toString()}`;
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<{
        items?: any[];
        vendor_aggregates?: any[];
      }>(res);

      const items = Array.isArray(data.items) ? data.items : [];
      const aggregates = Array.isArray(data.vendor_aggregates)
        ? data.vendor_aggregates
        : [];

      const uiItems: VendorScorecardItemUI[] = items.map((i) => ({
        poNumber: i.PONumber,
        itemOfRequisition: i.ItemOfRequisition,
        vendorCode: i.VendorCode,
        vendorName: i.VendorName,
        otd: Number(i.OTD ?? 0),
        communication: Number(i.Communication ?? 0),
        reETAAccepted: Number(i.ReETAAccepted ?? 0),
        reETARejected: Number(i.ReETARejected ?? 0),
        excellencePoint: Number(i.ExcellencePoint ?? 0),
        overallScore: Number(i.OverallScore ?? 0),
      }));

      const aggregatesMap: Record<string, VendorScorecardAggregateUI> = {};

      for (const agg of aggregates) {
        const key = `${agg.VendorCode}|${agg.VendorName}`;
        aggregatesMap[key] = {
          vendorCode: agg.VendorCode,
          vendorName: agg.VendorName,
          otd: Number(agg.OTD ?? 0),
          communication: Number(agg.Communication ?? 0),
          reETAAccepted: Number(agg.ReETAAccepted ?? 0),
          reETARejected: Number(agg.ReETARejected ?? 0),
          excellencePoint: Number(agg.ExcellencePoint ?? 0),
          overallScore: Number(agg.OverallScore ?? 0),
          itemsCount: Number(agg.ItemsCount ?? 0),
          items: [],
        };
      }

      for (const item of uiItems) {
        const key = `${item.vendorCode}|${item.vendorName}`;

        if (!aggregatesMap[key]) {
          aggregatesMap[key] = {
            vendorCode: item.vendorCode,
            vendorName: item.vendorName,
            otd: item.otd,
            communication: item.communication,
            reETAAccepted: item.reETAAccepted,
            reETARejected: item.reETARejected,
            excellencePoint: item.excellencePoint,
            overallScore: item.overallScore,
            itemsCount: 0,
            items: [],
          };
        }

        aggregatesMap[key].items.push(item);
        aggregatesMap[key].itemsCount = aggregatesMap[key].items.length;
      }

      setVendorScorecardItems(uiItems);
      setVendorScorecardAggregates(Object.values(aggregatesMap));
    } catch (err: any) {
      console.error("Failed to fetch vendor scorecard", err);
      if (err?.message !== "Session expired") {
        setVendorScorecardError(
          err?.message || "Failed to fetch vendor scorecard",
        );
      }
    } finally {
      setVendorScorecardLoading(false);
    }
  };

  const reloadAllData = (useDefault = false) => {
    void fetchSummary(useDefault);
    void fetchPoTrend(useDefault);
    void fetchStatusDistribution(useDefault);
    void fetchMonthlyCompletionDelay(useDefault);
    void fetchVendorScorecard(useDefault);
  };

  const handleApplyFilters = () => {
    setScorecardCurrentPage(1);
    reloadAllData(false);
  };

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPlant("");
    setGroup("");
    setVendor("");
    setDocType("");
    setExpandedVendors([]);
    setScorecardCurrentPage(1);
    reloadAllData(true);
  };

  const toggleVendor = (vendorRaw: string) => {
    setVendor((prev) => (prev === vendorRaw ? "" : vendorRaw));
  };

  const toggleVendorExpansion = (vendorName: string) => {
    setExpandedVendors((prev) =>
      prev.includes(vendorName)
        ? prev.filter((v) => v !== vendorName)
        : [...prev, vendorName],
    );
  };

  const toggleScorecardSort = () => {
    setScorecardSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    setScorecardCurrentPage(1);
  };

  const handleExportVendorScorecard = () => {
    const fileDate = getFileDate();

    if (user.role === "vendor") {
      const rows: (string | number)[][] = [
        [
          "Purchase Order",
          "Item of Requisition",
          "Vendor Code",
          "Vendor Name",
          "OTD (%)",
          "Communication (%)",
          "Re-ETA Accepted (%)",
          "Re-ETA Rejected (%)",
          "Excellence Point (%)",
          "Overall Score (%)",
        ],
        ...sortedVendorScopedItems.map((record) => [
          record.poNumber,
          record.itemOfRequisition,
          record.vendorCode,
          record.vendorName,
          record.otd,
          record.communication,
          record.reETAAccepted,
          record.reETARejected,
          record.excellencePoint,
          record.overallScore,
        ]),
      ];

      downloadXlsLikeTsvFile(`vendor-scorecard-${fileDate}.xls`, rows);
      return;
    }

    const rows: (string | number)[][] = [
      [
        "Vendor Code",
        "Vendor Name",
        "OTD (%)",
        "Communication (%)",
        "Re-ETA Accepted (%)",
        "Re-ETA Rejected (%)",
        "Excellence Point (%)",
        "Overall Score (%)",
        "Items Count",
        "Row Type",
        "PO Number",
        "Item of Requisition",
      ],
    ];

    sortedVendorAggregates.forEach((vendorData) => {
      rows.push([
        vendorData.vendorCode,
        vendorData.vendorName,
        vendorData.otd,
        vendorData.communication,
        vendorData.reETAAccepted,
        vendorData.reETARejected,
        vendorData.excellencePoint,
        vendorData.overallScore,
        vendorData.itemsCount,
        "SUMMARY",
        "",
        "",
      ]);

      vendorData.items.forEach((item) => {
        rows.push([
          item.vendorCode,
          item.vendorName,
          item.otd,
          item.communication,
          item.reETAAccepted,
          item.reETARejected,
          item.excellencePoint,
          item.overallScore,
          "",
          "DETAIL",
          item.poNumber,
          item.itemOfRequisition,
        ]);
      });
    });

    downloadCsvFile(`vendor-scorecard-${fileDate}.csv`, rows);
  };

  const renderPercentageLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    percent: number;
  }) => {
    const RADIAN = Math.PI / 180;
    const percentage = (percent * 100).toFixed(1);
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        style={{ fontSize: "14px", fontWeight: "bold" }}
      >
        {`${percentage}%`}
      </text>
    );
  };

  useEffect(() => {
    void fetchMasterFilters();
    reloadAllData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scorecardCurrentPage > scorecardTotalPages) {
      setScorecardCurrentPage(scorecardTotalPages);
    }
  }, [scorecardCurrentPage, scorecardTotalPages]);

  const renderMetricCard = ({
    icon,
    iconBg,
    iconColor,
    title,
    value,
    subtitle,
    valueClassName = "",
    cardClassName = "",
    action,
  }: {
    icon: React.ReactNode;
    iconBg: string;
    iconColor?: string;
    title: string;
    value: string | number;
    subtitle: string;
    valueClassName?: string;
    cardClassName?: string;
    action?: React.ReactNode;
  }) => (
    <Card className={`p-6 ${cardClassName}`}>
      <div className="flex items-start justify-between mb-2">
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <div className="text-gray-600 text-sm mb-0.5">{title}</div>
      <div
        className={`text-3xl ${valueClassName}`}
        style={!valueClassName ? { color: iconColor } : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500">{subtitle}</div>
        {action}
      </div>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2" style={{ color: "#014357" }}>
          Analytical Dashboard
        </h1>
        <p className="text-gray-600">Overview of key metrics and insights</p>
      </div>

      {summaryError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{summaryError}</AlertDescription>
        </Alert>
      )}

      {vendorScorecardError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{vendorScorecardError}</AlertDescription>
        </Alert>
      )}

      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <div
          className="rounded-lg mb-6"
          style={{
            background:
              "linear-gradient(135deg, #014357 0%, #026a80 50%, #ED832D 100%)",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 sm:p-6 flex items-center justify-between text-white hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                <h3 className="mb-0">Filters</h3>
              </div>
              {isFiltersOpen ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm text-white">
                    Start Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="start-date"
                        variant="outline"
                        className="w-full justify-start text-left bg-white hover:bg-gray-50"
                        style={{
                          borderColor: "rgba(255, 255, 255, 0.3)",
                          color: startDate ? "#014357" : "#9ca3af",
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDate(startDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-sm text-white">
                    End Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date"
                        variant="outline"
                        className="w-full justify-start text-left bg-white hover:bg-gray-50"
                        style={{
                          borderColor: "rgba(255, 255, 255, 0.3)",
                          color: endDate ? "#014357" : "#9ca3af",
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDate(endDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plant" className="text-sm text-white">
                    {user.role === "vendor" ? "Jobsite" : "Plant"}
                  </Label>
                  <Select value={plant} onValueChange={setPlant}>
                    <SelectTrigger
                      id="plant"
                      className="w-full bg-white hover:bg-gray-50"
                      style={{ borderColor: "rgba(255, 255, 255, 0.3)" }}
                    >
                      <SelectValue
                        placeholder={
                          user.role === "vendor"
                            ? "Select jobsite"
                            : "Select plant"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {plantOptions.length === 0 ? (
                        <SelectItem value="__empty_plant" disabled>
                          No plant available
                        </SelectItem>
                      ) : (
                        plantOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {user.role !== "vendor" && (
                  <div className="space-y-2">
                    <Label htmlFor="group" className="text-sm text-white">
                      Group
                    </Label>
                    <Select value={group} onValueChange={setGroup}>
                      <SelectTrigger
                        id="group"
                        className="w-full bg-white hover:bg-gray-50"
                        style={{ borderColor: "rgba(255, 255, 255, 0.3)" }}
                      >
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUP_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {user.role !== "vendor" && (
                  <div className="space-y-2">
                    <Label htmlFor="vendor" className="text-sm text-white">
                      Vendor
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="vendor"
                          variant="outline"
                          className="w-full justify-between bg-white hover:bg-gray-50"
                          style={{ borderColor: "rgba(255, 255, 255, 0.3)" }}
                        >
                          <span className="text-sm">
                            {selectedVendorOption
                              ? selectedVendorOption.name
                              : "Select vendor"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                          {vendorOptions.length === 0 ? (
                            <div className="text-sm text-gray-500 px-2 py-2">
                              No vendors available
                            </div>
                          ) : (
                            vendorOptions.map((opt) => {
                              const isSelected = vendor === opt.raw;
                              return (
                                <button
                                  key={opt.raw}
                                  type="button"
                                  onClick={() => toggleVendor(opt.raw)}
                                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                    isSelected
                                      ? "bg-sky-100 text-sky-800"
                                      : "hover:bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {opt.name}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {user.role === "admin" && (
                  <div className="space-y-2">
                    <Label htmlFor="doc-type" className="text-sm text-white">
                      Doc Type
                    </Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger
                        id="doc-type"
                        className="w-full bg-white hover:bg-gray-50"
                        style={{ borderColor: "rgba(255, 255, 255, 0.3)" }}
                      >
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase-order">
                          Purchase Order
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  className="px-6"
                  style={{
                    backgroundColor: "white",
                    color: "#014357",
                    fontWeight: 600,
                  }}
                  onClick={handleApplyFilters}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? "Loading..." : "Apply Filters"}
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  style={{
                    borderColor: "white",
                    backgroundColor: "transparent",
                    color: "white",
                  }}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {user.role === "vendor" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <Card className="p-6 sm:col-span-2 lg:col-span-2">
              <div className="flex items-start justify-between mb-2">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "rgba(0, 131, 131, 0.1)" }}
                >
                  <CheckCircle
                    className="h-6 w-6"
                    style={{ color: "#008383" }}
                  />
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="text-gray-600 text-sm mb-[25px]">
                    Vendor Average Score
                  </div>
                  <div className="text-3xl my-1" style={{ color: "#008383" }}>
                    {currentVendorScore.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-[25px]">
                    Overall performance rating
                  </div>
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <div className="space-y-2.5">
                    {vendorComposition.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs text-gray-600 truncate">
                            {item.category}
                          </span>
                        </div>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: item.color }}
                        >
                          {item.value}%
                        </span>
                      </div>
                    ))}
                    {vendorComposition.length === 0 && (
                      <div className="text-xs text-gray-400">
                        No scorecard data yet for this vendor.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {renderMetricCard({
              icon: (
                <Package className="h-6 w-6" style={{ color: "#014357" }} />
              ),
              iconBg: "rgba(1, 67, 87, 0.1)",
              iconColor: "#014357",
              title: "Total Purchase Order Items",
              value: totalPO,
              subtitle: "+18 from last month",
              cardClassName: "lg:col-span-1",
            })}

            {renderMetricCard({
              icon: (
                <CheckCircle className="h-6 w-6" style={{ color: "#6AA75D" }} />
              ),
              iconBg: "rgba(106, 167, 93, 0.1)",
              iconColor: "#6AA75D",
              title: "Completion Rate",
              value: `${percentageCompletion}%`,
              subtitle:
                totalPO > 0
                  ? `${totalCompletion} of ${totalPO} orders completed`
                  : "No completed orders",
              cardClassName: "lg:col-span-1",
            })}

            <Card className="p-6 lg:col-span-1 relative min-h-[220px] flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "rgba(212, 24, 61, 0.1)" }}
                >
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>

              <div className="text-gray-600 text-sm mb-0.5">Overdue Orders</div>
              <div className="text-3xl text-red-600">{totalOverdue}</div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">{`${totalLate} late + ${totalNotArrived} not arrived`}</div>
                <button
                  onClick={() => onPageChange("purchase-order?attraction=2")}
                  className="inline-flex !h-10 !w-10 items-center justify-center rounded-full p-1 bg-red-50 text-red-600 transition-colors hover:bg-red-100 shrink-0"
                  aria-label="View orders"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {renderMetricCard({
              icon: (
                <RefreshCw className="h-6 w-6" style={{ color: "#008383" }} />
              ),
              iconBg: "rgba(0, 131, 131, 0.1)",
              iconColor: "#008383",
              title: "Reschedule ETA Ratio",
              value: `${reschedRatio}%`,
              subtitle:
                totalPO > 0
                  ? `${totalResched} of ${totalPO} orders rescheduled`
                  : "No rescheduled orders",
            })}

            {renderMetricCard({
              icon: (
                <CheckCircle className="h-6 w-6" style={{ color: "#5C8CB6" }} />
              ),
              iconBg: "rgba(92, 140, 182, 0.1)",
              iconColor: "#5C8CB6",
              title: "Vendor Response Rate",
              value: `${vendorRespRate}%`,
              subtitle:
                totalPO > 0
                  ? `${totalVendorResp} of ${totalPO} orders responded`
                  : "No response data",
            })}

            {renderMetricCard({
              icon: <Layers className="h-6 w-6" style={{ color: "#014357" }} />,
              iconBg: "rgba(1, 67, 87, 0.1)",
              iconColor: "#014357",
              title: "Outstanding Quantity",
              value: outstandingQty.toLocaleString(),
              subtitle: "Units pending delivery",
            })}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
            {renderMetricCard({
              icon: (
                <Package className="h-6 w-6" style={{ color: "#014357" }} />
              ),
              iconBg: "rgba(1, 67, 87, 0.1)",
              iconColor: "#014357",
              title: "Total Purchase Order Items",
              value: totalPO,
              subtitle: "+18 from last month",
            })}

            {renderMetricCard({
              icon: (
                <CheckCircle className="h-6 w-6" style={{ color: "#6AA75D" }} />
              ),
              iconBg: "rgba(106, 167, 93, 0.1)",
              iconColor: "#6AA75D",
              title: "Completion Rate",
              value: `${percentageCompletion}%`,
              subtitle:
                totalPO > 0
                  ? `${totalCompletion} of ${totalPO} orders completed`
                  : "No completed orders",
            })}

            <Card className="p-6 lg:col-span-1 relative min-h-[220px] flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: "rgba(212, 24, 61, 0.1)" }}
                >
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>

              <div className="text-gray-600 text-sm mb-0.5">Overdue Orders</div>
              <div className="text-3xl text-red-600">{totalOverdue}</div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">{`${totalLate} late + ${totalNotArrived} not arrived`}</div>
                <button
                  onClick={() => onPageChange("purchase-order?attraction=2")}
                  className="inline-flex !h-10 !w-10 items-center justify-center rounded-full p-1 bg-red-50 text-red-600 transition-colors hover:bg-red-100 shrink-0"
                  aria-label="View orders"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {renderMetricCard({
              icon: (
                <RefreshCw className="h-6 w-6" style={{ color: "#008383" }} />
              ),
              iconBg: "rgba(0, 131, 131, 0.1)",
              iconColor: "#008383",
              title: "Reschedule ETA Ratio",
              value: `${reschedRatio}%`,
              subtitle:
                totalPO > 0
                  ? `${totalResched} of ${totalPO} orders rescheduled`
                  : "No rescheduled orders",
            })}

            {user.role === "admin" &&
              renderMetricCard({
                icon: (
                  <CheckCircle
                    className="h-6 w-6"
                    style={{ color: "#5C8CB6" }}
                  />
                ),
                iconBg: "rgba(92, 140, 182, 0.1)",
                iconColor: "#5C8CB6",
                title: "Vendor Response Rate",
                value: `${vendorRespRate}%`,
                subtitle:
                  totalPO > 0
                    ? `${totalVendorResp} of ${totalPO} orders responded`
                    : "No response data",
              })}

            {renderMetricCard({
              icon: <Layers className="h-6 w-6" style={{ color: "#014357" }} />,
              iconBg: "rgba(1, 67, 87, 0.1)",
              iconColor: "#014357",
              title: "Outstanding Quantity",
              value: outstandingQty.toLocaleString(),
              subtitle: "Units pending delivery",
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <Card className="p-4 sm:p-6">
          <h3 className="mb-0" style={{ color: "#014357", lineHeight: "1.2" }}>
            Purchase Order Trend
          </h3>
          <p className="text-sm text-gray-600 mb-4 sm:mb-6 mt-1">
            Monthly purchase order volume over time
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={poTrendData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#014357" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#014357" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                label={{
                  value: "Orders",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 12, fill: "#6b7280" },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#014357"
                strokeWidth={3}
                name="Total Orders"
                fill="url(#colorOrders)"
                dot={{ r: 5, fill: "#014357", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 7 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4"
                style={{ backgroundColor: "#014357" }}
              ></div>
              <span className="text-sm text-gray-700">Total Orders</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="mb-0" style={{ color: "#014357", lineHeight: "1.2" }}>
            PO Status Distribution
          </h3>
          <p className="text-sm text-gray-600 mb-4 sm:mb-6 mt-1">
            Current breakdown of purchase order statuses
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
                label={renderPercentageLabel}
                labelLine={{
                  stroke: "#9ca3af",
                  strokeWidth: 1,
                }}
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name: string, props: any) => [
                  value,
                  props?.payload?.name ?? "Status",
                ]}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
            {CHART_STATUS_LEGENDS.map((legend) => (
              <div key={legend.name} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: legend.color }}
                ></div>
                <span className="text-sm text-gray-700">{legend.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="mb-0" style={{ color: "#014357", lineHeight: "1.2" }}>
          Monthly Completion Trend
        </h3>
        <p className="text-sm text-gray-600 mb-4 sm:mb-6 mt-1">
          Monthly completion rate overview
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={monthlyTrends}
            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              label={{
                value: "Completion (%)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12, fill: "#6b7280" },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="completionRate"
              fill="#014357"
              name="Completion Rate (%)"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4"
              style={{ backgroundColor: "#014357" }}
            ></div>
            <span className="text-sm text-gray-700">Completion Rate (%)</span>
          </div>
        </div>
      </Card>

      {(user.role === "admin" || user.role === "vendor") && (
        <Card className="mt-4 sm:mt-6">
          <div className="p-6 pb-0">
            <div className="flex items-start justify-between mb-0">
              <div className="flex-1">
                <h3
                  className="mb-0"
                  style={{ color: "#014357", lineHeight: "1.2" }}
                >
                  Vendor Performance Scorecard
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {user.role === "vendor"
                    ? "Your performance ratings per purchase order"
                    : "Comprehensive vendor ratings and performance classifications"}
                </p>
              </div>

              {user.role === "admin" && (
                <Button
                  onClick={handleExportVendorScorecard}
                  variant="outline"
                  className="transition-colors"
                  style={{
                    borderColor: "#014357",
                    color: "#014357",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#014357";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#014357";
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to Excel
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto px-4 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  {user.role !== "vendor" && (
                    <TableHead className="text-gray-700 w-8"></TableHead>
                  )}
                  {user.role !== "vendor" && (
                    <TableHead className="text-gray-700">Vendor</TableHead>
                  )}
                  {user.role === "vendor" && (
                    <TableHead className="text-gray-700">
                      Purchase Order
                    </TableHead>
                  )}
                  {user.role === "vendor" && (
                    <TableHead className="text-gray-700">
                      Item of Requisition
                    </TableHead>
                  )}
                  <TableHead className="text-center text-gray-700">
                    OTD
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    Communication
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    Re-ETA Accepted
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    Re-ETA Rejected
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    Excellence Point
                  </TableHead>
                  <TableHead className="text-center text-gray-700 sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 hover:bg-transparent"
                      onClick={toggleScorecardSort}
                    >
                      <span className="mr-1">Overall Score</span>
                      {scorecardSortOrder === "desc" ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {user.role === "vendor" ? (
                  vendorScorecardLoading &&
                  sortedVendorScopedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-gray-500 py-6"
                      >
                        Loading vendor scorecard...
                      </TableCell>
                    </TableRow>
                  ) : sortedVendorScopedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-gray-500 py-6"
                      >
                        No scorecard data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedVendorItems.map((record, index) => (
                      <TableRow
                        key={`${record.poNumber}-${record.itemOfRequisition}-${index}`}
                      >
                        <TableCell className="text-gray-900">
                          <span className="font-semibold">
                            {record.poNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          <span className="font-semibold">
                            {record.itemOfRequisition}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {record.otd}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {record.communication}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {record.reETAAccepted}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {record.reETARejected}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {record.excellencePoint}%
                        </TableCell>
                        <TableCell className="text-center sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center justify-center gap-1.5">
                            <Award
                              className="h-4 w-4"
                              style={{ color: "#6AA75D" }}
                            />
                            <span className="text-gray-900 font-semibold">
                              {record.overallScore}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                ) : vendorScorecardLoading &&
                  sortedVendorAggregates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-6"
                    >
                      Loading vendor scorecard...
                    </TableCell>
                  </TableRow>
                ) : sortedVendorAggregates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500 py-6"
                    >
                      No scorecard data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVendorAggregates.flatMap((vendorData) => {
                    const rowKey = `${vendorData.vendorCode}|${vendorData.vendorName}`;
                    const isExpanded = expandedVendors.includes(
                      vendorData.vendorName,
                    );
                    const rows: JSX.Element[] = [];

                    rows.push(
                      <TableRow
                        key={rowKey}
                        className="bg-gray-50 hover:bg-gray-100"
                      >
                        <TableCell className="text-gray-900">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              toggleVendorExpansion(vendorData.vendorName)
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          <span className="font-semibold">
                            {vendorData.vendorName}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.otd}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.communication}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.reETAAccepted}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.reETARejected}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.excellencePoint}%
                        </TableCell>
                        <TableCell className="text-center sticky right-0 bg-gray-50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center justify-center gap-1.5">
                            <Award
                              className="h-4 w-4"
                              style={{ color: "#6AA75D" }}
                            />
                            <span className="text-gray-900 font-semibold">
                              {vendorData.overallScore}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>,
                    );

                    if (isExpanded) {
                      vendorData.items.forEach((item, idx) => {
                        rows.push(
                          <TableRow
                            key={`${rowKey}-${item.poNumber}-${item.itemOfRequisition}-${idx}`}
                            className="bg-white hover:bg-gray-50"
                          >
                            <TableCell></TableCell>
                            <TableCell className="text-gray-700 pl-8">
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  PO: {item.poNumber}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Item: {item.itemOfRequisition}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.otd}%
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.communication}%
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.reETAAccepted}%
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.reETARejected}%
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.excellencePoint}%
                            </TableCell>
                            <TableCell className="text-center sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                              <span className="text-gray-700 text-sm">
                                {item.overallScore}%
                              </span>
                            </TableCell>
                          </TableRow>,
                        );
                      });
                    }

                    return rows;
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {scorecardDataLength > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Rows per page:
                </span>
                <Select
                  value={scorecardItemsPerPage.toString()}
                  onValueChange={(value) => {
                    setScorecardItemsPerPage(Number(value));
                    setScorecardCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setScorecardCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      className={
                        scorecardCurrentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {Array.from({ length: scorecardTotalPages }, (_, index) => {
                    const pageNumber = index + 1;
                    const shouldShowPage =
                      pageNumber === 1 ||
                      pageNumber === scorecardTotalPages ||
                      (pageNumber >= scorecardCurrentPage - 1 &&
                        pageNumber <= scorecardCurrentPage + 1);

                    const shouldShowEllipsis =
                      pageNumber === scorecardCurrentPage - 2 ||
                      pageNumber === scorecardCurrentPage + 2;

                    if (shouldShowPage) {
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            onClick={() => setScorecardCurrentPage(pageNumber)}
                            isActive={scorecardCurrentPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }

                    if (shouldShowEllipsis) {
                      return (
                        <PaginationEllipsis key={`ellipsis-${pageNumber}`} />
                      );
                    }

                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setScorecardCurrentPage((prev) =>
                          Math.min(scorecardTotalPages, prev + 1),
                        )
                      }
                      className={
                        scorecardCurrentPage === scorecardTotalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="text-sm text-gray-600 whitespace-nowrap">
                {scorecardDisplayRange.total === 0
                  ? "Showing 0 of 0 results"
                  : `Showing ${scorecardDisplayRange.start} to ${scorecardDisplayRange.end} of ${scorecardDisplayRange.total} results`}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
