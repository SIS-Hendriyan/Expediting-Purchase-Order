import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card } from "../ui/card";
import {
  getAccessToken,
  getAuthSession,
  isInternalSession,
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
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
  Clock,
  Zap,
  TrendingUp,
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

interface EvaluationItem {
  vendorName: string;
  poNumber: string;
  item: string;
  otdPercentage: number;
  otdDelay: number;
  responseTime: number;
}

interface VendorAggregate {
  vendorName: string;
  otdPercentage: number;
  otdDelay: number;
  responseTime: number;
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

  const [evaluationItems, setEvaluationItems] = useState<EvaluationItem[]>([]);
  const [vendorAggregates, setVendorAggregates] = useState<VendorAggregate[]>(
    [],
  );
  const [expandedVendors, setExpandedVendors] = useState<string[]>([]);
  const [vendorScorecardLoading, setVendorScorecardLoading] = useState(false);
  const [vendorScorecardError, setVendorScorecardError] = useState<
    string | null
  >(null);

  const [vendorPerformance, setVendorPerformance] = useState<{
    OTD_Percentage?: number;
    Delay_Leadtime?: number;
    Response_Time?: number;
  } | null>(null);

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

  const cleanVendorCompany =
    user.role === "vendor" && user.company
      ? user.company.replace(/\?/g, "").trim()
      : undefined;

  const isVendorRole = user.role === "vendor";

  const sessionPlant = useMemo(() => {
    if (user.role !== "user") return "";
    const s = getAuthSession();
    return isInternalSession(s) ? s.plant : "";
  }, [user.role]);

  const scorecardDataLength = isVendorRole
    ? evaluationItems.length
    : vendorAggregates.length;

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

  const paginatedEvaluationItems = useMemo(() => {
    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = startIndex + scorecardItemsPerPage;
    return evaluationItems.slice(startIndex, endIndex);
  }, [evaluationItems, scorecardCurrentPage, scorecardItemsPerPage]);

  const paginatedVendorAggregates = useMemo(() => {
    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = startIndex + scorecardItemsPerPage;
    return vendorAggregates.slice(startIndex, endIndex);
  }, [vendorAggregates, scorecardCurrentPage, scorecardItemsPerPage]);

  const buildCommonParams = (
    useDefault: boolean,
    groupParamName: "group" | "purchasing_group",
  ) => {
    const params = new URLSearchParams();

    if (user.role === "user") {
      params.append("plant", sessionPlant);
    }
    if (useDefault) return params;

    if (startDate) params.append("start_date", formatLocalDateParam(startDate));
    if (endDate) params.append("end_date", formatLocalDateParam(endDate));
    if (plant) {
      params.append("plant", plant);
    }
    if (group && group !== "All") params.append(groupParamName, group);

    if (cleanVendorCompany) {
      params.append("Vendor", cleanVendorCompany);
      params.append("Name", cleanVendorCompany);
      params.append("Company", cleanVendorCompany);
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

      if (cleanVendorCompany) {
        params.set("Vendor", cleanVendorCompany);
        params.set("Name", cleanVendorCompany);
        params.set("Company", cleanVendorCompany);
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
      const vendorParam = cleanVendorCompany;
      const url = `${API.DASHBOARD_PO_TREND(vendorParam)}?${params.toString()}`;
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
      const vendorParam = cleanVendorCompany;
      const url = `${API.DASHBOARD_STATUS_DISTRIBUTION(vendorParam)}?${params.toString()}`;
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
      const vendorParam = cleanVendorCompany;
      const url = `${API.DASHBOARD_MONTHLY_COMPLETION_DELAY(vendorParam)}?${params.toString()}`;
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

      const isVendor = user.role === "vendor";
      const role = isVendor ? "VENDOR" : "USER";
      const vendorNameParam =
        isVendor && cleanVendorCompany ? cleanVendorCompany : undefined;

      const url = API.DASHBOARD_VENDOR_EVALUATION(role, vendorNameParam);
      const separator = url.includes("?") ? "&" : "?";
      const urlWithPlant =
        user.role === "user" && sessionPlant
          ? `${url}${separator}plant=${encodeURIComponent(sessionPlant)}`
          : url;
      const res = await fetchWithAuth(urlWithPlant, {
        headers: buildAuthHeaders(),
      });
      const data = await getJsonData<{ vendors?: any[]; items?: any[] }>(res);

      const rawItems = Array.isArray(data.items) ? data.items : [];
      const rawVendors = Array.isArray(data.vendors) ? data.vendors : [];

      const uiItems: EvaluationItem[] = rawItems.map((i) => ({
        vendorName: i.VendorName ?? "",
        poNumber: i["Purchasing Document"] ?? "",
        item: i.Item ?? "",
        otdPercentage: Number(i.OTD_Percentage ?? 0),
        otdDelay: Number(i.OTD_Delay ?? 0),
        responseTime: Number(i.RT ?? 0),
      }));

      const uiVendors: VendorAggregate[] = rawVendors.map((v) => ({
        vendorName: v.VendorName ?? "",
        otdPercentage: Number(v.OTD_Percentage ?? 0),
        otdDelay: Number(v.OTD_Delay ?? 0),
        responseTime: Number(v.RT ?? 0),
      }));

      setEvaluationItems(uiItems);
      setVendorAggregates(uiVendors);
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

  const fetchVendorPerformance = async () => {
    if (!cleanVendorCompany) return;

    try {
      let url = API.DASHBOARD_VENDOR_PERFORMANCE(cleanVendorCompany);
      if (user.role === "user" && sessionPlant) {
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}plant=${encodeURIComponent(sessionPlant)}`;
      }
      const res = await fetchWithAuth(url, { headers: buildAuthHeaders() });
      const data = await getJsonData<{
        OTD_Percentage?: number;
        Delay_Leadtime?: number;
        Response_Time?: number;
      }>(res);

      setVendorPerformance({
        OTD_Percentage: Number(data?.OTD_Percentage ?? 0),
        Delay_Leadtime: Number(data?.Delay_Leadtime ?? 0),
        Response_Time: Number(data?.Response_Time ?? 0),
      });
    } catch (err: any) {
      console.error("Failed to fetch vendor performance", err);
    }
  };

  const reloadAllData = (useDefault = false) => {
    void fetchSummary(useDefault);
    void fetchPoTrend(useDefault);
    void fetchStatusDistribution(useDefault);
    void fetchMonthlyCompletionDelay(useDefault);
    void fetchVendorScorecard(useDefault);
    void fetchVendorPerformance();
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

  const toggleVendorExpansion = (vendorName: string) => {
    setExpandedVendors((prev) =>
      prev.includes(vendorName)
        ? prev.filter((v) => v !== vendorName)
        : [...prev, vendorName],
    );
  };

  const toggleVendor = (vendorRaw: string) => {
    setVendor((prev) => (prev === vendorRaw ? "" : vendorRaw));
  };

  const handleExportVendorScorecard = () => {
    const fileDate = getFileDate();

    if (isVendorRole) {
      const rows: (string | number)[][] = [
        ["PO", "Item", "OTD Percentage", "OTD Delay", "Response Time"],
        ...evaluationItems.map((record) => [
          record.poNumber,
          record.item,
          record.otdPercentage,
          record.otdDelay,
          record.responseTime,
        ]),
      ];

      downloadXlsLikeTsvFile(`vendor-scorecard-${fileDate}.xls`, rows);
      return;
    }

    const rows: (string | number)[][] = [
      ["Vendor", "PO", "Item", "OTD Percentage", "OTD Delay", "Response Time"],
      ...vendorAggregates.flatMap((vendor) => {
        const vendorItems = evaluationItems.filter(
          (item) => item.vendorName === vendor.vendorName,
        );
        return vendorItems.length > 0
          ? vendorItems.map((item) => [
              vendor.vendorName,
              item.poNumber,
              item.item,
              item.otdPercentage,
              item.otdDelay,
              item.responseTime,
            ])
          : [
              [
                vendor.vendorName,
                "",
                "",
                vendor.otdPercentage,
                vendor.otdDelay,
                vendor.responseTime,
              ],
            ];
      }),
    ];

    downloadXlsLikeTsvFile(`vendor-scorecard-${fileDate}.xls`, rows);
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

                {user.role !== "user" && (
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
                )}

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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">
                  Vendor Performance
                </h3>
                {/*<div className="flex items-center gap-1 text-green-600 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" />
                  2%
                </div>*/}
              </div>

              <div className="flex flex-row gap-3">
                <div
                  className="flex-1 rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: "rgba(0, 131, 131, 0.06)",
                    border: "1px solid rgba(0, 131, 131, 0.15)",
                  }}
                >
                  <div className="text-[10px] text-gray-500 mb-1">OTD %</div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: "#008383" }}
                  >
                    {vendorPerformance?.OTD_Percentage ?? 0}
                    <span className="text-xs font-normal">%</span>
                  </div>
                  <div className="mt-2">
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(0, 131, 131, 0.1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${vendorPerformance?.OTD_Percentage ?? 0}%`,
                          backgroundColor: "#008383",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="flex-1 rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: "rgba(237, 131, 45, 0.06)",
                    border: "1px solid rgba(237, 131, 45, 0.15)",
                  }}
                >
                  <div className="text-[10px] text-gray-500 mb-1">
                    Delay Leadtime
                  </div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: "#ED832D" }}
                  >
                    {vendorPerformance?.Delay_Leadtime ?? 0}
                    <span className="text-xs font-normal"> days</span>
                  </div>
                  <div className="mt-2">
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(237, 131, 45, 0.1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(((vendorPerformance?.Delay_Leadtime ?? 0) / 10) * 100, 100)}%`,
                          backgroundColor: "#ED832D",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="flex-1 rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: "rgba(92, 140, 182, 0.06)",
                    border: "1px solid rgba(92, 140, 182, 0.15)",
                  }}
                >
                  <div className="text-[10px] text-gray-500 mb-1">
                    Response Time
                  </div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: "#5C8CB6" }}
                  >
                    {vendorPerformance?.Response_Time ?? 0}
                    <span className="text-xs font-normal">/100</span>
                  </div>
                  <div className="mt-2">
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(92, 140, 182, 0.1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${vendorPerformance?.Response_Time ?? 0}%`,
                          backgroundColor: "#5C8CB6",
                        }}
                      />
                    </div>
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
              subtitle: "",
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
                {/*<div className="flex items-center gap-1 text-red-500 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>*/}
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
              subtitle: "",
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
                  {isVendorRole && (
                    <TableHead className="text-gray-700">PO</TableHead>
                  )}
                  {isVendorRole && (
                    <TableHead className="text-gray-700">Item</TableHead>
                  )}
                  <TableHead className="text-center text-gray-700">
                    OTD Percentage
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    OTD Delay
                  </TableHead>
                  <TableHead className="text-center text-gray-700">
                    Response Time
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {vendorScorecardLoading && scorecardDataLength === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isVendorRole ? 5 : 4}
                      className="text-center text-gray-500 py-6"
                    >
                      Loading vendor scorecard...
                    </TableCell>
                  </TableRow>
                ) : scorecardDataLength === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isVendorRole ? 5 : 4}
                      className="text-center text-gray-500 py-6"
                    >
                      No scorecard data available.
                    </TableCell>
                  </TableRow>
                ) : isVendorRole ? (
                  paginatedEvaluationItems.map((record, index) => (
                    <TableRow
                      key={`${record.poNumber}-${record.item}-${index}`}
                    >
                      <TableCell className="text-gray-900">
                        <span className="font-semibold">{record.poNumber}</span>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {record.item}
                      </TableCell>
                      <TableCell className="text-center text-gray-900">
                        {record.otdPercentage}%
                      </TableCell>
                      <TableCell className="text-center text-gray-900">
                        {record.otdDelay}
                      </TableCell>
                      <TableCell className="text-center text-gray-900">
                        {record.responseTime}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  paginatedVendorAggregates.flatMap((vendorData) => {
                    const isExpanded = expandedVendors.includes(
                      vendorData.vendorName,
                    );
                    const vendorItems = evaluationItems.filter(
                      (item) => item.vendorName === vendorData.vendorName,
                    );
                    const rows: JSX.Element[] = [];

                    rows.push(
                      <TableRow
                        key={`vendor-${vendorData.vendorName}`}
                        className="bg-gray-50 hover:bg-gray-100"
                      >
                        <TableCell>
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
                          {vendorData.otdPercentage}%
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.otdDelay}
                        </TableCell>
                        <TableCell className="text-center text-gray-900">
                          {vendorData.responseTime}
                        </TableCell>
                      </TableRow>,
                    );

                    if (isExpanded) {
                      vendorItems.forEach((item, idx) => {
                        rows.push(
                          <TableRow
                            key={`item-${vendorData.vendorName}-${item.poNumber}-${item.item}-${idx}`}
                            className="bg-white hover:bg-gray-50"
                          >
                            <TableCell></TableCell>
                            <TableCell className="text-gray-700 pl-8">
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  PO: {item.poNumber}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Item: {item.item}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.otdPercentage}%
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.otdDelay}
                            </TableCell>
                            <TableCell className="text-center text-gray-700 text-sm">
                              {item.responseTime}
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
