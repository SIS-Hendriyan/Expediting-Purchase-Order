// src/components/pages/PurchaseOrder.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  Search, Upload, Download, Filter, FileSpreadsheet, X, Columns3, Eye,
  Package, FilePlus, Loader, Truck, CheckCircle2, AlertCircle, Pencil,
  Clock, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis
} from '../ui/pagination';

import type { User } from './Login';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { API } from '../../config';

import {
  getAuthSession,
  getAccessToken,
  isVendorSession,
  isInternalSession,
} from '../../utils/authSession';

// ================== Types ==================
interface PurchaseOrderProps { user: User; }

type StatusTab = 'all' | 'created' | 'wip' | 'delivery' | 'partially' | 'delivered';
type AttentionFilter = 'updates' | 'overdue' | null;

type AttentionRaw = number | 'Need Update' | 'Overdue' | null | undefined;
type AttentionNorm = 0 | 1 | 2;

export interface PurchaseOrderItem {
  purchaseRequisition: string;
  itemOfRequisition: string;
  purchasingDocument: string;
  item: string;
  documentDate: string;
  deliveryDate: string;
  purchasingDocType: string;
  purchasingGroup: string;
  shortText: string;
  material: string;
  nameOfSupplier: string;
  quantityReceived: string;
  stillToBeDelivered: string;
  plant: string;
  storageLocation: string;
  order: string | null;
  changedOn: string | null;
  grCreatedDate: string | null;
  remarks: string | null;
  reEtaDate: string | null;  // dd-MMM-yyyy from SP
  status: string;            // backend raw
  attention?: AttentionRaw;
}

interface PurchaseOrderSummary {
  TotalPO: number;
  POSubmitted: number;
  POWorkInProgress: number;
  POOnDelivery: number;
  POPartiallyReceived: number;
  POFullyReceived: number;

  PONeedUpdate?: number;
  POOverdue?: number;
  PONeedUpdateFiltered?: number;
  POOverdueFiltered?: number;

  TotalFiltered?: number;
  PageSize?: number;
  FilterStatus?: string | null;
}

type ColumnKey =
  | 'purchaseRequisition'
  | 'itemOfRequisition'
  | 'purchasingDocument'
  | 'item'
  | 'documentDate'
  | 'deliveryDate'
  | 'purchasingDocType'
  | 'purchasingGroup'
  | 'shortText'
  | 'material'
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

// ================== Constants / Helpers ==================
const STATUS_TAB_TO_PARAM: Record<Exclude<StatusTab, 'all'>, string> = {
  created: 'submitted',
  wip: 'workInProgress',
  delivery: 'onDelivery',
  partially: 'partiallyReceived',
  delivered: 'fullyReceived',
};

const ATTENTION_UI_TO_BACKEND: Record<Exclude<AttentionFilter, null>, 1 | 2> = {
  updates: 1,
  overdue: 2,
};

const ALLOWED_EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

const toArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);

function unwrapPOPayload(json: AnyObj): { summary: PurchaseOrderSummary | null; items: PurchaseOrderItem[] } {
  const lvl1 = (json?.data ?? json?.Data ?? json?.payload ?? json?.result ?? json) as AnyObj;
  const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;
  const summary = (lvl2?.summary ?? lvl2?.Summary ?? null) as PurchaseOrderSummary | null;

  const itemsRaw =
    lvl2?.items ?? lvl2?.Items ?? lvl2?.rows ?? lvl2?.Rows ??
    lvl2?.records ?? lvl2?.Records ?? lvl2?.dataList ?? lvl2?.DataList ??
    lvl2?.list ?? lvl2?.List ?? [];

  const items = (Array.isArray(itemsRaw) ? itemsRaw : toArray(itemsRaw)) as PurchaseOrderItem[];
  return { summary, items };
}

const eqCI = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const normalizeAttention = (v: AttentionRaw): AttentionNorm => {
  if (v === 1 || v === 2) return v;
  const s = (v ?? '').toString().trim().toLowerCase();
  if (s === 'need update') return 1;
  if (s === 'overdue') return 2;
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
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
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
    case 'Submitted': return 'PO Created';
    case 'Work In Progress': return 'Work in Progress';
    case 'On Delivery': return 'On Delivery';
    case 'Partially Received': return 'Partially Received';
    case 'Fully Received': return 'Fully Received';
    default: return status || '-';
  }
};

