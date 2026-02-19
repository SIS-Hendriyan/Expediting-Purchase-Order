// src/components/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { getAccessToken } from '../../utils/authSession';
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
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Clock,
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
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '../ui/pagination';
import { Alert, AlertDescription } from '../ui/alert';
import { User } from './Login';
import { API } from '../../config';

interface DashboardProps {
  user: User;
  onPageChange: (page: string) => void;
}

// type summary dari SP [exp].[PO_DASHBOARD_SUMMARY_SP]
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

// ---- API response models (UI side) ----
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

// master vendor option
interface VendorOption {
  name: string;
  raw: string;
}

// helper mapping doc type UI -> API
const mapDocTypeForApi = (docType: string): string | undefined => {
  if (!docType) return undefined;
  // requirement: jika pilih "Purchase Order" maka kirim 'All' (no filter di SP)
  if (docType === 'purchase-order') return 'All';
  return docType;
};

const getAuthToken = (): string => {
  const local = localStorage.getItem('accessToken');
  const sessionToken = getAccessToken();
  return local || sessionToken || '';
};

const buildAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getStatusColor = (name: string): string => {
  switch (name) {
    case 'PO Uploaded':
      return '#ED832D';
    case 'Work in Progress':
      return '#008383';
    case 'On Delivery':
      return '#5C8CB6';
    case 'Partially Received':
      return '#F59E0B';
    case 'Fully Received':
      return '#6AA75D';
    default:
      return '#9CA3AF';
  }
};

