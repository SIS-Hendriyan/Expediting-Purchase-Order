import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  Search,
  Upload,
  Download,
  Filter,
  FileSpreadsheet,
  X,
  Columns3,
  Eye,
  Package,
  FilePlus,
  Loader,
  Truck,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Clock,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '../ui/pagination';

import type { User } from './Login';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { API } from '../../config';

import {
  getAuthSession,
  getAccessToken,
  isVendorSession,
  redirectToLoginExpired,
} from '../../utils/authSession';

// ================== Types ==================
interface PurchaseOrderProps {
  user: User;
}

type StatusTab = 'all' | 'created' | 'wip' | 'delivery' | 'cancel' | 'received';
type AttentionFilter = 'updates' | 'delay' | null;

type AttentionRaw = number | 'Need Update' | 'Delay' | null | undefined;
type AttentionNorm = 0 | 1 | 2;
type OrderKey = string | number;

export interface PurchaseOrderItem {
  id?: OrderKey | null;
  purchaseRequisition: string;
  itemOfRequisition: string;
  purchasingDocument: string;
  item: string;
  documentDate: string;
  deliveryDate: string | null;
  etaDate: string | null;
  purchasingDocType: string;
  purchasingGroup: string;
  shortText: string;
  material: string;
  qtyOrder: string | null;
  nameOfSupplier: string;
  quantityReceived: string;
  stillToBeDelivered: string;
  plant: string;
  storageLocation: string;
  order: string | null;
  changedOn: string | null;
  grCreatedDate: string | null;
  remarks: string | null;
  reEtaDate: string | null;
  status: string;
  attention?: AttentionRaw;
}

interface PurchaseOrderSummary {
  TotalPO: number;
  POSubmitted: number;
  POWorkInProgress: number;
  POOnDelivery: number;
  POCancel?: number;
  POPartiallyReceived?: number;
  POFullyReceived: number;
  PONeedUpdate?: number;
  PODelay?: number;
  PONeedUpdateFiltered?: number;
  PODelayFiltered?: number;
  TotalFiltered?: number;
  PageSize?: number;
  PageNumber?: number;
  TotalPages?: number;
  FilterStatus?: string | null;
}

interface PurchaseOrderPagination {
  pageNumber: number;
  pageSize: number;
  totalFiltered: number;
  totalPages: number;
}

type ColumnKey =
  | 'purchaseRequisition'
  | 'itemOfRequisition'
  | 'purchasingDocument'
  | 'item'
  | 'documentDate'
  | 'deliveryDate'
  | 'etaDate'
  | 'purchasingDocType'
  | 'purchasingGroup'
  | 'shortText'
  | 'material'
  | 'qtyOrder'
  | 'nameOfSupplier'
  | 'quantityReceived'
  | 'stillToBeDelivered'
  | 'plant'
  | 'storageLocation'
  | 'order'
  | 'changedOn'
  | 'grCreatedDate'
  | 'remarks'
  | 'reEtaDate'
  | 'attention';

type ColumnVis = Record<ColumnKey, boolean>;
type AnyObj = Record<string, any>;

type MasterOption = {
  value: string;
  text: string;
};

type PurchaseOrderMasterResponse = {
  listStatus: MasterOption[];
  listPlant: MasterOption[];
  listLocation: MasterOption[];
  listDocType: MasterOption[];
  listPurchasingGroup: MasterOption[];
};

type AppliedAdvancedFilters = {
  status: string;
  storageLocation: string;
  plant: string;
  purchasingGroup: string;
  supplier: string;
  purchasingDocType: string;
};

// ================== Constants / Helpers ==================
const STATUS_TAB_TO_PARAM: Partial<Record<Exclude<StatusTab, 'all'>, string>> = {
  created: 'submitted',
  wip: 'workInProgress',
  delivery: 'onDelivery',
  cancel: 'cancel',
  received: 'received',
};

const ATTENTION_UI_TO_BACKEND: Record<Exclude<AttentionFilter, null>, 1 | 2> = {
  updates: 1,
  delay: 2,
};

const ALLOWED_EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

const toArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
const clampUploadProgress = (value: number) => Math.max(0, Math.min(99, value));

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

const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await fetch(input, init);

  if (res.status === 401) {
    redirectToLoginExpired();
    throw new Error('Session expired');
  }

  return res;
};