const statusColor = (displayStatus: string) => {
  switch (displayStatus) {
    case 'PO Created': return '#ED832D';
    case 'Work in Progress': return '#5C8CB6';
    case 'On Delivery': return '#008383';
    case 'Partially Received': return '#F59E0B';
    case 'Fully Received': return '#6AA75D';
    default: return '#014357';
  }
};

// ---- Auth helpers ----
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

// ---- Column defaults ----
const vendorColumns: ColumnVis = {
  purchaseRequisition: false,
  itemOfRequisition: true,
  purchasingDocument: true,
  item: false,
  documentDate: false,
  deliveryDate: true,
  purchasingDocType: false,
  purchasingGroup: false,
  shortText: true,
  material: true,
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
  purchasingDocType: true,
  purchasingGroup: true,
  shortText: true,
  material: false,
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
    purchasingDocType: 'Purchasing Doc. Type',
    purchasingGroup: 'Purchasing Group',
    shortText: 'Short Text',
    material: 'Material',
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
        <AlertTriangle className="h-3 w-3" /> Overdue
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
  return ALLOWED_EXCEL_EXTENSIONS.some(ext => name.endsWith(ext));
};

// ================== Component ==================
export function PurchaseOrder({ user }: PurchaseOrderProps) {
  // View state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Tabs + special attention filter
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [specialFilter, setSpecialFilter] = useState<AttentionFilter>(null);

  // UI / filters / pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [filterStatus, setFilterStatus] = useState(''); // display text
  const [filterStorage, setFilterStorage] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDocType, setFilterDocType] = useState('');

  // Data
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [summary, setSummary] = useState<PurchaseOrderSummary | null>(null);

  // Network
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Update dialog
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseOrderItem | null>(null);
  const [updateRemarks, setUpdateRemarks] = useState('');

  // Upload PO dialog
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<ColumnVis>(() => initialColumnsForRole(user.role));
  const toggleColumn = useCallback((column: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  }, []);

  // Session debug (optional)
  useEffect(() => {
    const s = getAuthSession();
    if (isVendorSession(s)) console.debug('[PO] VENDOR session:', s.vendorName, s.id);
    if (isInternalSession(s)) console.debug('[PO] INTERNAL session:', s.role, s.id);
  }, []);

  // ----- URL builder (single source of truth) -----
  const buildSummaryUrl = useCallback((tab: StatusTab, attention: 1 | 2 | null) => {
    const url = new URL(API.SUMMARYPO());

    const statusParam =
      tab === 'all' ? null : STATUS_TAB_TO_PARAM[tab as Exclude<StatusTab, 'all'>];

    if (statusParam) url.searchParams.set('status', statusParam);

    if (attention === 1 || attention === 2) {
      // compatibility: backend might expect attention OR attraction
      url.searchParams.set('attention', String(attention));
      url.searchParams.set('attraction', String(attention));
    }

    return { url, statusParam };
  }, []);

  // ----- Fetch orders -----
  const fetchPurchaseOrders = useCallback(async (tab: StatusTab, attention: 1 | 2 | null) => {
    setLoading(true);
    setLoadError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const { url, statusParam } = buildSummaryUrl(tab, attention);

    console.debug('[PO] request:', {
      url: url.toString(),
      tab,
      statusParam,
      attention,
      headers: { hasAuth: !!getAuthToken() },
    });

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: buildAuthHeaders(),
        signal: controller.signal,
      });

      if (!res.ok) {
        let body: any = undefined;
        try {
          const text = await res.text();
          body = (() => { try { return JSON.parse(text); } catch { return text; } })();
        } catch { /* ignore */ }

        console.error('[PO] HTTP error', res.status, body);
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const unwrapped = unwrapPOPayload(json);

      setSummary(unwrapped.summary ?? null);
      setOrders(Array.isArray(unwrapped.items) ? unwrapped.items : []);
      setCurrentPage(1);

      console.debug('[PO] loaded:', {
        rows: Array.isArray(unwrapped.items) ? unwrapped.items.length : 0,
        hasSummary: !!unwrapped.summary,
      });
    } catch (err: any) {
      console.error('[PO] fetch failed:', err);
      const isAbort = err?.name === 'AbortError';
      setLoadError(isAbort ? 'Request timeout. Please try again.' : 'Failed to load purchase orders');
      setSummary(null);
      setOrders([]);
      toast.error(isAbort ? 'Request timeout' : 'Failed to load purchase orders');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [buildSummaryUrl]);

  // Fetch on tab change (attention handled by cards)
  useEffect(() => {
    fetchPurchaseOrders(activeTab, null);
  }, [activeTab, fetchPurchaseOrders]);

  // ----- Scoped for vendor -----
  const scopedOrders = useMemo(() => {
    if (user.role !== 'vendor') return orders;
    if (!user.company) return orders;
    return orders.filter(o => eqCI(o.nameOfSupplier, user.company));
  }, [orders, user.role, user.company]);

  // ----- Filter options -----
  const filterOptions = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.filter(Boolean).map(v => String(v)))) as string[];

    return {
      storage: ['all', ...uniq(scopedOrders.map(o => o.storageLocation))],
      plant: ['all', ...uniq(scopedOrders.map(o => o.plant))],
      group: ['all', ...uniq(scopedOrders.map(o => o.purchasingGroup))],
      supplier: ['all', ...uniq(scopedOrders.map(o => o.nameOfSupplier))],
      docType: ['all', ...uniq(scopedOrders.map(o => o.purchasingDocType))],
    };
  }, [scopedOrders]);

  // ----- Search + Filters -----
  const filteredOrders = useMemo(() => {
    let list = scopedOrders;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        (o.purchasingDocument ?? '').toLowerCase().includes(q) ||
        (o.purchaseRequisition ?? '').toLowerCase().includes(q) ||
        (o.shortText ?? '').toLowerCase().includes(q) ||
        (o.nameOfSupplier ?? '').toLowerCase().includes(q) ||
        (o.material ?? '').toLowerCase().includes(q)
      );
    }

    if (filterStatus && filterStatus !== 'all') {
      list = list.filter(o => mapBackendStatusToDisplay(o.status) === filterStatus);
    }
    if (filterStorage && filterStorage !== 'all') {
      list = list.filter(o => (o.storageLocation ?? '') === filterStorage);
    }
    if (filterPlant && filterPlant !== 'all') {
      list = list.filter(o => (o.plant ?? '') === filterPlant);
    }
    if (filterGroup && filterGroup !== 'all') {
      list = list.filter(o => (o.purchasingGroup ?? '') === filterGroup);
    }
    if (filterSupplier && filterSupplier !== 'all') {
      list = list.filter(o => (o.nameOfSupplier ?? '') === filterSupplier);
    }
    if (filterDocType && filterDocType !== 'all') {
      list = list.filter(o => (o.purchasingDocType ?? '') === filterDocType);
    }

    return list;
  }, [
    scopedOrders, searchQuery,
    filterStatus, filterStorage, filterPlant,
    filterGroup, filterSupplier, filterDocType
  ]);

  // ----- Counts (prefer summary) -----
  const needUpdateCount = useMemo(() => {
    const s = summary?.PONeedUpdateFiltered ?? summary?.PONeedUpdate;
    if (typeof s === 'number') return s;
    return filteredOrders.filter(o => normalizeAttention(o.attention) === 1).length;
  }, [summary, filteredOrders]);

  const overdueCount = useMemo(() => {
    const s = summary?.POOverdueFiltered ?? summary?.POOverdue;
    if (typeof s === 'number') return s;
    return filteredOrders.filter(o => normalizeAttention(o.attention) === 2).length;
  }, [summary, filteredOrders]);

  // ----- Pagination -----
  const { pageOrders, totalOrders, totalPages, startIndex, endIndex } = useMemo(() => {
    const total = filteredOrders.length;
    const pages = Math.max(1, Math.ceil(total / itemsPerPage) || 1);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      pageOrders: filteredOrders.slice(start, end),
      totalOrders: total,
      totalPages: pages,
      startIndex: start,
      endIndex: end,
    };
  }, [filteredOrders, currentPage, itemsPerPage]);

  // ----- Derived UI state -----
  const hasActiveFilters = useMemo(() => !!(
    (filterStatus && filterStatus !== 'all') ||
    (filterStorage && filterStorage !== 'all') ||
    (filterPlant && filterPlant !== 'all') ||
    (filterGroup && filterGroup !== 'all') ||
    (filterSupplier && filterSupplier !== 'all') ||
    (filterDocType && filterDocType !== 'all')
  ), [filterStatus, filterStorage, filterPlant, filterGroup, filterSupplier, filterDocType]);

  const activeFilterCount = useMemo(() => ([
    filterStatus && filterStatus !== 'all',
    filterStorage && filterStorage !== 'all',
    filterPlant && filterPlant !== 'all',
    filterGroup && filterGroup !== 'all',
    filterSupplier && filterSupplier !== 'all',
    filterDocType && filterDocType !== 'all',
  ].filter(Boolean).length), [filterStatus, filterStorage, filterPlant, filterGroup, filterSupplier, filterDocType]);

  const ordersNeedingUpdate = useMemo(() => {
    if (user.role !== 'vendor') return [];
    return filteredOrders.filter(o => normalizeAttention(o.attention) === 1);
  }, [filteredOrders, user.role]);

  // ================== Handlers ==================
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

  const handleSubmitUpdate = useCallback(() => {
    if (!orderToUpdate) return;
    toast.success(`Update submitted for PO ${orderToUpdate.purchasingDocument}`);
    setIsUpdateDialogOpen(false);
    setOrderToUpdate(null);
    setUpdateRemarks('');
  }, [orderToUpdate]);

  const clearFilters = useCallback(() => {
    setFilterStatus('');
    setFilterStorage('');
    setFilterPlant('');
    setFilterGroup('');
    setFilterSupplier('');
    setFilterDocType('');
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((v: string) => {
    setActiveTab(v as StatusTab);
    setSpecialFilter(null);
    setCurrentPage(1);
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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    processFile(file, e.target);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  }, [processFile]);

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

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(API.IMPORT_PO(), {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        let msg = `Upload failed (HTTP ${res.status})`;
        try {
          const text = await res.text();
          const json = (() => { try { return JSON.parse(text); } catch { return null; } })();
          if (json?.message || json?.Message || json?.error) {
            msg = json.message || json.Message || json.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      await res.json();
      toast.success('Purchase order data imported successfully');

      fetchPurchaseOrders(activeTab, null);

      setIsUploadDialogOpen(false);
      setUploadFile(null);
    } catch (err: any) {
      console.error('[PO] import failed', err);
      toast.error(err?.message || 'Failed to import purchase order data');
    } finally {
      setUploading(false);
    }
  }, [uploadFile, fetchPurchaseOrders, activeTab]);

  const handleDownloadTemplate = useCallback(() => {
    try {
      const me2nHeaders = [
        'Purchase Requisition', 'Item of requisition', 'Purchasing Document', 'Item', 'Document Date',
        'Delivery date', 'Purchasing Doc. Type', 'Purchasing Group', 'Short Text', 'Material',
        'Name of Supplier', 'Quantity Received', 'Still to be delivered (qty)', 'Plant', 'Storage location'
      ];

      const me5aHeaders = [
        'Order', 'Changed On', 'Purchase order', 'Purchase Requisition', 'Item of requisition',
        'Material', 'Purchase Order Date', 'Created by'
      ];

      const zmm013rHeaders = [
        'Purchase Order', 'Purchase Requisition', 'Purchase Order Item', 'GR Created Date'
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
        'purchaseRequisition', 'itemOfRequisition', 'purchasingDocument', 'item', 'documentDate',
        'deliveryDate', 'purchasingDocType', 'purchasingGroup', 'shortText', 'material',
        'nameOfSupplier', 'quantityReceived', 'stillToBeDelivered', 'plant', 'storageLocation',
        'order', 'changedOn', 'grCreatedDate', 'remarks', 'reEtaDate', 'attention',
      ];

      const cols = orderedKeys.filter(k => visibleColumns[k]);
      const headers = cols.map(k => columnLabel(k, user.role)).concat(['Status']);

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'number' || typeof v === 'string') {
          const att = normalizeAttention(v as AttentionRaw);
          if (att === 1) return 'Need Update';
          if (att === 2) return 'Overdue';
        }
        const s = String(v);
        const escaped = s.replace(/"/g, '""');
        if (/[",\n]/.test(escaped)) return `"${escaped}"`;
        return escaped;
      };

      const rows = filteredOrders.map(o => {
        const row = cols.map(k => escapeCell((o as any)[k]));
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

  // ================== Table columns ==================
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
      mk('deliveryDate', (o) => <span className="text-sm text-gray-600">{o.deliveryDate}</span>),
      mk('purchasingDocType', (o) => o.purchasingDocType),
      mk('purchasingGroup', (o) => o.purchasingGroup),
      mk('shortText', (o) => <span className="max-w-xs truncate block">{o.shortText}</span>),
      mk('material', (o) => <span className="text-sm text-gray-600">{o.material}</span>),
      mk('nameOfSupplier', (o) => o.nameOfSupplier),
      mk('quantityReceived', (o) => <span className="text-right block">{o.quantityReceived}</span>),
      mk('stillToBeDelivered', (o) => <span className="text-right block">{o.stillToBeDelivered}</span>),
      mk('plant', (o) => o.plant),
      mk('storageLocation', (o) => o.storageLocation),
      mk('order', (o) => <span className="text-sm text-gray-600">{o.order || '-'}</span>),
      mk('changedOn', (o) => <span className="text-sm text-gray-600">{o.changedOn || '-'}</span>),
      mk('grCreatedDate', (o) => <span className="text-sm text-gray-600">{o.grCreatedDate || '-'}</span>),
      mk('remarks', (o) => <span className="max-w-xs truncate block">{o.remarks || '-'}</span>),
      mk('reEtaDate', (o) => <span className="text-sm text-gray-600">{o.reEtaDate || '-'}</span>),
      mk('attention', (o) => attentionBadge(o.attention)),
    ];
  }, [user.role, visibleColumns]);

  const renderTable = useCallback(() => (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.filter(c => c.visible).map(c => (
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

              return (
                <TableRow key={`${o.purchasingDocument}-${idx}`}>
                  {columns.filter(c => c.visible).map(c => (
                    <TableCell key={c.key}>
                      {c.render(o)}
                    </TableCell>
                  ))}

                  <TableCell className="sticky right-[100px] bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                    <Badge className="min-w-[120px] justify-center" style={{ backgroundColor: statusColor(display), color: 'white' }}>
                      {display}
                    </Badge>
                  </TableCell>

                  <TableCell className="sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderId(o.purchasingDocument)}
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

      {/* Pagination */}
      {totalOrders > 0 && (
        <div className="flex items-center justify-between px-4 py-4 border-t gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">Rows per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
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
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <PaginationEllipsis key={page} />;
                }
                return null;
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="text-sm text-gray-600 whitespace-nowrap">
            Showing {totalOrders === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalOrders)} of {totalOrders} results
          </div>
        </div>
      )}
    </Card>
  ), [columns, pageOrders, totalOrders, totalPages, currentPage, startIndex, endIndex, itemsPerPage, handleItemsPerPageChange]);

  // ======== IMPORTANT: No early return (fix hooks issue) ========
  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-x-hidden">
      {selectedOrderId ? (
        <PurchaseOrderDetail
          user={user}
          orderId={selectedOrderId}
          onBack={() => setSelectedOrderId(null)}
        />
      ) : (
        <>
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2" style={{ color: '#014357' }}>Purchase Orders</h1>
            <p className="text-gray-600">Track and manage all purchase orders</p>
          </div>

          {loading && <div className="mb-4 text-sm text-gray-500">Loading purchase orders...</div>}
          {loadError && <div className="mb-4 text-sm text-red-600">{loadError}</div>}

          {/* Actions Bar */}
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

          {/* Attention Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card
              className={[
                'p-4 shadow-[0_2px_4px_rgba(237,131,45,0.25)] border-0 cursor-pointer transition-all',
                specialFilter === 'updates' ? 'ring-2 ring-[#ED832D]' : ''
              ].join(' ')}
              style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}
              onClick={() => {
                setCurrentPage(1);
                setActiveTab('all');

                setSpecialFilter(prev => {
                  const next = prev === 'updates' ? null : 'updates';
                  const att: 1 | 2 | null = next ? ATTENTION_UI_TO_BACKEND[next] : null;
                  fetchPurchaseOrders('all', att);
                  return next;
                });
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <Clock className="h-4 w-4" style={{ color: '#ED832D' }} />
                  </div>
                  <div className="text-gray-800 text-sm font-bold">PO Need Updates</div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#ED832D' }}>
                  {needUpdateCount}
                </div>
              </div>
            </Card>

            <Card
              className={[
                'p-4 shadow-[0_2px_4px_rgba(220,38,38,0.25)] border-0 cursor-pointer transition-all',
                specialFilter === 'overdue' ? 'ring-2 ring-[#DC2626]' : ''
              ].join(' ')}
              style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
              onClick={() => {
                setCurrentPage(1);
                setActiveTab('all');

                setSpecialFilter(prev => {
                  const next = prev === 'overdue' ? null : 'overdue';
                  const att: 1 | 2 | null = next ? ATTENTION_UI_TO_BACKEND[next] : null;
                  fetchPurchaseOrders('all', att);
                  return next;
                });
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <AlertTriangle className="h-4 w-4" style={{ color: '#DC2626' }} />
                  </div>
                  <div className="text-gray-800 text-sm font-bold">Overdue</div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                  {overdueCount}
                </div>
              </div>
            </Card>
          </div>

          {/* Stats */}
          <div className="flex gap-3 mb-6">
            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}>
                  <Package className="h-4 w-4" style={{ color: '#014357' }} />
                </div>
                <div className="text-gray-600 text-sm">Total POs</div>
              </div>
              <div className="text-3xl" style={{ color: '#014357' }}>{summary?.TotalPO ?? 0}</div>
            </Card>

            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
                  <FilePlus className="h-4 w-4" style={{ color: '#ED832D' }} />
                </div>
                <div className="text-gray-600 text-sm">PO Created</div>
              </div>
              <div className="text-3xl" style={{ color: '#ED832D' }}>{summary?.POSubmitted ?? 0}</div>
            </Card>

            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(92, 140, 182, 0.1)' }}>
                  <Loader className="h-4 w-4" style={{ color: '#5C8CB6' }} />
                </div>
                <div className="text-gray-600 text-sm">Work in Progress</div>
              </div>
              <div className="text-3xl" style={{ color: '#5C8CB6' }}>{summary?.POWorkInProgress ?? 0}</div>
            </Card>

            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}>
                  <Truck className="h-4 w-4" style={{ color: '#008383' }} />
                </div>
                <div className="text-gray-600 text-sm">On Delivery</div>
              </div>
              <div className="text-3xl" style={{ color: '#008383' }}>{summary?.POOnDelivery ?? 0}</div>
            </Card>

            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: '#F59E0B' }} />
                </div>
                <div className="text-gray-600 text-sm">Partially Received</div>
              </div>
              <div className="text-3xl" style={{ color: '#F59E0B' }}>{summary?.POPartiallyReceived ?? 0}</div>
            </Card>

            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(106, 167, 93, 0.1)' }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: '#6AA75D' }} />
                </div>
                <div className="text-gray-600 text-sm">Fully Received</div>
              </div>
              <div className="text-3xl" style={{ color: '#6AA75D' }}>{summary?.POFullyReceived ?? 0}</div>
            </Card>
          </div>

          {/* Orders Needing Update - Vendor Only */}
          {user.role === 'vendor' && ordersNeedingUpdate.length > 0 && (
            <Card className="mb-6 p-6" style={{ borderColor: '#ED832D', borderWidth: '2px' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5" style={{ color: '#ED832D' }} />
                <h2 style={{ color: '#014357' }}>Orders Needing Update</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                These orders have an ETA date within 2 days. Please provide updates on their delivery status.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchasing Document</TableHead>
                      <TableHead>Short Text</TableHead>
                      <TableHead>Re-ETA Date</TableHead>
                      <TableHead>Days Until ETA</TableHead>
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
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{o.purchasingDocument}</TableCell>
                          <TableCell>{o.shortText}</TableCell>
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="created">PO Created</TabsTrigger>
                <TabsTrigger value="wip">Work in Progress</TabsTrigger>
                <TabsTrigger value="delivery">On Delivery</TabsTrigger>
                <TabsTrigger value="partially">Partially Received</TabsTrigger>
                <TabsTrigger value="delivered">Fully Received</TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                {/* Columns */}
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
                            <label htmlFor="col-purchasingDocument" className="text-sm cursor-not-allowed text-gray-700">
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
                            .filter(k => !['purchasingDocument', 'item'].includes(k))
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

                {/* Filters */}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="PO Created">PO Created</SelectItem>
                            <SelectItem value="Work in Progress">Work in Progress</SelectItem>
                            <SelectItem value="On Delivery">On Delivery</SelectItem>
                            <SelectItem value="Partially Received">Partially Received</SelectItem>
                            <SelectItem value="Fully Received">Fully Received</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Storage Location</Label>
                        <Select value={filterStorage} onValueChange={(v) => { setFilterStorage(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All storage locations" /></SelectTrigger>
                          <SelectContent>
                            {filterOptions.storage.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Plant</Label>
                        <Select value={filterPlant} onValueChange={(v) => { setFilterPlant(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All plants" /></SelectTrigger>
                          <SelectContent>
                            {filterOptions.plant.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Purchasing Group</Label>
                        <Select value={filterGroup} onValueChange={(v) => { setFilterGroup(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All groups" /></SelectTrigger>
                          <SelectContent>
                            {filterOptions.group.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Supplier</Label>
                        <Select value={filterSupplier} onValueChange={(v) => { setFilterSupplier(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All suppliers" /></SelectTrigger>
                          <SelectContent>
                            {filterOptions.supplier.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Doc Type</Label>
                        <Select value={filterDocType} onValueChange={(v) => { setFilterDocType(v); setCurrentPage(1); }}>
                          <SelectTrigger><SelectValue placeholder="All document types" /></SelectTrigger>
                          <SelectContent>
                            {filterOptions.docType.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                        onClick={() => setIsFilterOpen(false)}
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
            <TabsContent value="partially">{renderTable()}</TabsContent>
            <TabsContent value="delivered">{renderTable()}</TabsContent>
          </Tabs>

          {/* Update Dialog */}
          <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle style={{ color: '#014357' }}>Update Purchase Order</DialogTitle>
                <DialogDescription>Provide updates for the delivery status of this purchase order</DialogDescription>
                {orderToUpdate && (
                  <div className="flex items-center gap-2 pt-2">
                    <Badge
                      style={{ backgroundColor: statusColor(mapBackendStatusToDisplay(orderToUpdate.status)), color: 'white' }}
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
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: '#014357' }}>
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#014357' }} />
                          <h3 className="text-lg tracking-wide" style={{ color: '#014357' }}>Order Information</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Purchasing Document</p>
                            <p className="text-sm">{orderToUpdate.purchasingDocument}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item of Requisition</p>
                            <p className="text-sm">{orderToUpdate.itemOfRequisition}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Short Text</p>
                            <p className="text-sm">{orderToUpdate.shortText}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Re-ETA Date</p>
                            <p className="text-sm">{orderToUpdate.reEtaDate || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Attention</p>
                            <div className="pt-0.5">{attentionBadge(orderToUpdate.attention)}</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: '#014357' }}>
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#014357' }} />
                          <h3 className="text-lg tracking-wide" style={{ color: '#014357' }}>Update Details</h3>
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
                    <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>Cancel</Button>
                    <Button style={{ backgroundColor: '#014357' }} className="text-white hover:opacity-90" onClick={handleSubmitUpdate}>
                      Submit Update
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Upload PO Dialog */}
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={(open) => {
              setIsUploadDialogOpen(open);
              if (!open) {
                setUploadFile(null);
                setIsDragOver(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
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
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                  onDrop={handleDrop}
                  className={[
                    'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition',
                    'flex flex-col items-center justify-center gap-2',
                    isDragOver ? 'border-[#014357] bg-slate-50'
                      : 'border-slate-300 bg-slate-50/40 hover:border-[#014357]/70 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Upload className="h-8 w-8 mb-1" style={{ color: '#014357' }} />
                  <p className="text-sm font-medium" style={{ color: '#014357' }}>Drag & drop Excel file di sini</p>
                  <p className="text-xs text-gray-500">atau <span className="underline">klik untuk memilih file</span></p>
                  <p className="text-[11px] text-gray-400 mt-1">Hanya format <b>.xlsx</b> atau <b>.xls</b> yang diperbolehkan.</p>

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
                      onClick={() => {
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setUploadFile(null);
                    setIsDragOver(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  style={{ backgroundColor: '#014357' }}
                  className="text-white hover:opacity-90"
                  onClick={handleSubmitUploadPO}
                  disabled={uploading}
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