// helper: format tanggal berdasarkan local time (tanpa masalah timezone)
const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 0-based
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function Dashboard({ user, onPageChange }: DashboardProps) {
  // ====== FILTER STATES ======
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [plant, setPlant] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [vendor, setVendor] = useState<string>(''); // SINGLE vendor (raw value)
  const [docType, setDocType] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  // Filter master data (from /api/dashboard/master-filters)
  const [plantOptions, setPlantOptions] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);

  // ====== DASHBOARD SUMMARY ======
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ====== TIME-SERIES / DISTRIBUTION DATA ======
  const [poTrendData, setPoTrendData] = useState<PoTrendPoint[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistributionItem[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendPoint[]>([]);

  // ====== VENDOR SCORECARD STATES ======
  const [scorecardCurrentPage, setScorecardCurrentPage] = useState(1);
  const [scorecardItemsPerPage, setScorecardItemsPerPage] = useState(10);
  const [expandedVendors, setExpandedVendors] = useState<string[]>([]);
  const [scorecardSortOrder, setScorecardSortOrder] = useState<'asc' | 'desc'>('desc');

  const [vendorScorecardItems, setVendorScorecardItems] = useState<VendorScorecardItemUI[]>([]);
  const [vendorScorecardAggregates, setVendorScorecardAggregates] = useState<
    VendorScorecardAggregateUI[]
  >([]);
  const [vendorScorecardLoading, setVendorScorecardLoading] = useState(false);
  const [vendorScorecardError, setVendorScorecardError] = useState<string | null>(null);

  // ====== SUMMARY DERIVED VALUES ======
  const totalPO = summary?.TotalPO ?? 0;
  const outstandingQty = summary?.OutstandingQuantity ?? 0;
  const totalCompletion = summary?.TotalCompletionRate ?? 0;
  const percentageCompletion = summary?.PercentageCompletionRate ?? 0;
  const totalLate = summary?.TotalLateOrder ?? 0;
  const totalNotArrived = summary?.TotalNotArrivedOrder ?? 0;
  const totalOverdue = summary?.TotalOverdueOrder ?? 0;
  const avgDelay = summary?.AverageDelay ?? 0;
  const totalResched = summary?.TotalRescheduledOrder ?? 0;
  const reschedRatio = summary?.RescheduleETARatio ?? 0;
  const totalVendorResp = summary?.TotalVendorResponse ?? 0;
  const vendorRespRate = summary?.VendorResponseRate ?? 0;

  // ========= API CALL: /api/dashboard/master-filters =========
  const fetchMasterFilters = async () => {
    try {
      const token = getAuthToken();
      console.log(token)
      if (!token) {
        console.error('Missing authentication token for master filters');
        return;
      }

      const res = await fetch(API.MASTER_FILTER_DASHBOARD(), {
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Master filters failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('MASTER_FILTER_DASHBOARD', json);

      const data = json.Data ?? json;

      setPlantOptions(Array.isArray(data.plants) ? data.plants : []);

      if (Array.isArray(data.suppliers)) {
        const suppliers: VendorOption[] = data.suppliers.map((s: any) => ({
          name: s.name,
          raw: s.raw,
        }));
        setVendorOptions(suppliers);
      } else {
        setVendorOptions([]);
      }
    } catch (err) {
      console.error('Failed to fetch master filters', err);
    }
  };

  // ========= API CALL: /api/dashboard/summary =========
  const fetchSummary = async (useDefault: boolean = false) => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);

      const token = getAuthToken();
      if (!token) {
        setSummaryError('Missing authentication token');
        setSummaryLoading(false);
        return;
      }

      const params = new URLSearchParams();

      // useDefault = true => tidak kirim filter apa pun (default)
      if (!useDefault) {
        if (startDate) params.append('start_date', formatLocalDateParam(startDate));
        if (endDate) params.append('end_date', formatLocalDateParam(endDate));
        if (plant) params.append('plant', plant);
        // All = tidak kirim param
        if (group && group !== 'All') params.append('group', group);

        // Backend sekarang cuma support 1 vendor
        if (user.role === 'vendor' && user.company) {
          params.append('vendor', user.company);
        } else if (vendor) {
          params.append('vendor', vendor); // single raw value (backend bisa adjust)
        }

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append('doc_type', mappedDocType);
      }

      const url = `${API.SUMMARYDASHBOARD()}?${params.toString()}`;
      const headers = buildAuthHeaders();
      const res = await fetch(url, {
        headers,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('SUMMARYDASHBOARD', json);
      const data = json.Data ?? json;

      setSummary(data as SummaryData);
    } catch (err: any) {
      console.error('Failed to fetch PO dashboard summary', err);
      setSummaryError(err?.message || 'Failed to fetch PO dashboard summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  // ========= API CALL: /api/dashboard/po-trend =========
  const fetchPoTrend = async (useDefault: boolean = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Missing authentication token for PO trend');
        return;
      }

      const params = new URLSearchParams();

      if (!useDefault) {
        if (startDate) params.append('start_date', formatLocalDateParam(startDate));
        if (endDate) params.append('end_date', formatLocalDateParam(endDate));
        if (plant) params.append('plant', plant);

        // backend expects "purchasing_group"
        if (group && group !== 'All') params.append('purchasing_group', group);

        // vendor filter (backend expects "vendor")
        if (user.role === 'vendor' && user.company) {
          params.append('vendor', user.company);
        } else if (vendor) {
          params.append('vendor', vendor);
        }

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append('doc_type', mappedDocType);
      }

      const url = `${API.DASHBOARD_PO_TREND()}?${params.toString()}`;
      const res = await fetch(url, { headers: buildAuthHeaders() });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `PO trend failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('PO_TREND', json);
      const data = json.Data ?? json;
      setPoTrendData(data as PoTrendPoint[]);
    } catch (err) {
      console.error('Failed to fetch PO trend', err);
    }
  };

  // ========= API CALL: /api/dashboard/status-distribution =========
  const fetchStatusDistribution = async (useDefault: boolean = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Missing authentication token for status distribution');
        return;
      }

      const params = new URLSearchParams();

      if (!useDefault) {
        if (startDate) params.append('start_date', formatLocalDateParam(startDate));
        if (endDate) params.append('end_date', formatLocalDateParam(endDate));
        if (plant) params.append('plant', plant);
        if (group && group !== 'All') params.append('purchasing_group', group);

        if (user.role === 'vendor' && user.company) {
          params.append('vendor', user.company);
        } else if (vendor) {
          params.append('vendor', vendor);
        }

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append('doc_type', mappedDocType);
      }

      const url = `${API.DASHBOARD_STATUS_DISTRIBUTION()}?${params.toString()}`;
      const res = await fetch(url, { headers: buildAuthHeaders() });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Status distribution failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('STATUS_DISTRIBUTION', json);

      const data = (json.Data ?? json) as any[];

      const mapped: StatusDistributionItem[] = data.map((d) => ({
        name: d.name,
        value: d.value,
        rawStatus: d.rawStatus,
        totalAll: d.totalAll,
        color: getStatusColor(d.name),
      }));

      setStatusDistribution(mapped);
    } catch (err) {
      console.error('Failed to fetch status distribution', err);
    }
  };

  // ========= API CALL: /api/dashboard/monthly-completion-delay =========
  const fetchMonthlyCompletionDelay = async (useDefault: boolean = false) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Missing authentication token for monthly completion delay');
        return;
      }

      const params = new URLSearchParams();

      if (!useDefault) {
        if (startDate) params.append('start_date', formatLocalDateParam(startDate));
        if (endDate) params.append('end_date', formatLocalDateParam(endDate));
        if (plant) params.append('plant', plant);
        if (group && group !== 'All') params.append('group', group);

        if (user.role === 'vendor' && user.company) {
          params.append('vendor', user.company);
        } else if (vendor) {
          params.append('vendor', vendor);
        }

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append('doc_type', mappedDocType);
      }

      const url = `${API.DASHBOARD_MONTHLY_COMPLETION_DELAY()}?${params.toString()}`;
      const res = await fetch(url, { headers: buildAuthHeaders() });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Monthly completion delay failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('MONTHLY_COMPLETION_DELAY', json);
      const data = json.Data ?? json;
      setMonthlyTrends(data as MonthlyTrendPoint[]);
    } catch (err) {
      console.error('Failed to fetch monthly completion delay', err);
    }
  };

  // ========= API CALL: /api/dashboard/vendor/scorecard =========
  const fetchVendorScorecard = async (useDefault: boolean = false) => {
    try {
      setVendorScorecardLoading(true);
      setVendorScorecardError(null);

      const token = getAuthToken();
      if (!token) {
        setVendorScorecardError('Missing authentication token for vendor scorecard');
        setVendorScorecardLoading(false);
        return;
      }

      const params = new URLSearchParams();

      if (!useDefault) {
        if (startDate) params.append('start_date', formatLocalDateParam(startDate));
        if (endDate) params.append('end_date', formatLocalDateParam(endDate));
        if (plant) params.append('plant', plant);
        if (group && group !== 'All') params.append('group', group);

        const mappedDocType = mapDocTypeForApi(docType);
        if (mappedDocType) params.append('doc_type', mappedDocType);

        // === vendor filter: backend expects ?vendor=FULL_VENDOR_NAME ===
        let vendorFilter: string | undefined;

        if (user.role === 'vendor' && user.company) {
          // Kalau di token user.company = full "3100000018 CV HAJI USNAN ELECTRIC", biarkan saja
          vendorFilter = user.company;
        } else if (vendor) {
          // vendor state sudah berisi raw, misalnya "3100000018 CV HAJI USNAN ELECTRIC"
          vendorFilter = vendor;
        }

        if (vendorFilter) {
          params.append('vendor', vendorFilter);
        }
      }
      const url = `${API.DASHBOARD_VENDOR_SCORECARD()}?${params.toString()}`;
      const res = await fetch(url, { headers: buildAuthHeaders() });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Vendor scorecard failed with status ${res.status}`);
      }

      const json = await res.json();
      console.log('VENDOR_SCORECARD', json);
      const data = json.Data ?? json;

      const items = (data.items ?? []) as any[];
      const aggregates = (data.vendor_aggregates ?? []) as any[];

      const uiItems: VendorScorecardItemUI[] = items.map((i) => ({
        poNumber: i.PONumber,
        itemOfRequisition: i.ItemOfRequisition,
        vendorCode: i.VendorCode,
        vendorName: i.VendorName,
        otd: i.OTD,
        communication: i.Communication,
        reETAAccepted: i.ReETAAccepted,
        reETARejected: i.ReETARejected,
        excellencePoint: i.ExcellencePoint,
        overallScore: i.OverallScore,
      }));

      const aggregatesMap: Record<string, VendorScorecardAggregateUI> = {};

      // base aggregates dari backend
      for (const agg of aggregates) {
        const key = `${agg.VendorCode}|${agg.VendorName}`;
        aggregatesMap[key] = {
          vendorCode: agg.VendorCode,
          vendorName: agg.VendorName,
          otd: agg.OTD,
          communication: agg.Communication,
          reETAAccepted: agg.ReETAAccepted,
          reETARejected: agg.ReETARejected,
          excellencePoint: agg.ExcellencePoint,
          overallScore: agg.OverallScore,
          itemsCount: agg.ItemsCount ?? 0,
          items: [],
        };
      }

      // attach items ke masing-masing vendor
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
      console.error('Failed to fetch vendor scorecard', err);
      setVendorScorecardError(err?.message || 'Failed to fetch vendor scorecard');
    } finally {
      setVendorScorecardLoading(false);
    }
  };

  // ========= Helper to reload all data =========
  const reloadAllData = (useDefault: boolean = false) => {
    fetchSummary(useDefault);
    fetchPoTrend(useDefault);
    fetchStatusDistribution(useDefault);
    fetchMonthlyCompletionDelay(useDefault);
    fetchVendorScorecard(useDefault);
  };

  // ========= INITIAL LOAD (tanpa filter) =========
  useEffect(() => {
    fetchMasterFilters();
    reloadAllData(true); // initial load: default, tanpa filter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format date for display
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Toggle vendor selection (single select, value = raw)
  const toggleVendor = (vendorRaw: string) => {
    setVendor((prev) => (prev === vendorRaw ? '' : vendorRaw));
  };

  const selectedVendorOption = vendorOptions.find((opt) => opt.raw === vendor);

  // Vendor score from aggregates
  const currentVendorAggregate =
    user.role === 'vendor' && user.company
      ? vendorScorecardAggregates.find(
          (v) => v.vendorName === user.company || v.vendorCode === user.company
        )
      : undefined;

  const currentVendorScore = currentVendorAggregate?.overallScore ?? 0;

  const getCurrentVendorComposition = () => {
    if (!currentVendorAggregate) return [];
    return [
      { category: 'OTD', value: currentVendorAggregate.otd, color: '#008383' },
      { category: 'Communication', value: currentVendorAggregate.communication, color: '#5C8CB6' },
      { category: 'Re-ETA Accepted', value: currentVendorAggregate.reETAAccepted, color: '#6AA75D' },
      { category: 'Re-ETA Rejected', value: currentVendorAggregate.reETARejected, color: '#D4183D' },
      { category: 'Excellence Point', value: currentVendorAggregate.excellencePoint, color: '#ED832D' },
    ];
  };

  const vendorComposition = getCurrentVendorComposition();

  // Toggle vendor expansion
  const toggleVendorExpansion = (vendorName: string) => {
    setExpandedVendors((prev) =>
      prev.includes(vendorName) ? prev.filter((v) => v !== vendorName) : [...prev, vendorName]
    );
  };

  // Toggle scorecard sort order
  const toggleScorecardSort = () => {
    setScorecardSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Helper: hitung total pages + range display untuk pagination scorecard
  const getScorecardDataLength = () =>
    user.role === 'vendor' ? vendorScorecardItems.length : vendorScorecardAggregates.length;

  const getScorecardTotalPages = () => {
    const len = getScorecardDataLength();
    if (len === 0) return 1;
    return Math.ceil(len / scorecardItemsPerPage);
  };

  const getScorecardDisplayRange = () => {
    const len = getScorecardDataLength();
    if (len === 0) return { start: 0, end: 0 };
    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
    const endIndex = Math.min(startIndex + scorecardItemsPerPage, len);
    return { start: startIndex + 1, end: endIndex, total: len };
  };

  // Custom label for pie chart
  const renderPercentageLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
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
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{ fontSize: '14px', fontWeight: 'bold' }}
      >
        {`${percentage}%`}
      </text>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2" style={{ color: '#014357' }}>
          Analytical Dashboard
        </h1>
        <p className="text-gray-600">Overview of key metrics and insights</p>
      </div>

      {/* Error summary */}
      {summaryError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{summaryError}</AlertDescription>
        </Alert>
      )}

      {/* Vendor scorecard error */}
      {vendorScorecardError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{vendorScorecardError}</AlertDescription>
        </Alert>
      )}

      {/* Filters Section with Gradient */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <div
          className="rounded-lg mb-6"
          style={{
            background: 'linear-gradient(135deg, #014357 0%, #026a80 50%, #ED832D 100%)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 sm:p-6 flex items-center justify-between text-white hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                <h3 className="mb-0">Filters</h3>
              </div>
              {isFiltersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Start Date */}
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
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: startDate ? '#014357' : '#9ca3af',
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDate(startDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
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
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: endDate ? '#014357' : '#9ca3af',
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formatDate(endDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Plant / Jobsite */}
                <div className="space-y-2">
                  <Label htmlFor="plant" className="text-sm text-white">
                    {user.role === 'vendor' ? 'Jobsite' : 'Plant'}
                  </Label>
                  <Select value={plant} onValueChange={setPlant}>
                    <SelectTrigger
                      id="plant"
                      className="w-full bg-white hover:bg-gray-50"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                    >
                      <SelectValue
                        placeholder={user.role === 'vendor' ? 'Select jobsite' : 'Select plant'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {plantOptions.length === 0 ? (
                        <SelectItem value="" disabled>
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

                {/* Group - Hidden for vendors */}
                {user.role !== 'vendor' && (
                  <div className="space-y-2">
                    <Label htmlFor="group" className="text-sm text-white">
                      Group
                    </Label>
                    <Select value={group} onValueChange={setGroup}>
                      <SelectTrigger
                        id="group"
                        className="w-full bg-white hover:bg-gray-50"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                      >
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* All = kirim null (tidak kirim param) */}
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="logistics">Logistics</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="procurement">Procurement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Vendor - Hidden for vendors */}
                {user.role !== 'vendor' && (
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
                          style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                        >
                          <span className="text-sm">
                            {selectedVendorOption ? selectedVendorOption.name : 'Select vendor'}
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
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'hover:bg-gray-100 text-gray-800'
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

                {/* Doc Type - Admin Only */}
                {user.role === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="doc-type" className="text-sm text-white">
                      Doc Type
                    </Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger
                        id="doc-type"
                        className="w-full bg-white hover:bg-gray-50"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                      >
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase-order">Purchase Order</SelectItem>
                        {/* sesuaikan nanti dengan real DocType jika perlu */}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Apply/Reset Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  className="px-6"
                  style={{
                    backgroundColor: 'white',
                    color: '#014357',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    reloadAllData(false); // pakai filter di state
                    setScorecardCurrentPage(1);
                  }}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? 'Loading...' : 'Apply Filters'}
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  style={{
                    borderColor: 'white',
                    backgroundColor: 'transparent',
                    color: 'white',
                  }}
                  onClick={() => {
                    // reset state filter
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setPlant('');
                    setGroup('');
                    setVendor('');
                    setDocType('');

                    // langsung reload data default (tanpa filter)
                    reloadAllData(true);
                    setScorecardCurrentPage(1);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* KPI Cards - Conditional Layout Based on Role */}
      {user.role === 'vendor' ? (
        <>
          {/* Vendor View - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-3 sm:mb-4">
            {/* Vendor Average Score */}
            <Card className="p-6 sm:col-span-2 lg:col-span-2">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}>
                  <CheckCircle className="h-6 w-6" style={{ color: '#008383' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  2%
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="text-gray-600 text-sm mb-[25px]">Vendor Average Score</div>
                  <div className="text-3xl my-1" style={{ color: '#008383' }}>
                    {currentVendorScore.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-[25px]">Overall performance rating</div>
                </div>

                <div className="flex-1 min-w-0 pt-1">
                  <div className="space-y-2.5">
                    {vendorComposition.map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs text-gray-600 truncate">{item.category}</span>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: item.color }}>
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

            {/* Total Purchase Orders */}
            <Card className="p-6 lg:col-span-1">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Package className="h-6 w-6" style={{ color: '#014357' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  12%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Total Purchase Orders</div>
              <div className="text-3xl" style={{ color: '#014357' }}>
                {totalPO}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">+18 from last month</div>
            </Card>

            {/* Completion Rate */}
            <Card className="p-6 lg:col-span-1">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(106, 167, 93, 0.1)' }}>
                  <CheckCircle className="h-6 w-6" style={{ color: '#6AA75D' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  3%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Completion Rate</div>
              <div className="text-3xl" style={{ color: '#6AA75D' }}>
                {percentageCompletion}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {totalPO > 0 ? `${totalCompletion} of ${totalPO} orders completed` : 'No completed orders'}
              </div>
            </Card>

            {/* Overdue Orders */}
            <Card className="p-6 lg:col-span-1 relative">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(212, 24, 61, 0.1)' }}>
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  8%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Overdue Orders</div>
              <div className="text-3xl text-red-600">{totalOverdue}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {`${totalLate} late + ${totalNotArrived} not arrived`}
              </div>
              <button
                onClick={() => onPageChange('purchase-order')}
                className="absolute bottom-4 right-4 p-1.5 rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                aria-label="View orders"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </Card>
          </div>

          {/* Vendor View - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* POs Need Update (dummy logic) */}
            <Card className="p-6 relative">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
                  <AlertTriangle className="h-6 w-6" style={{ color: '#ED832D' }} />
                </div>
                <div className="flex items-center gap-1 text-gray-600 text-sm">
                  <span>—</span>
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">POs Need Update</div>
              <div className="text-3xl" style={{ color: '#ED832D' }}>
                12
              </div>
              <div className="text-xs text-gray-500 mt-0.5">ETA D-2 or D-1</div>
              <button
                onClick={() => onPageChange('purchase-order')}
                className="absolute bottom-4 right-4 p-1.5 rounded-full transition-colors"
                style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)', color: '#ED832D' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(237, 131, 45, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(237, 131, 45, 0.1)';
                }}
                aria-label="Update POs"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </Card>

            {/* Average Delay */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
                  <Clock className="h-6 w-6" style={{ color: '#ED832D' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingDown className="h-4 w-4" />
                  15%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Average Delay</div>
              <div className="text-3xl" style={{ color: '#ED832D' }}>
                {avgDelay}d
              </div>
              <div className="text-xs text-gray-500 mt-0.5">For delayed orders only</div>
            </Card>

            {/* Reschedule ETA Ratio */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}>
                  <RefreshCw className="h-6 w-6" style={{ color: '#008383' }} />
                </div>
                <div className="flex items-center gap-1 text-gray-600 text-sm">
                  <span>—</span>
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Reschedule ETA Ratio</div>
              <div className="text-3xl" style={{ color: '#008383' }}>
                {reschedRatio}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {totalPO > 0 ? `${totalResched} of ${totalPO} orders rescheduled` : 'No rescheduled orders'}
              </div>
            </Card>

            {/* Vendor Response Rate */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(92, 140, 182, 0.1)' }}>
                  <CheckCircle className="h-6 w-6" style={{ color: '#5C8CB6' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  5%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Vendor Response Rate</div>
              <div className="text-3xl" style={{ color: '#5C8CB6' }}>
                {vendorRespRate}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {totalPO > 0
                  ? `${totalVendorResp} of ${totalPO} orders responded`
                  : 'No response data'}
              </div>
            </Card>

            {/* Outstanding Quantity */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Layers className="h-6 w-6" style={{ color: '#014357' }} />
                </div>
                <div className="flex items-center gap-1 text-gray-600 text-sm">
                  <span>—</span>
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Outstanding Quantity</div>
              <div className="text-3xl" style={{ color: '#014357' }}>
                {outstandingQty.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Units pending delivery</div>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Admin/User View - Row 1 */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 ${
              user.role === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            }`}
          >
            {/* Total Purchase Orders */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Package className="h-6 w-6" style={{ color: '#014357' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  12%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Total Purchase Orders</div>
              <div className="text-3xl" style={{ color: '#014357' }}>
                {totalPO}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">+18 from last month</div>
            </Card>

            {/* Completion Rate */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(106, 167, 93, 0.1)' }}>
                  <CheckCircle className="h-6 w-6" style={{ color: '#6AA75D' }} />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  3%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Completion Rate</div>
              <div className="text-3xl" style={{ color: '#6AA75D' }}>
                {percentageCompletion}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {totalPO > 0 ? `${totalCompletion} of ${totalPO} orders completed` : 'No completed orders'}
              </div>
            </Card>

            {/* Overdue Orders */}
            <Card className="p-6 relative">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(212, 24, 61, 0.1)' }}>
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  8%
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Overdue Orders</div>
              <div className="text-3xl text-red-600">{totalOverdue}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {`${totalLate} late + ${totalNotArrived} not arrived`}
              </div>
              <button
                onClick={() => onPageChange('purchase-order')}
                className="absolute bottom-4 right-4 p-1.5 rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                aria-label="View orders"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </Card>

            {/* Average Delay - Admin only */}
            {user.role === 'admin' && (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
                    <Clock className="h-6 w-6" style={{ color: '#ED832D' }} />
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <TrendingDown className="h-4 w-4" />
                    15%
                  </div>
                </div>
                <div className="text-gray-600 text-sm mb-0.5">Average Delay</div>
                <div className="text-3xl" style={{ color: '#ED832D' }}>
                  {avgDelay}d
                </div>
                <div className="text-xs text-gray-500 mt-0.5">For delayed orders only</div>
              </Card>
            )}
          </div>

          {/* Admin/User View - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Average Delay - User View */}
            {user.role === 'user' && (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
                    <Clock className="h-6 w-6" style={{ color: '#ED832D' }} />
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <TrendingDown className="h-4 w-4" />
                    15%
                  </div>
                </div>
                <div className="text-gray-600 text-sm mb-0.5">Average Delay</div>
                <div className="text-3xl" style={{ color: '#ED832D' }}>
                  {avgDelay}d
                </div>
                <div className="text-xs text-gray-500 mt-0.5">For delayed orders only</div>
              </Card>
            )}

            {/* Reschedule ETA Request Ratio */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}>
                  <RefreshCw className="h-6 w-6" style={{ color: '#008383' }} />
                </div>
                <div className="flex items-center gap-1 text-gray-600 text-sm">
                  <span>—</span>
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Reschedule ETA Ratio</div>
              <div className="text-3xl" style={{ color: '#008383' }}>
                {reschedRatio}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {totalPO > 0 ? `${totalResched} of ${totalPO} orders rescheduled` : 'No rescheduled orders'}
              </div>
            </Card>

            {/* Vendor Response Rate - Admin Only */}
            {user.role === 'admin' && (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(92, 140, 182, 0.1)' }}>
                    <CheckCircle className="h-6 w-6" style={{ color: '#5C8CB6' }} />
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    5%
                  </div>
                </div>
                <div className="text-gray-600 text-sm mb-0.5">Vendor Response Rate</div>
                <div className="text-3xl" style={{ color: '#5C8CB6' }}>
                  {vendorRespRate}%
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {totalPO > 0
                    ? `${totalVendorResp} of ${totalPO} orders responded`
                    : 'No response data'}
                </div>
              </Card>
            )}

            {/* Outstanding Quantity */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Layers className="h-6 w-6" style={{ color: '#014357' }} />
                </div>
                <div className="flex items-center gap-1 text-gray-600 text-sm">
                  <span>—</span>
                </div>
              </div>
              <div className="text-gray-600 text-sm mb-0.5">Outstanding Quantity</div>
              <div className="text-3xl" style={{ color: '#014357' }}>
                {outstandingQty.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Units pending delivery</div>
            </Card>
          </div>
        </>
      )}

      {/* Charts Row: PO Line Chart + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* PO Line Chart */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-0" style={{ color: '#014357', lineHeight: '1.2' }}>
            Purchase Order Trend
          </h3>
          <p className="text-sm text-gray-600 mb-4 sm:mb-6 mt-1">
            Monthly purchase order volume over time
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={poTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#014357" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#014357" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                label={{
                  value: 'Orders',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: '#6b7280' },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#014357"
                strokeWidth={3}
                name="Total Orders"
                fill="url(#colorOrders)"
                dot={{ r: 5, fill: '#014357', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4" style={{ backgroundColor: '#014357' }}></div>
              <span className="text-sm text-gray-700">Total Orders</span>
            </div>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-0" style={{ color: '#014357', lineHeight: '1.2' }}>
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
                  stroke: '#9ca3af',
                  strokeWidth: 1,
                }}
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#ED832D' }}></div>
              <span className="text-sm text-gray-700">PO Uploaded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#008383' }}></div>
              <span className="text-sm text-gray-700">Work in Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#5C8CB6' }}></div>
              <span className="text-sm text-gray-700">On Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F59E0B' }}></div>
              <span className="text-sm text-gray-700">Partially Received</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#6AA75D' }}></div>
              <span className="text-sm text-gray-700">Fully Received</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="mb-0" style={{ color: '#014357', lineHeight: '1.2' }}>
          Monthly Trends: Completion & Delay
        </h3>
        <p className="text-sm text-gray-600 mb-4 sm:mb-6 mt-1">
          Compare completion rates against average delivery delays
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={monthlyTrends} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{
                value: 'Completion (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#6b7280' },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{
                value: 'Delay (days)',
                angle: 90,
                position: 'insideRight',
                style: { fontSize: 12, fill: '#6b7280' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="completionRate"
              fill="#014357"
              name="Completion Rate (%)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgDelay"
              stroke="#ED832D"
              strokeWidth={4}
              name="Avg Delay (days)"
              dot={{ r: 5, fill: '#ED832D', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: '#014357' }}></div>
            <span className="text-sm text-gray-700">Completion Rate (%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: '#ED832D' }}></div>
            <span className="text-sm text-gray-700">Avg Delay (days)</span>
          </div>
        </div>
      </Card>

      {/* Vendor Performance Scorecard (Admin/Vendor Only) */}
      {(user.role === 'admin' || user.role === 'vendor') && (
        <Card className="mt-4 sm:mt-6">
          <div className="p-6 pb-0">
            <div className="flex items-start justify-between mb-0">
              <div className="flex-1">
                <h3 className="mb-0" style={{ color: '#014357', lineHeight: '1.2' }}>
                  Vendor Performance Scorecard
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {user.role === 'vendor'
                    ? 'Your performance ratings per purchase order'
                    : 'Comprehensive vendor ratings and performance classifications'}
                </p>
              </div>
              {user.role === 'admin' && (
                <Button
                  onClick={() => {
                    console.log('Exporting vendor scorecard to Excel...');
                  }}
                  variant="outline"
                  className="transition-colors"
                  style={{
                    borderColor: '#014357',
                    color: '#014357',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#014357';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#014357';
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
                  {user.role !== 'vendor' && <TableHead className="text-gray-700 w-8"></TableHead>}
                  {user.role !== 'vendor' && (
                    <TableHead className="text-gray-700">Vendor</TableHead>
                  )}
                  {user.role === 'vendor' && (
                    <TableHead className="text-gray-700">Purchase Order</TableHead>
                  )}
                  {user.role === 'vendor' && (
                    <TableHead className="text-gray-700">Item of Requisition</TableHead>
                  )}
                  <TableHead className="text-center text-gray-700">OTD</TableHead>
                  <TableHead className="text-center text-gray-700">Communication</TableHead>
                  <TableHead className="text-center text-gray-700">Re-ETA Accepted</TableHead>
                  <TableHead className="text-center text-gray-700">Re-ETA Rejected</TableHead>
                  <TableHead className="text-center text-gray-700">Excellence Point</TableHead>
                  <TableHead className="text-center text-gray-700 sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 hover:bg-transparent"
                      onClick={toggleScorecardSort}
                    >
                      <span className="mr-1">Overall Score</span>
                      {scorecardSortOrder === 'desc' ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.role === 'vendor' ? (
                  // Vendor view – pakai items dari API (1 baris per PO)
                  (() => {
                    const filteredRecords = vendorScorecardItems.filter((item) => {
                      if (!user.company) return true;
                      return item.vendorName === user.company || item.vendorCode === user.company;
                    });

                    const sortedRecords = [...filteredRecords].sort((a, b) =>
                      scorecardSortOrder === 'desc'
                        ? b.overallScore - a.overallScore
                        : a.overallScore - b.overallScore
                    );

                    const totalPages = Math.ceil(
                      sortedRecords.length / scorecardItemsPerPage || 1
                    );
                    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
                    const endIndex = startIndex + scorecardItemsPerPage;
                    const paginatedRecords = sortedRecords.slice(startIndex, endIndex);

                    if (vendorScorecardLoading && sortedRecords.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                            Loading vendor scorecard...
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (!vendorScorecardLoading && sortedRecords.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                            No scorecard data available.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return paginatedRecords.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-gray-900">
                          <span className="font-semibold">{record.poNumber}</span>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          <span className="font-semibold">{record.itemOfRequisition}</span>
                        </TableCell>
                        <TableCell className="text-center text-gray-900">{record.otd}%</TableCell>
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
                            <Award className="h-4 w-4" style={{ color: '#6AA75D' }} />
                            <span className="text-gray-900 font-semibold">
                              {record.overallScore}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  })()
                ) : (
                  // Admin/User view – pakai aggregates dari API (1 baris per vendor, bisa expand detail)
                  (() => {
                    const sortedVendorAggregates = [...vendorScorecardAggregates].sort((a, b) =>
                      scorecardSortOrder === 'desc'
                        ? b.overallScore - a.overallScore
                        : a.overallScore - b.overallScore
                    );

                    const totalPages = Math.ceil(
                      sortedVendorAggregates.length / scorecardItemsPerPage || 1
                    );
                    const startIndex = (scorecardCurrentPage - 1) * scorecardItemsPerPage;
                    const endIndex = startIndex + scorecardItemsPerPage;
                    const paginatedVendors = sortedVendorAggregates.slice(startIndex, endIndex);

                    if (vendorScorecardLoading && sortedVendorAggregates.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                            Loading vendor scorecard...
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (!vendorScorecardLoading && sortedVendorAggregates.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-6">
                            No scorecard data available.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return paginatedVendors.flatMap((vendorData) => {
                      const isExpanded = expandedVendors.includes(vendorData.vendorName);
                      const rows: JSX.Element[] = [];

                      rows.push(
                        <TableRow
                          key={vendorData.vendorName}
                          className="bg-gray-50 hover:bg-gray-100"
                        >
                          <TableCell className="text-gray-900">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleVendorExpansion(vendorData.vendorName)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronUp className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-gray-900">
                            <span className="font-semibold">{vendorData.vendorName}</span>
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
                              <Award className="h-4 w-4" style={{ color: '#6AA75D' }} />
                              <span className="text-gray-900 font-semibold">
                                {vendorData.overallScore}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );

                      if (isExpanded) {
                        vendorData.items.forEach((item, idx) => {
                          rows.push(
                            <TableRow
                              key={`${vendorData.vendorName}-${idx}`}
                              className="bg-white hover:bg-gray-50"
                            >
                              <TableCell></TableCell>
                              <TableCell className="text-gray-700 pl-8">
                                <div className="flex flex-col">
                                  <span className="text-sm">PO: {item.poNumber}</span>
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
                            </TableRow>
                          );
                        });
                      }

                      return rows;
                    });
                  })()
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {((user.role === 'vendor' && vendorScorecardItems.length > 0) ||
            (user.role !== 'vendor' && vendorScorecardAggregates.length > 0)) && (
            <div className="flex items-center justify-between px-4 py-4 border-t gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">Rows per page:</span>
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
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>

                  {(() => {
                    const totalPages = getScorecardTotalPages();

                    return [...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= scorecardCurrentPage - 1 &&
                          pageNumber <= scorecardCurrentPage + 1)
                      ) {
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
                      } else if (
                        pageNumber === scorecardCurrentPage - 2 ||
                        pageNumber === scorecardCurrentPage + 2
                      ) {
                        return <PaginationEllipsis key={pageNumber} />;
                      }
                      return null;
                    });
                  })()}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => {
                        const totalPages = getScorecardTotalPages();
                        setScorecardCurrentPage((prev) =>
                          Math.min(totalPages, prev + 1)
                        );
                      }}
                      className={(() => {
                        const totalPages = getScorecardTotalPages();
                        return scorecardCurrentPage === totalPages
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer';
                      })()}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="text-sm text-gray-600 whitespace-nowrap">
                {(() => {
                  const range = getScorecardDisplayRange();
                  if (range.total === 0) {
                    return 'Showing 0 of 0 results';
                  }
                  return `Showing ${range.start} to ${range.end} of ${range.total} results`;
                })()}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