const parseErrorResponse = async (res: Response): Promise<string> => {
  const text = await res.text();

  try {
    const json = text ? JSON.parse(text) : {};
    return json.message || json.Message || json.error || json.title || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
};

const normalizeItemId = (it: any): OrderKey | null => {
  const v = it?.id ?? it?.ID ?? it?.Id ?? null;
  if (v === null || v === undefined || v === '') return null;
  return v as OrderKey;
};

const getOrderKey = (o: PurchaseOrderItem): OrderKey =>
  o.id !== null && o.id !== undefined && o.id !== '' ? o.id : o.purchasingDocument;

function unwrapPOPayload(json: AnyObj): {
  summary: PurchaseOrderSummary | null;
  pagination: PurchaseOrderPagination | null;
  items: PurchaseOrderItem[];
} {
  const lvl1 = (json?.data ?? json?.Data ?? json?.payload ?? json?.result ?? json) as AnyObj;
  const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;

  const summary = (lvl2?.summary ?? lvl2?.Summary ?? null) as PurchaseOrderSummary | null;

  const paginationFromNode =
    (lvl2?.pagination ?? lvl2?.Pagination ?? null) as PurchaseOrderPagination | null;

  const paginationFromSummary = summary
    ? {
        pageNumber: Number(summary.PageNumber ?? 1),
        pageSize: Number(summary.PageSize ?? 10),
        totalFiltered: Number(summary.TotalFiltered ?? 0),
        totalPages: Number(summary.TotalPages ?? 0),
      }
    : null;

  const pagination = paginationFromNode ?? paginationFromSummary;

  const itemsRaw =
    lvl2?.items ??
    lvl2?.Items ??
    lvl2?.rows ??
    lvl2?.Rows ??
    lvl2?.records ??
    lvl2?.Records ??
    lvl2?.dataList ??
    lvl2?.DataList ??
    lvl2?.list ??
    lvl2?.List ??
    [];

  const items = (Array.isArray(itemsRaw) ? itemsRaw : toArray(itemsRaw)) as PurchaseOrderItem[];

  const normalizedItems = items.map((x: any) => ({
    ...x,
    id: normalizeItemId(x),
    deliveryDate: x?.deliveryDate ?? x?.DeliveryDate ?? x?.['Delivery Date'] ?? null,
    etaDate: x?.etaDate ?? x?.ETADate ?? x?.EtaDate ?? x?.['ETA Date'] ?? null,
    qtyOrder:
      x?.qtyOrder ??
      x?.QtyOrder ??
      x?.['Qty Order'] ??
      x?.quantityOrder ??
      x?.QuantityOrder ??
      x?.orderQty ??
      x?.OrderQty ??
      null,
    reEtaDate:
      x?.reEtaDate ??
      x?.ReEtaDate ??
      x?.['Re-ETA Date'] ??
      x?.latestReEtaDate ??
      x?.LatestReEtaDate ??
      x?.proposedETA ??
      x?.ProposedETA ??
      null,
  })) as PurchaseOrderItem[];

  return { summary, pagination, items: normalizedItems };
}

function unwrapPOMasterPayload(json: AnyObj): PurchaseOrderMasterResponse {
  const lvl1 = (json?.data ?? json?.Data ?? json?.payload ?? json?.result ?? json) as AnyObj;
  const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;

  const normalizeList = (rows: any): MasterOption[] => {
    const arr = Array.isArray(rows) ? rows : toArray(rows);

    return arr
      .map((x: any) => ({
        value: String(x?.value ?? x?.Value ?? '').trim(),
        text: String(x?.text ?? x?.Text ?? x?.value ?? x?.Value ?? '').trim(),
      }))
      .filter((x: MasterOption) => x.value);
  };

  return {
    listStatus: normalizeList(lvl2?.listStatus ?? lvl2?.ListStatus),
    listPlant: normalizeList(lvl2?.listPlant ?? lvl2?.ListPlant),
    listLocation: normalizeList(lvl2?.listLocation ?? lvl2?.ListLocation),
    listDocType: normalizeList(lvl2?.listDocType ?? lvl2?.ListDocType),
    listPurchasingGroup: normalizeList(
      lvl2?.listPurchasingGroup ?? lvl2?.ListPurchasingGroup
    ),
  };
}

const normalizeAttention = (v: AttentionRaw): AttentionNorm => {
  if (v === 1 || v === 2) return v;
  const s = (v ?? '').toString().trim().toLowerCase();
  if (s === 'need update') return 1;
  if (s === 'delay') return 2;
  return 0;
};

const parseDdMmmYyyy = (s?: string | null): Date | null => {
  if (!s) return null;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (!m) return null;

  const day = Number(m[1]);
  const mon = m[2].toLowerCase();
  const year = Number(m[3]);

  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const month = monthMap[mon];
  if (month === undefined) return null;

  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const diffDaysFromToday = (date: Date): number => {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((b - a) / 86400000);
};

const mapBackendStatusToDisplay = (status: string): string => {
  switch ((status || '').trim()) {
    case 'Submitted':
      return 'PO Submitted';
    case 'Work In Progress':
      return 'Work in Progress';
    case 'On Delivery':
      return 'On Delivery';
    case 'Cancel':
      return 'Cancel';
    case 'Partially Received':
    case 'Fully Received':
      return 'Received';
    default:
      return status || '-';
  }
};

const mapDisplayStatusToBackend = (status: string): string | null => {
  const normalized = (status || '').trim().toLowerCase();

  switch (normalized) {
    case 'po submitted':
    case 'submitted':
      return 'submitted';
    case 'work in progress':
      return 'workInProgress';
    case 'on delivery':
      return 'onDelivery';
    case 'cancel':
      return 'cancel';
    case 'received':
      return 'received';
    default:
      return null;
  }
};

const isReceivedBackendStatus = (status: string): boolean => {
  const s = (status || '').trim();
  return s === 'Partially Received' || s === 'Fully Received';
};

const statusColor = (displayStatus: string) => {
  switch (displayStatus) {
    case 'PO Submitted':
      return '#ED832D';
    case 'Work in Progress':
      return '#5C8CB6';
    case 'On Delivery':
      return '#008383';
    case 'Cancel':
      return '#DC2626';
    case 'Received':
      return '#6AA75D';
    default:
      return '#014357';
  }
};

const getInitialAttentionFilterFromQuery = (): AttentionFilter => {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const attraction = params.get('attraction');

  if (attraction === '1') return 'updates';
  if (attraction === '2') return 'delay';

  return null;
};

const syncAttractionQuery = (value: 1 | 2 | null) => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);

  if (value === 1 || value === 2) {
    url.searchParams.set('attraction', String(value));
  } else {
    url.searchParams.delete('attraction');
  }

  window.history.replaceState({}, '', url.toString());
};

const vendorColumns: ColumnVis = {
  purchaseRequisition: false,
  itemOfRequisition: true,
  purchasingDocument: true,
  item: false,
  documentDate: false,
  deliveryDate: true,
  etaDate: true,
  purchasingDocType: false,
  purchasingGroup: false,
  shortText: true,
  material: true,
  qtyOrder: true,
  nameOfSupplier: false,
  quantityReceived: false,
  stillToBeDelivered: false,
  plant: false,
  storageLocation: false,
  order: false,
  changedOn: true,
  grCreatedDate: true,
  remarks: true,
  reEtaDate: true,
  attention: true,
};

const internalColumns: ColumnVis = {
  purchaseRequisition: true,
  itemOfRequisition: true,
  purchasingDocument: true,
  item: true,
  documentDate: true,
  deliveryDate: true,
  etaDate: true,
  purchasingDocType: true,
  purchasingGroup: true,
  shortText: true,
  material: false,
  qtyOrder: true,
  nameOfSupplier: true,
  quantityReceived: true,
  stillToBeDelivered: true,
  plant: true,
  storageLocation: true,
  order: false,
  changedOn: false,
  grCreatedDate: false,
  remarks: false,
  reEtaDate: true,
  attention: true,
};

const initialColumnsForRole = (role: User['role']): ColumnVis =>
  role === 'vendor' ? vendorColumns : internalColumns;

const columnLabel = (k: ColumnKey, role: User['role']) => {
  const map: Record<ColumnKey, string> = {
    purchaseRequisition: 'Purchase Requisition',
    itemOfRequisition: 'Item of Requisition',
    purchasingDocument: 'Purchasing Document',
    item: 'Item',
    documentDate: 'Document Date',
    deliveryDate: 'Delivery Date',
    etaDate: 'ETA Date',
    purchasingDocType: 'Purchasing Doc. Type',
    purchasingGroup: 'Purchasing Group',
    shortText: 'Short Text',
    material: 'Material',
    qtyOrder: 'Qty Order',
    nameOfSupplier: 'Name of Supplier',
    quantityReceived: 'Qty Received',
    stillToBeDelivered: 'Still to be Delivered',
    plant: 'Plant',
    storageLocation: 'Storage Location',
    order: 'Order',
    changedOn: role === 'vendor' ? 'Last Updated' : 'Changed On',
    grCreatedDate: 'GR Created Date',
    remarks: 'Remarks',
    reEtaDate: 'Re-ETA Date',
    attention: 'Attention',
  };
  return map[k];
};

const attentionBadge = (raw: AttentionRaw) => {
  const att = normalizeAttention(raw);

  if (att === 2) {
    return (
      <Badge
        variant="outline"
        className="text-red-600 border-red-600 flex items-center gap-1 bg-red-50 whitespace-nowrap"
      >
        <AlertTriangle className="h-3 w-3" /> Delay
      </Badge>
    );
  }

  if (att === 1) {
    return (
      <Badge
        variant="outline"
        className="text-orange-600 border-orange-600 flex items-center gap-1 bg-orange-50 whitespace-nowrap"
      >
        <Clock className="h-3 w-3" /> Need Update
      </Badge>
    );
  }

  return <span className="text-gray-400">-</span>;
};

const isExcelFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return ALLOWED_EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const dedupeStrings = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter(Boolean).map((v) => String(v).trim()).filter(Boolean)));

const normalizeDisplayStatusOptions = (rows: MasterOption[]): string[] => {
  const mapped = rows.map((x) => mapBackendStatusToDisplay(x.text || x.value));
  return dedupeStrings(mapped);
};

// ================== Component ==================
export function PurchaseOrder({ user }: PurchaseOrderProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<OrderKey | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [specialFilter, setSpecialFilter] = useState<AttentionFilter>(() =>
    getInitialAttentionFilterFromQuery()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [appliedFilters, setAppliedFilters] = useState<AppliedAdvancedFilters>({
    status: '',
    storageLocation: '',
    plant: '',
    purchasingGroup: '',
    supplier: '',
    purchasingDocType: '',
  });

  const [draftFilters, setDraftFilters] = useState<AppliedAdvancedFilters>({
    status: '',
    storageLocation: '',
    plant: '',
    purchasingGroup: '',
    supplier: '',
    purchasingDocType: '',
  });

  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [summary, setSummary] = useState<PurchaseOrderSummary | null>(null);
  const [cardSummary, setCardSummary] = useState<PurchaseOrderSummary | null>(null);
  const [pagination, setPagination] = useState<PurchaseOrderPagination | null>(null);

  const [masterFilters, setMasterFilters] = useState<PurchaseOrderMasterResponse>({
    listStatus: [],
    listPlant: [],
    listLocation: [],
    listDocType: [],
    listPurchasingGroup: [],
  });
  const [loadingMasterFilters, setLoadingMasterFilters] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseOrderItem | null>(null);
  const [updateRemarks, setUpdateRemarks] = useState('');

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<ColumnVis>(() =>
    initialColumnsForRole(user.role)
  );

  const vendorName = useMemo(() => {
    const s = getAuthSession();
    return isVendorSession(s) ? s.vendorName : '';
  }, [user.role]);

  const toggleColumn = useCallback((column: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  }, []);

  const currentAttentionParam: 1 | 2 | null = useMemo(() => {
    return specialFilter ? ATTENTION_UI_TO_BACKEND[specialFilter] : null;
  }, [specialFilter]);

  const resetUploadState = useCallback(() => {
    setUploadFile(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadStatusText('');
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const submitPoStatusUpdate = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetchWithAuth(API.POSTATUS_UPSERT(), {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new Error(
        data?.message || data?.Message || data?.title || 'Failed to update PO status'
      );
    }

    return data;
  }, []);

  useEffect(() => {
    if (isFilterOpen) {
      setDraftFilters(appliedFilters);
    }
  }, [isFilterOpen, appliedFilters]);

  const buildListUrl = useCallback(
    (
      tab: StatusTab,
      attention: 1 | 2 | null,
      pageNumber: number,
      pageSize: number,
      filters: AppliedAdvancedFilters
    ) => {
      const url = new URL(API.SUMMARYPO());

      const tabStatusParam =
        tab === 'all' ? null : STATUS_TAB_TO_PARAM[tab as Exclude<StatusTab, 'all'>] ?? null;

      const filterStatusParam =
        filters.status && filters.status !== 'all'
          ? mapDisplayStatusToBackend(filters.status)
          : null;

      const effectiveStatusParam = filterStatusParam ?? tabStatusParam;

      if (effectiveStatusParam) {
        url.searchParams.set('status', effectiveStatusParam);
      }

      if (attention === 1 || attention === 2) {
        url.searchParams.set('attention', String(attention));
        url.searchParams.set('attraction', String(attention));
      }

      if (user.role === 'vendor' && vendorName) {
        url.searchParams.set('vendorName', vendorName);
      } else if (filters.supplier && filters.supplier !== 'all') {
        url.searchParams.set('vendorName', filters.supplier);
      }

      if (filters.plant && filters.plant !== 'all') {
        url.searchParams.set('plant', filters.plant);
      }

      if (filters.storageLocation && filters.storageLocation !== 'all') {
        url.searchParams.set('storageLocation', filters.storageLocation);
      }

      if (filters.purchasingGroup && filters.purchasingGroup !== 'all') {
        url.searchParams.set('purchasingGroup', filters.purchasingGroup);
      }

      if (filters.purchasingDocType && filters.purchasingDocType !== 'all') {
        url.searchParams.set('purchasingDocType', filters.purchasingDocType);
      }

      url.searchParams.set('pageNumber', String(pageNumber));
      url.searchParams.set('pageSize', String(pageSize));

      return url;
    },
    [user.role, vendorName]
  );

  const buildCardsUrl = useCallback(() => {
    const url = new URL(API.SUMMARYPO());

    if (user.role === 'vendor' && vendorName) {
      url.searchParams.set('vendorName', vendorName);
    }

    return url;
  }, [user.role, vendorName]);

  const buildMasterUrl = useCallback(() => {
    const url = new URL(API.MASTERPO());

    const tabStatusParam =
      activeTab === 'all'
        ? null
        : STATUS_TAB_TO_PARAM[activeTab as Exclude<StatusTab, 'all'>] ?? null;

    const filterStatusParam =
      appliedFilters.status && appliedFilters.status !== 'all'
        ? mapDisplayStatusToBackend(appliedFilters.status)
        : null;

    const effectiveStatusParam = filterStatusParam ?? tabStatusParam;

    if (effectiveStatusParam) {
      url.searchParams.set('status', effectiveStatusParam);
    }

    if (currentAttentionParam === 1 || currentAttentionParam === 2) {
      url.searchParams.set('attention', String(currentAttentionParam));
    }

    if (user.role === 'vendor' && vendorName) {
      url.searchParams.set('vendorName', vendorName);
    } else if (appliedFilters.supplier && appliedFilters.supplier !== 'all') {
      url.searchParams.set('vendorName', appliedFilters.supplier);
    }

    return url;
  }, [activeTab, currentAttentionParam, user.role, vendorName, appliedFilters]);

  const fetchCardSummary = useCallback(async () => {
    try {
      const url = buildCardsUrl();
      const res = await fetchWithAuth(url.toString(), {
        method: 'GET',
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        console.error('[PO] cardSummary HTTP error', msg);
        return;
      }

      const json = await res.json();
      const unwrapped = unwrapPOPayload(json);
      setCardSummary(unwrapped.summary ?? null);
    } catch (e: any) {
      if (e?.message !== 'Session expired') {
        console.error('[PO] cardSummary fetch failed', e);
      }
    }
  }, [buildCardsUrl]);

  const fetchPurchaseOrders = useCallback(
    async (tab: StatusTab, attention: 1 | 2 | null, pageNumber: number, pageSize: number) => {
      setLoading(true);
      setLoadError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const effectiveTab: StatusTab = attention ? 'all' : tab;
      const url = buildListUrl(effectiveTab, attention, pageNumber, pageSize, appliedFilters);

      try {
        const res = await fetchWithAuth(url.toString(), {
          method: 'GET',
          headers: buildAuthHeaders(),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(await parseErrorResponse(res));
        }

        const json = await res.json();
        const unwrapped = unwrapPOPayload(json);

        setSummary(unwrapped.summary ?? null);
        setPagination(unwrapped.pagination ?? null);
        setOrders(Array.isArray(unwrapped.items) ? unwrapped.items : []);
      } catch (err: any) {
        if (err?.message === 'Session expired') {
          return;
        }

        console.error('[PO] list fetch failed:', err);
        const isAbort = err?.name === 'AbortError';

        setLoadError(isAbort ? 'Request timeout. Please try again.' : 'Failed to load purchase orders');
        setSummary(null);
        setOrders([]);
        setPagination(null);
        toast.error(isAbort ? 'Request timeout' : err?.message || 'Failed to load purchase orders');
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    },
    [buildListUrl, appliedFilters]
  );

  const fetchMasterFilters = useCallback(async () => {
    setLoadingMasterFilters(true);

    try {
      const url = buildMasterUrl();
      const res = await fetchWithAuth(url.toString(), {
        method: 'GET',
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();
      const data = unwrapPOMasterPayload(json);

      setMasterFilters(data);
    } catch (err: any) {
      if (err?.message !== 'Session expired') {
        console.error('[PO] master filters fetch failed', err);
        toast.error(err?.message || 'Failed to load filter options');
        setMasterFilters({
          listStatus: [],
          listPlant: [],
          listLocation: [],
          listDocType: [],
          listPurchasingGroup: [],
        });
      }
    } finally {
      setLoadingMasterFilters(false);
    }
  }, [buildMasterUrl]);

  useEffect(() => {
    void fetchCardSummary();
  }, [fetchCardSummary]);

  useEffect(() => {
    void fetchPurchaseOrders(activeTab, currentAttentionParam, currentPage, itemsPerPage);
  }, [activeTab, currentAttentionParam, currentPage, itemsPerPage, fetchPurchaseOrders]);

  useEffect(() => {
    void fetchMasterFilters();
  }, [fetchMasterFilters]);

  const scopedOrders = useMemo(() => {
    let list = orders;

    if (activeTab === 'created') {
      list = list.filter((o) => mapBackendStatusToDisplay(o.status) === 'PO Submitted');
    } else if (activeTab === 'wip') {
      list = list.filter((o) => mapBackendStatusToDisplay(o.status) === 'Work in Progress');
    } else if (activeTab === 'delivery') {
      list = list.filter((o) => mapBackendStatusToDisplay(o.status) === 'On Delivery');
    } else if (activeTab === 'cancel') {
      list = list.filter((o) => mapBackendStatusToDisplay(o.status) === 'Cancel');
    } else if (activeTab === 'received') {
      list = list.filter(
        (o) => isReceivedBackendStatus(o.status) || mapBackendStatusToDisplay(o.status) === 'Received'
      );
    }

    if (specialFilter) {
      const attentionValue = ATTENTION_UI_TO_BACKEND[specialFilter];
      list = list.filter((o) => normalizeAttention(o.attention) === attentionValue);
    }

    return list;
  }, [orders, activeTab, specialFilter]);

  const filterOptions = useMemo(() => {
    const supplierOptions =
      user.role !== 'vendor'
        ? ['all', ...dedupeStrings(scopedOrders.map((o) => o.nameOfSupplier))]
        : [];

    return {
      status: ['all', ...normalizeDisplayStatusOptions(masterFilters.listStatus)],
      storage: ['all', ...dedupeStrings(masterFilters.listLocation.map((x) => x.text || x.value))],
      plant: ['all', ...dedupeStrings(masterFilters.listPlant.map((x) => x.text || x.value))],
      group: [
        'all',
        ...dedupeStrings(masterFilters.listPurchasingGroup.map((x) => x.text || x.value)),
      ],
      supplier: supplierOptions,
      docType: ['all', ...dedupeStrings(masterFilters.listDocType.map((x) => x.text || x.value))],
    };
  }, [masterFilters, scopedOrders, user.role]);

  const filteredOrders = useMemo(() => {
    let list = scopedOrders;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          (o.purchasingDocument ?? '').toLowerCase().includes(q) ||
          (o.purchaseRequisition ?? '').toLowerCase().includes(q) ||
          (o.shortText ?? '').toLowerCase().includes(q) ||
          (o.nameOfSupplier ?? '').toLowerCase().includes(q) ||
          (o.material ?? '').toLowerCase().includes(q) ||
          (o.qtyOrder ?? '').toString().toLowerCase().includes(q) ||
          (o.etaDate ?? '').toLowerCase().includes(q) ||
          (o.reEtaDate ?? '').toLowerCase().includes(q) ||
          mapBackendStatusToDisplay(o.status).toLowerCase().includes(q)
      );
    }

    if (
      appliedFilters.status &&
      appliedFilters.status !== 'all' &&
      appliedFilters.status === 'Received'
    ) {
      list = list.filter(
        (o) => isReceivedBackendStatus(o.status) || mapBackendStatusToDisplay(o.status) === 'Received'
      );
    }

    return list;
  }, [scopedOrders, searchQuery, appliedFilters.status]);

  const delayCount = useMemo(() => {
    const v = cardSummary?.PODelay;
    if (typeof v === 'number') return v;
    return orders.filter((o) => normalizeAttention(o.attention) === 2).length;
  }, [cardSummary, orders]);

  const cancelCount = useMemo(() => {
    const v = summary?.POCancel ?? cardSummary?.POCancel;
    if (typeof v === 'number') return v;
    return orders.filter((o) => mapBackendStatusToDisplay(o.status) === 'Cancel').length;
  }, [summary, cardSummary, orders]);

  const receivedCount = useMemo(() => {
    if (summary) {
      return (summary.POPartiallyReceived ?? 0) + (summary.POFullyReceived ?? 0);
    }

    return orders.filter((o) => isReceivedBackendStatus(o.status)).length;
  }, [summary, orders]);

  const isServerPagination = pagination !== null;

  const totalOrders = isServerPagination ? pagination.totalFiltered : filteredOrders.length;

  const totalPages = isServerPagination
    ? Math.max(1, pagination.totalPages)
    : Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage) || 1);

  const pageOrders = isServerPagination
    ? filteredOrders
    : filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startIndex = totalOrders === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + pageOrders.length, totalOrders);

  const hasActiveFilters = useMemo(
    () =>
      !!(
        (appliedFilters.status && appliedFilters.status !== 'all') ||
        (appliedFilters.storageLocation && appliedFilters.storageLocation !== 'all') ||
        (appliedFilters.plant && appliedFilters.plant !== 'all') ||
        (appliedFilters.purchasingGroup && appliedFilters.purchasingGroup !== 'all') ||
        (user.role !== 'vendor' &&
          appliedFilters.supplier &&
          appliedFilters.supplier !== 'all') ||
        (appliedFilters.purchasingDocType && appliedFilters.purchasingDocType !== 'all')
      ),
    [user.role, appliedFilters]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        appliedFilters.status && appliedFilters.status !== 'all',
        appliedFilters.storageLocation && appliedFilters.storageLocation !== 'all',
        appliedFilters.plant && appliedFilters.plant !== 'all',
        appliedFilters.purchasingGroup && appliedFilters.purchasingGroup !== 'all',
        user.role !== 'vendor' && appliedFilters.supplier && appliedFilters.supplier !== 'all',
        appliedFilters.purchasingDocType && appliedFilters.purchasingDocType !== 'all',
      ].filter(Boolean).length,
    [user.role, appliedFilters]
  );

  const ordersNeedingUpdate = useMemo(() => {
    if (user.role !== 'vendor') return [];

    return filteredOrders
      .filter((o) => {
        const displayStatus = mapBackendStatusToDisplay(o.status);
        if (displayStatus !== 'On Delivery') return false;

        const eta = parseDdMmmYyyy(o.reEtaDate);
        if (!eta) return false;

        const diffDays = diffDaysFromToday(eta);
        return diffDays >= 0 && diffDays <= 2;
      })
      .sort((a, b) => {
        const da = parseDdMmmYyyy(a.reEtaDate);
        const db = parseDdMmmYyyy(b.reEtaDate);

        const va = da ? diffDaysFromToday(da) : 9999;
        const vb = db ? diffDaysFromToday(db) : 9999;

        return va - vb;
      });
  }, [filteredOrders, user.role]);

  const handleSearchChange = useCallback((v: string) => {
    setSearchQuery(v);
    setCurrentPage(1);
  }, []);

  const handleItemsPerPageChange = useCallback((v: string) => {
    setItemsPerPage(Number(v));
    setCurrentPage(1);
  }, []);

  const handleOpenUpdateDialog = useCallback((order: PurchaseOrderItem) => {
    setOrderToUpdate(order);
    setUpdateRemarks('');
    setIsUpdateDialogOpen(true);
  }, []);

  const handleSubmitUpdate = useCallback(async () => {
    try {
      if (!orderToUpdate) {
        toast.error('No purchase order selected');
        return;
      }

      if (!updateRemarks.trim()) {
        toast.error('Please enter update remarks');
        return;
      }

      const idPoItem =
        orderToUpdate.id !== null &&
        orderToUpdate.id !== undefined &&
        orderToUpdate.id !== ''
          ? orderToUpdate.id
          : orderToUpdate.purchasingDocument;

      if (!idPoItem) {
        toast.error('ID PO Item not found');
        return;
      }

      setSubmittingUpdate(true);

      await submitPoStatusUpdate({
        IDPOItem: idPoItem,
        DeliveryUpdate: updateRemarks.trim(),
      });

      toast.success(`Update submitted for PO ${orderToUpdate.purchasingDocument}`);

      setIsUpdateDialogOpen(false);
      setOrderToUpdate(null);
      setUpdateRemarks('');

      await fetchCardSummary();
      await fetchPurchaseOrders(activeTab, currentAttentionParam, currentPage, itemsPerPage);
      await fetchMasterFilters();
    } catch (err: any) {
      if (err?.message !== 'Session expired') {
        console.error('[PO] submit delivery update failed', err);
        toast.error(err?.message || 'Failed to submit update');
      }
    } finally {
      setSubmittingUpdate(false);
    }
  }, [
    orderToUpdate,
    updateRemarks,
    submitPoStatusUpdate,
    fetchCardSummary,
    fetchPurchaseOrders,
    fetchMasterFilters,
    activeTab,
    currentAttentionParam,
    currentPage,
    itemsPerPage,
  ]);

  const clearFilters = useCallback(() => {
    setDraftFilters({
      status: '',
      storageLocation: '',
      plant: '',
      purchasingGroup: '',
      supplier: '',
      purchasingDocType: '',
    });
  }, []);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
    setIsFilterOpen(false);
  }, [draftFilters]);

  const handleTabChange = useCallback((v: string) => {
    setActiveTab(v as StatusTab);
    setSpecialFilter(null);
    syncAttractionQuery(null);
    setCurrentPage(1);
  }, []);

  const handleToggleAttentionCard = useCallback((type: Exclude<AttentionFilter, null>) => {
    setCurrentPage(1);
    setActiveTab('all');

    setSpecialFilter((prev) => {
      const next: AttentionFilter = prev === type ? null : type;
      syncAttractionQuery(next ? ATTENTION_UI_TO_BACKEND[next] : null);
      return next;
    });
  }, []);

  const processFile = useCallback((file: File | null, input?: HTMLInputElement | null) => {
    if (!file) {
      setUploadFile(null);
      if (input) input.value = '';
      return;
    }

    if (!isExcelFile(file)) {
      toast.error('File must be an Excel file (.xlsx or .xls)');
      setUploadFile(null);
      if (input) input.value = '';
      return;
    }

    setUploadFile(file);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      processFile(file, e.target);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0] || null;
      processFile(file);
    },
    [processFile]
  );

  const handleSubmitUploadPO = useCallback(async () => {
    if (!uploadFile) {
      toast.error('Please select an Excel file first');
      return;
    }

    if (!isExcelFile(uploadFile)) {
      toast.error('File must be an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText('Preparing upload....');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const token = getAuthToken();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API.IMPORT_PO(), true);

        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onloadstart = () => {
          setUploadProgress(0);
          setUploadStatusText('Starting upload...');
        };

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const rawPercent = Math.round((event.loaded / event.total) * 100);
            const percent = clampUploadProgress(rawPercent);
            setUploadProgress(percent);
            setUploadStatusText(`Uploading... ${percent}%`);
          } else {
            setUploadStatusText('Uploading...');
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
            if (xhr.status === 401) {
              redirectToLoginExpired();
              reject(new Error('Session expired'));
              return;
            }

            setUploadProgress(99);
            setUploadStatusText('Processing file on server...');
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error while uploading file'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload timeout'));
        };

        xhr.onload = () => {
          if (xhr.status === 401) {
            redirectToLoginExpired();
            reject(new Error('Session expired'));
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            setUploadStatusText('Upload completed');
            resolve();
            return;
          }

          let msg = `Upload failed (HTTP ${xhr.status})`;

          try {
            const json = JSON.parse(xhr.responseText);
            if (json?.message || json?.Message || json?.error) {
              msg = json.message || json.Message || json.error;
            }
          } catch {
            if (xhr.responseText) {
              msg = xhr.responseText;
            }
          }

          reject(new Error(msg));
        };

        xhr.send(formData);
      });

      toast.success('Purchase order data imported successfully');

      setUploadProgress(100);
      setUploadStatusText('Upload completed');

      await new Promise((resolve) => setTimeout(resolve, 400));

      setUploadStatusText('Refreshing data...');

      await fetchCardSummary();
      await fetchPurchaseOrders(activeTab, currentAttentionParam, currentPage, itemsPerPage);
      await fetchMasterFilters();

      setIsUploadDialogOpen(false);
      resetUploadState();
    } catch (err: any) {
      if (err?.message !== 'Session expired') {
        console.error('[PO] import failed', err);
        toast.error(err?.message || 'Failed to import purchase order data');
        setUploadStatusText('');
      }
    } finally {
      setUploading(false);
    }
  }, [
    uploadFile,
    fetchPurchaseOrders,
    fetchCardSummary,
    fetchMasterFilters,
    activeTab,
    currentAttentionParam,
    currentPage,
    itemsPerPage,
    resetUploadState,
  ]);

  const handleDownloadTemplate = useCallback(() => {
    try {
      const me2nHeaders = [
        'Purchase Requisition',
        'Item of requisition',
        'Purchasing Document',
        'Item',
        'Document Date',
        'Delivery date',
        'Purchasing Doc. Type',
        'Purchasing Group',
        'Short Text',
        'Material',
        'Qty Order',
        'Name of Supplier',
        'Quantity Received',
        'Still to be delivered (qty)',
        'Plant',
        'Storage location',
      ];

      const zmm013rHeaders = [
        'Purchase Order',
        'Purchase Requisition',
        'Purchase Order Item',
        'GR Created Date',
      ];

      const me5aHeaders = [
        'Order',
        'Changed On',
        'Purchase order',
        'Purchase Requisition',
        'Item of requisition',
        'Material',
        'Purchase Order Date',
        'Created by',
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([me2nHeaders]), 'ME2N');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([me5aHeaders]), 'ME5A');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([zmm013rHeaders]), 'ZMM013R');

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();

      XLSX.writeFile(wb, `TemplatePO_${dd}-${mm}-${yyyy}.xlsx`);
      toast.success('Template downloaded');
    } catch (err) {
      console.error('[PO] template export failed', err);
      toast.error('Failed to download template');
    }
  }, []);

  const handleDownloadPOData = useCallback(() => {
    try {
      const orderedKeys: ColumnKey[] = [
        'purchaseRequisition',
        'itemOfRequisition',
        'purchasingDocument',
        'item',
        'documentDate',
        'deliveryDate',
        'etaDate',
        'purchasingDocType',
        'purchasingGroup',
        'shortText',
        'material',
        'qtyOrder',
        'nameOfSupplier',
        'quantityReceived',
        'stillToBeDelivered',
        'plant',
        'storageLocation',
        'order',
        'changedOn',
        'grCreatedDate',
        'remarks',
        'reEtaDate',
        'attention',
      ];

      const cols = orderedKeys.filter((k) => visibleColumns[k]);
      const headers = cols.map((k) => columnLabel(k, user.role)).concat(['Status']);

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '';

        if (typeof v === 'number' || typeof v === 'string') {
          const att = normalizeAttention(v as AttentionRaw);
          if (att === 1) return 'Need Update';
          if (att === 2) return 'Delay';
        }

        const s = String(v);
        const escaped = s.replace(/"/g, '""');
        if (/[",\n]/.test(escaped)) return `"${escaped}"`;
        return escaped;
      };

      const rows = filteredOrders.map((o) => {
        const row = cols.map((k) => escapeCell((o as any)[k]));
        row.push(escapeCell(mapBackendStatusToDisplay(o.status)));
        return row.join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const filename = `PO_(${dd}-${mm}-${yyyy}).csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export complete');
    } catch (err) {
      console.error('[PO] export failed', err);
      toast.error('Failed to export PO data');
    }
  }, [filteredOrders, visibleColumns, user.role]);

  const columns = useMemo(() => {
    const mk = (key: ColumnKey, render?: (o: PurchaseOrderItem) => React.ReactNode) => ({
      key,
      label: columnLabel(key, user.role),
      visible: visibleColumns[key],
      render: render ?? ((o: PurchaseOrderItem) => (o as any)[key] ?? '-'),
    });

    return [
      mk('purchaseRequisition', (o) => <span className="font-medium">{o.purchaseRequisition}</span>),
      mk('itemOfRequisition', (o) => o.itemOfRequisition),
      mk('purchasingDocument', (o) => <span className="font-medium">{o.purchasingDocument}</span>),
      mk('item', (o) => o.item),
      mk('documentDate', (o) => <span className="text-sm text-gray-600">{o.documentDate}</span>),
      mk('deliveryDate', (o) => <span className="text-sm text-gray-600">{o.deliveryDate || '-'}</span>),
      mk('etaDate', (o) => <span className="text-sm text-gray-600">{o.etaDate || '-'}</span>),
      mk('purchasingDocType', (o) => o.purchasingDocType),
      mk('purchasingGroup', (o) => o.purchasingGroup),
      mk('shortText', (o) => <span className="max-w-xs truncate block">{o.shortText}</span>),
      mk('material', (o) => <span className="text-sm text-gray-600">{o.material}</span>),
      mk('qtyOrder', (o) => <span className="text-right block">{o.qtyOrder || '-'}</span>),
      mk('nameOfSupplier', (o) => o.nameOfSupplier),
      mk('quantityReceived', (o) => <span className="text-right block">{o.quantityReceived}</span>),
      mk('stillToBeDelivered', (o) => (
        <span className="text-right block">{o.stillToBeDelivered}</span>
      )),
      mk('plant', (o) => o.plant),
      mk('storageLocation', (o) => o.storageLocation),
      mk('order', (o) => <span className="text-sm text-gray-600">{o.order || '-'}</span>),
      mk('changedOn', (o) => <span className="text-sm text-gray-600">{o.changedOn || '-'}</span>),
      mk('grCreatedDate', (o) => (
        <span className="text-sm text-gray-600">{o.grCreatedDate || '-'}</span>
      )),
      mk('remarks', (o) => <span className="max-w-xs truncate block">{o.remarks || '-'}</span>),
      mk('reEtaDate', (o) => <span className="text-sm text-gray-600">{o.reEtaDate || '-'}</span>),
      mk('attention', (o) => attentionBadge(o.attention)),
    ];
  }, [user.role, visibleColumns]);

  const renderTable = useCallback(
    () => (
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns
                  .filter((c) => c.visible)
                  .map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}

                <TableHead className="sticky right-[100px] bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                  Status
                </TableHead>
                <TableHead className="sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageOrders.map((o, idx) => {
                const display = mapBackendStatusToDisplay(o.status);
                const key = getOrderKey(o);

                return (
                  <TableRow key={`${key}-${idx}`}>
                    {columns
                      .filter((c) => c.visible)
                      .map((c) => (
                        <TableCell key={c.key}>{c.render(o)}</TableCell>
                      ))}

                    <TableCell className="sticky right-[100px] bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                      <Badge
                        className="min-w-[120px] justify-center"
                        style={{ backgroundColor: statusColor(display), color: 'white' }}
                      >
                        {display}
                      </Badge>
                    </TableCell>

                    <TableCell className="sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrderId(key);
                        }}
                        style={{ borderColor: '#014357', color: '#014357' }}
                        className="hover:bg-gray-50 min-w-[80px]"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalOrders > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap">Rows per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
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
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>

                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;

                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }

                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return <PaginationEllipsis key={page} />;
                  }

                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {totalOrders === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalOrders)} of{' '}
              {totalOrders} results
            </div>
          </div>
        )}
      </Card>
    ),
    [
      columns,
      pageOrders,
      totalOrders,
      totalPages,
      currentPage,
      startIndex,
      endIndex,
      itemsPerPage,
      handleItemsPerPageChange,
    ]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-x-hidden">
      {selectedOrderId !== null ? (
        <PurchaseOrderDetail user={user} orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      ) : (
        <>
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2" style={{ color: '#014357' }}>
              Purchase Orders
            </h1>
            <p className="text-gray-600">Track and manage all purchase orders</p>
          </div>

          {loading && <div className="mb-4 text-sm text-gray-500">Loading purchase orders...</div>}
          {loadError && <div className="mb-4 text-sm text-red-600">{loadError}</div>}

          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search purchase orders..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {user.role === 'admin' && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-none" size="sm" onClick={handleDownloadTemplate}>
                  <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Template</span>
                </Button>

                <Button variant="outline" className="flex-1 sm:flex-none" size="sm" onClick={handleDownloadPOData}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>

                <Button
                  style={{ backgroundColor: '#014357' }}
                  className="text-white hover:opacity-90 flex-1 sm:flex-none"
                  size="sm"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Upload PO</span>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <Card
              className={[
                'p-4 shadow-[0_2px_4px_rgba(220,38,38,0.25)] border-0 cursor-pointer transition-all w-full',
                specialFilter === 'delay' ? 'overdue-active' : '',
              ].join(' ')}
              style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
              onClick={() => handleToggleAttentionCard('delay')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <AlertTriangle className="h-4 w-4" style={{ color: '#DC2626' }} />
                  </div>
                  <div className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>
                    Delay
                  </div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#DC2626', fontWeight: 800 }}>
                  {delayCount}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex gap-3 mb-6 flex-wrap">
            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Package className="h-4 w-4" style={{ color: '#014357' }} />
                </div>
                <div className="text-gray-600 text-sm">Total PO Items</div>
              </div>
              <div className="text-3xl" style={{ color: '#014357' }}>
                {summary?.TotalPO ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}
                >
                  <FilePlus className="h-4 w-4" style={{ color: '#ED832D' }} />
                </div>
                <div className="text-gray-600 text-sm">PO Submitted</div>
              </div>
              <div className="text-3xl" style={{ color: '#ED832D' }}>
                {summary?.POSubmitted ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(92, 140, 182, 0.1)' }}>
                  <Loader className="h-4 w-4" style={{ color: '#5C8CB6' }} />
                </div>
                <div className="text-gray-600 text-sm">Work in Progress</div>
              </div>
              <div className="text-3xl" style={{ color: '#5C8CB6' }}>
                {summary?.POWorkInProgress ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}>
                  <Truck className="h-4 w-4" style={{ color: '#008383' }} />
                </div>
                <div className="text-gray-600 text-sm">On Delivery</div>
              </div>
              <div className="text-3xl" style={{ color: '#008383' }}>
                {summary?.POOnDelivery ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                  <Ban className="h-4 w-4" style={{ color: '#DC2626' }} />
                </div>
                <div className="text-gray-600 text-sm">Cancel</div>
              </div>
              <div className="text-3xl" style={{ color: '#DC2626' }}>
                {cancelCount}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(106, 167, 93, 0.1)' }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: '#6AA75D' }} />
                </div>
                <div className="text-gray-600 text-sm">Received</div>
              </div>
              <div className="text-3xl" style={{ color: '#6AA75D' }}>
                {receivedCount}
              </div>
            </Card>
          </div>

          {user.role === 'vendor' && ordersNeedingUpdate.length > 0 && (
            <Card className="mb-6 p-6" style={{ borderColor: '#ED832D', borderWidth: '2px' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5" style={{ color: '#ED832D' }} />
                <h2 style={{ color: '#014357' }}>Orders Needing Update</h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                These orders have a Re-ETA Date within 2 days. Please provide updates on their delivery
                status.
              </p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchasing Document</TableHead>
                      <TableHead>Short Text</TableHead>
                      <TableHead>ETA Date</TableHead>
                      <TableHead>Re-ETA Date</TableHead>
                      <TableHead>Days Until Re-ETA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {ordersNeedingUpdate.map((o, idx) => {
                      const d = parseDdMmmYyyy(o.reEtaDate);
                      const diffDays = d ? diffDaysFromToday(d) : null;
                      const display = mapBackendStatusToDisplay(o.status);

                      return (
                        <TableRow key={`${getOrderKey(o)}-${idx}`}>
                          <TableCell className="font-medium">{o.purchasingDocument}</TableCell>
                          <TableCell>{o.shortText}</TableCell>
                          <TableCell>{o.etaDate || '-'}</TableCell>
                          <TableCell>{o.reEtaDate || '-'}</TableCell>
                          <TableCell>
                            {diffDays === null ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <Badge
                                style={{
                                  backgroundColor: diffDays === 0 ? '#d4183d' : '#ED832D',
                                  color: 'white',
                                }}
                              >
                                {diffDays === 0 ? 'Today' : `${diffDays} day${diffDays > 1 ? 's' : ''}`}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge style={{ backgroundColor: statusColor(display), color: 'white' }}>
                              {display}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => handleOpenUpdateDialog(o)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Update
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="created">PO Submitted</TabsTrigger>
                <TabsTrigger value="wip">Work in Progress</TabsTrigger>
                <TabsTrigger value="delivery">On Delivery</TabsTrigger>
                <TabsTrigger value="cancel">Cancel</TabsTrigger>
                <TabsTrigger value="received">Received</TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Columns3 className="h-4 w-4 mr-2" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] max-h-[500px]" align="end">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Customize Table View</h4>
                        <p className="text-xs text-gray-500">Show or hide columns. Some cannot be hidden.</p>
                      </div>

                      <ScrollArea className="h-[320px]">
                        <div className="space-y-2 pr-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="col-purchasingDocument" checked={visibleColumns.purchasingDocument} disabled />
                            <label
                              htmlFor="col-purchasingDocument"
                              className="text-sm cursor-not-allowed text-gray-700"
                            >
                              Purchasing Document
                            </label>
                          </div>

                          {user.role !== 'vendor' && (
                            <div className="flex items-center space-x-2">
                              <Checkbox id="col-item" checked={visibleColumns.item} disabled />
                              <label htmlFor="col-item" className="text-sm cursor-not-allowed text-gray-700">
                                Item
                              </label>
                            </div>
                          )}

                          <Separator className="my-3" />

                          {(Object.keys(visibleColumns) as ColumnKey[])
                            .filter((k) => !['purchasingDocument', 'item'].includes(k))
                            .map((k) => (
                              <div key={k} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`col-${k}`}
                                  checked={visibleColumns[k]}
                                  onCheckedChange={() => toggleColumn(k)}
                                />
                                <label htmlFor={`col-${k}`} className="text-sm cursor-pointer">
                                  {columnLabel(k, user.role)}
                                </label>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>

                <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {hasActiveFilters && (
                        <Badge
                          variant="secondary"
                          className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                          style={{ backgroundColor: '#ED832D', color: 'white' }}
                        >
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Advanced Filters</DialogTitle>
                      <DialogDescription>Filter purchase orders by multiple criteria</DialogDescription>
                    </DialogHeader>

                    {loadingMasterFilters && (
                      <div className="py-2 text-sm text-gray-500">Loading filter options...</div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select
                          value={draftFilters.status}
                          onValueChange={(v) => setDraftFilters((prev) => ({ ...prev, status: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.status.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === 'all' ? 'All' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Storage Location</Label>
                        <Select
                          value={draftFilters.storageLocation}
                          onValueChange={(v) =>
                            setDraftFilters((prev) => ({ ...prev, storageLocation: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All storage locations" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.storage.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === 'all' ? 'All' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Plant</Label>
                        <Select
                          value={draftFilters.plant}
                          onValueChange={(v) => setDraftFilters((prev) => ({ ...prev, plant: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All plants" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.plant.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === 'all' ? 'All' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Purchasing Group</Label>
                        <Select
                          value={draftFilters.purchasingGroup}
                          onValueChange={(v) =>
                            setDraftFilters((prev) => ({ ...prev, purchasingGroup: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All groups" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.group.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === 'all' ? 'All' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {user.role !== 'vendor' && (
                        <div className="grid gap-2">
                          <Label>Supplier</Label>
                          <Select
                            value={draftFilters.supplier}
                            onValueChange={(v) => setDraftFilters((prev) => ({ ...prev, supplier: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All suppliers" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions.supplier.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt === 'all' ? 'All' : opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label>Doc Type</Label>
                        <Select
                          value={draftFilters.purchasingDocType}
                          onValueChange={(v) =>
                            setDraftFilters((prev) => ({ ...prev, purchasingDocType: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All document types" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.docType.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === 'all' ? 'All' : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={clearFilters} className="flex-1">
                        <X className="h-4 w-4 mr-2" />
                        Clear Filters
                      </Button>
                      <Button
                        style={{ backgroundColor: '#014357' }}
                        className="text-white hover:opacity-90 flex-1"
                        onClick={handleApplyFilters}
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <TabsContent value="all">{renderTable()}</TabsContent>
            <TabsContent value="created">{renderTable()}</TabsContent>
            <TabsContent value="wip">{renderTable()}</TabsContent>
            <TabsContent value="delivery">{renderTable()}</TabsContent>
            <TabsContent value="cancel">{renderTable()}</TabsContent>
            <TabsContent value="received">{renderTable()}</TabsContent>
          </Tabs>

          <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle style={{ color: '#014357' }}>Update Purchase Order</DialogTitle>
                <DialogDescription>
                  Provide updates for the delivery status of this purchase order
                </DialogDescription>
                {orderToUpdate && (
                  <div className="flex items-center gap-2 pt-2">
                    <Badge
                      style={{
                        backgroundColor: statusColor(mapBackendStatusToDisplay(orderToUpdate.status)),
                        color: 'white',
                      }}
                      className="px-4 py-1.5"
                    >
                      {mapBackendStatusToDisplay(orderToUpdate.status)}
                    </Badge>
                  </div>
                )}
              </DialogHeader>

              {orderToUpdate && (
                <>
                  <ScrollArea className="max-h-[calc(85vh-220px)] pr-4">
                    <div className="space-y-6 py-2">
                      <div>
                        <div
                          className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                          style={{ borderColor: '#014357' }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#014357' }} />
                          <h3 className="text-lg tracking-wide" style={{ color: '#014357' }}>
                            Order Information
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Purchasing Document
                            </p>
                            <p className="text-sm">{orderToUpdate.purchasingDocument}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Item of Requisition
                            </p>
                            <p className="text-sm">{orderToUpdate.itemOfRequisition}</p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Short Text
                            </p>
                            <p className="text-sm">{orderToUpdate.shortText}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">ETA Date</p>
                            <p className="text-sm">{orderToUpdate.etaDate || 'N/A'}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Re-ETA Date
                            </p>
                            <p className="text-sm">{orderToUpdate.reEtaDate || 'N/A'}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Qty Order</p>
                            <p className="text-sm">{orderToUpdate.qtyOrder || 'N/A'}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Attention</p>
                            <div className="pt-0.5">{attentionBadge(orderToUpdate.attention)}</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div
                          className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                          style={{ borderColor: '#014357' }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#014357' }} />
                          <h3 className="text-lg tracking-wide" style={{ color: '#014357' }}>
                            Update Details
                          </h3>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="update-remarks">Remarks / Additional Information</Label>
                          <Textarea
                            id="update-remarks"
                            value={updateRemarks}
                            onChange={(e) => setUpdateRemarks(e.target.value)}
                            placeholder="Enter any additional notes or comments about this delivery..."
                            rows={6}
                            className="resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      style={{ backgroundColor: '#014357' }}
                      className="text-white hover:opacity-90"
                      onClick={handleSubmitUpdate}
                      disabled={submittingUpdate}
                    >
                      {submittingUpdate ? 'Submitting...' : 'Submit Update'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={(open) => {
              setIsUploadDialogOpen(open);
              if (!open) {
                resetUploadState();
              }
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle style={{ color: '#014357' }}>Upload Purchase Order</DialogTitle>
                <DialogDescription>
                  Upload Excel file yang berisi 3 sheet: <b>ME2N</b>, <b>ME5A</b>, dan <b>ZMM013R</b>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Label>Excel File (.xlsx / .xls)</Label>

                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    if (uploading) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    if (uploading) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    if (uploading) return;
                    handleDrop(e);
                  }}
                  className={[
                    'border-2 border-dashed rounded-lg p-6 text-center transition',
                    'flex flex-col items-center justify-center gap-2',
                    uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                    isDragOver
                      ? 'border-[#014357] bg-slate-50'
                      : 'border-slate-300 bg-slate-50/40 hover:border-[#014357]/70 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Upload className="h-8 w-8 mb-1" style={{ color: '#014357' }} />
                  <p className="text-sm font-medium" style={{ color: '#014357' }}>
                    Drag &amp; drop Excel file di sini
                  </p>
                  <p className="text-xs text-gray-500">
                    atau <span className="underline">klik untuk memilih file</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Hanya format <b>.xlsx</b> atau <b>.xls</b> yang diperbolehkan.
                  </p>

                  <input
                    ref={fileInputRef}
                    id="po-file"
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {uploadFile && (
                  <div className="mt-1 flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" style={{ color: '#014357' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[180px]">
                          {uploadFile.name}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {(uploadFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={uploading}
                      onClick={() => {
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{uploadStatusText || 'Uploading...'}</span>
                      <span className="font-medium" style={{ color: '#014357' }}>
                        {uploadProgress}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${uploadProgress}%`,
                          backgroundColor: '#014357',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={uploading}>
                  Cancel
                </Button>

                <Button
                  style={{ backgroundColor: '#014357' }}
                  className="text-white hover:opacity-90"
                  onClick={handleSubmitUploadPO}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}