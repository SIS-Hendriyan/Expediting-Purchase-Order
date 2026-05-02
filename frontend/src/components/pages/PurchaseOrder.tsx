import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";

import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  Search,
  Upload,
  Download,
  Filter,
  FileSpreadsheet,
  FileText,
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
  Calendar,
  CalendarDays,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "../ui/pagination";

import type { User } from "./Login";
import { PurchaseOrderDetail } from "./PurchaseOrderDetail";
import { API } from "../../config";

import {
  getAuthSession,
  getAccessToken,
  isVendorSession,
  redirectToLoginExpired,
} from "../../utils/authSession";

// ================== Types ==================
interface PurchaseOrderProps {
  user: User;
}

type StatusTab = "all" | "created" | "wip" | "delivery" | "cancel" | "received";
type AttentionFilter = "updates" | "delay" | null;
type UpdateScheduleStatus = "yes" | "no" | "";

type AttentionRaw = number | "Need Update" | "Delay" | null | undefined;
type AttentionNorm = 0 | 1 | 2;
type OrderKey = string | number;
type UploadFileType = "ME2N" | "ME5A" | "ZMM013R";

export interface PurchaseOrderItem {
  id?: OrderKey | null;
  purchaseRequisition: string;
  itemOfRequisition: string;
  purchasingDocument: string;
  item: string;
  documentDate: string;
  deliveryDate: string | null;
  etaDate: string | null;
  newEtaDate: string | null;
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
  reETACount?: number | null;
  status: string;
  attention?: AttentionRaw;
  isScheduled?: boolean | null;
  isApproveReETA?: boolean | null;
  hasPendingReETA?: boolean | null;
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
  | "purchaseRequisition"
  | "itemOfRequisition"
  | "purchasingDocument"
  | "item"
  | "documentDate"
  | "deliveryDate"
  | "etaDate"
  | "newEtaDate"
  | "purchasingDocType"
  | "purchasingGroup"
  | "shortText"
  | "material"
  | "qtyOrder"
  | "nameOfSupplier"
  | "quantityReceived"
  | "stillToBeDelivered"
  | "plant"
  | "storageLocation"
  | "order"
  | "changedOn"
  | "grCreatedDate"
  | "remarks"
  | "reETACount"
  | "attention";

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
const STATUS_TAB_TO_PARAM: Partial<Record<Exclude<StatusTab, "all">, string>> =
  {
    created: "submitted",
    wip: "workInProgress",
    delivery: "onDelivery",
    cancel: "cancel",
    received: "received",
  };

const ATTENTION_UI_TO_BACKEND: Record<Exclude<AttentionFilter, null>, 1 | 2> = {
  updates: 1,
  delay: 2,
};

const ALLOWED_EXCEL_EXTENSIONS = [".xlsx", ".xls"];

const toArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);

function isPdfOrImageFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    file.type === "image/webp"
  );
}

function isValidFileSize(file: File, maxMb = 100): boolean {
  return file.size <= maxMb * 1024 * 1024;
}
const clampUploadProgress = (value: number) => Math.max(0, Math.min(99, value));
const trim = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

const parseServerDate = (value?: string | number | null): Date | undefined => {
  const s = trim(value);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const todayStart = (): Date => startOfDay(new Date());

const addDaysDateOnly = (date: Date, days: number): Date => {
  const base = startOfDay(date);
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
};

const diffDaysDateOnly = (later: Date, earlier: Date): number => {
  const laterOnly = startOfDay(later);
  const earlierOnly = startOfDay(earlier);
  return Math.ceil(
    (laterOnly.getTime() - earlierOnly.getTime()) / (1000 * 60 * 60 * 24),
  );
};

const safeDateOnly = (v: unknown): string | null => {
  const d = parseServerDate(v as string | number | null | undefined);
  return d ? format(d, "yyyy-MM-dd") : null;
};

const getDaysUntilDelivery = (value?: string | null): number | null => {
  const target = parseServerDate(value);
  if (!target) return null;

  const startToday = todayStart();
  const startTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const diffMs = startTarget.getTime() - startToday.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
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

const parseErrorResponse = async (res: Response): Promise<string> => {
  const text = await res.text();

  try {
    const json = text ? JSON.parse(text) : {};
    return (
      json.message ||
      json.Message ||
      json.error ||
      json.title ||
      `HTTP ${res.status}`
    );
  } catch {
    return text || `HTTP ${res.status}`;
  }
};

const normalizeItemId = (it: any): OrderKey | null => {
  const v = it?.id ?? it?.ID ?? it?.Id ?? null;
  if (v === null || v === undefined || v === "") return null;
  return v as OrderKey;
};

const getOrderKey = (o: PurchaseOrderItem): OrderKey =>
  o.id !== null && o.id !== undefined && o.id !== ""
    ? o.id
    : o.purchasingDocument;

function unwrapPOPayload(json: AnyObj): {
  summary: PurchaseOrderSummary | null;
  pagination: PurchaseOrderPagination | null;
  items: PurchaseOrderItem[];
} {
  const lvl1 = (json?.data ??
    json?.Data ??
    json?.payload ??
    json?.result ??
    json) as AnyObj;
  const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;

  const summary = (lvl2?.summary ??
    lvl2?.Summary ??
    null) as PurchaseOrderSummary | null;

  const paginationFromNode = (lvl2?.pagination ??
    lvl2?.Pagination ??
    null) as PurchaseOrderPagination | null;

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

  const items = (
    Array.isArray(itemsRaw) ? itemsRaw : toArray(itemsRaw)
  ) as PurchaseOrderItem[];

  const normalizedItems = items.map((x: any) => ({
    ...x,
    id: normalizeItemId(x),
    isScheduled: x?.isScheduled ?? x?.IsScheduled ?? x?.is_scheduled ?? null,
    isApproveReETA:
      x?.isApproveReETA ?? x?.IsApproveReETA ?? x?.is_approve_re_eta ?? null,
    hasPendingReETA:
      x?.hasPendingReETA ?? x?.HasPendingReETA ?? x?.has_pending_re_eta ?? null,
    deliveryDate:
      x?.deliveryDate ?? x?.DeliveryDate ?? x?.["Delivery Date"] ?? null,
    etaDate: x?.etaDate ?? x?.ETADate ?? x?.EtaDate ?? x?.["ETA Date"] ?? null,
    qtyOrder:
      x?.qtyOrder ??
      x?.QtyOrder ??
      x?.["Qty Order"] ??
      x?.quantityOrder ??
      x?.QuantityOrder ??
      x?.orderQty ??
      x?.OrderQty ??
      null,
    reEtaDate:
      x?.reEtaDate ??
      x?.ReEtaDate ??
      x?.["Re-ETA Date"] ??
      x?.latestReEtaDate ??
      x?.LatestReEtaDate ??
      x?.proposedETA ??
      x?.ProposedETA ??
      null,
    reETACount:
      x?.reETACount ??
      x?.ReETACount ??
      x?.re_eta_count ??
      x?.ReEtaCount ??
      null,
  })) as PurchaseOrderItem[];

  return { summary, pagination, items: normalizedItems };
}

function unwrapPOMasterPayload(json: AnyObj): PurchaseOrderMasterResponse {
  const lvl1 = (json?.data ??
    json?.Data ??
    json?.payload ??
    json?.result ??
    json) as AnyObj;
  const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;

  const normalizeList = (rows: any): MasterOption[] => {
    const arr = Array.isArray(rows) ? rows : toArray(rows);

    return arr
      .map((x: any) => ({
        value: String(x?.value ?? x?.Value ?? "").trim(),
        text: String(x?.text ?? x?.Text ?? x?.value ?? x?.Value ?? "").trim(),
      }))
      .filter((x: MasterOption) => x.value);
  };

  return {
    listStatus: normalizeList(lvl2?.listStatus ?? lvl2?.ListStatus),
    listPlant: normalizeList(lvl2?.listPlant ?? lvl2?.ListPlant),
    listLocation: normalizeList(lvl2?.listLocation ?? lvl2?.ListLocation),
    listDocType: normalizeList(lvl2?.listDocType ?? lvl2?.ListDocType),
    listPurchasingGroup: normalizeList(
      lvl2?.listPurchasingGroup ?? lvl2?.ListPurchasingGroup,
    ),
  };
}

const normalizeAttention = (v: AttentionRaw): AttentionNorm => {
  if (v === 1 || v === 2) return v;
  const s = (v ?? "").toString().trim().toLowerCase();
  if (s === "need update") return 1;
  if (s === "delay") return 2;
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
  const a = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const b = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  return Math.round((b - a) / 86400000);
};

const mapBackendStatusToDisplay = (status: string): string => {
  switch ((status || "").trim()) {
    case "Submitted":
      return "PO Submitted";
    case "Work In Progress":
      return "Work in Progress";
    case "On Delivery":
      return "On Delivery";
    case "Cancel":
      return "Cancel";
    case "Partially Received":
    case "Fully Received":
      return "Received";
    default:
      return status || "-";
  }
};

const mapDisplayStatusToBackend = (status: string): string | null => {
  const normalized = (status || "").trim().toLowerCase();

  switch (normalized) {
    case "po submitted":
    case "submitted":
      return "submitted";
    case "work in progress":
      return "workInProgress";
    case "on delivery":
      return "onDelivery";
    case "cancel":
      return "cancel";
    case "received":
      return "received";
    default:
      return null;
  }
};

const isReceivedBackendStatus = (status: string): boolean => {
  const s = (status || "").trim();
  return s === "Partially Received" || s === "Fully Received";
};

const statusColor = (displayStatus: string) => {
  switch (displayStatus) {
    case "PO Submitted":
      return "#ED832D";
    case "Work in Progress":
      return "#5C8CB6";
    case "On Delivery":
      return "#008383";
    case "Cancel":
      return "#DC2626";
    case "Received":
      return "#6AA75D";
    default:
      return "#014357";
  }
};

const getInitialAttentionFilterFromQuery = (): AttentionFilter => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const attraction = params.get("attraction");

  if (attraction === "1") return "updates";
  if (attraction === "2") return "delay";

  return null;
};

const syncAttractionQuery = (value: 1 | 2 | null) => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  if (value === 1 || value === 2) {
    url.searchParams.set("attraction", String(value));
  } else {
    url.searchParams.delete("attraction");
  }

  window.history.replaceState({}, "", url.toString());
};

const vendorColumns: ColumnVis = {
  purchaseRequisition: false,
  itemOfRequisition: true,
  purchasingDocument: true,
  item: true,
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
  reETACount: true,
  attention: true,
};

const initialColumnsForRole = (role: User["role"]): ColumnVis =>
  role === "vendor" ? vendorColumns : internalColumns;

const columnLabel = (k: ColumnKey, role: User["role"]) => {
  const map: Record<ColumnKey, string> = {
    purchaseRequisition: "Purchase Requisition",
    itemOfRequisition: "Item of Requisition",
    purchasingDocument: "Purchasing Document",
    item: "Item",
    documentDate: "Document Date",
    deliveryDate: "Delivery Date",
    etaDate: "ETA Date",
    purchasingDocType: "Purchasing Doc. Type",
    purchasingGroup: "Purchasing Group",
    shortText: "Short Text",
    material: "Material",
    qtyOrder: "Qty Order",
    nameOfSupplier: "Name of Supplier",
    quantityReceived: "Qty Received",
    stillToBeDelivered: "Still to be Delivered",
    plant: "Plant",
    storageLocation: "Storage Location",
    order: "Order",
    changedOn: role === "vendor" ? "Last Updated" : "Changed On",
    grCreatedDate: "GR Created Date",
    remarks: "Remarks",
    reETACount: "Re-ETA Count",
    attention: "Attention",
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
  Array.from(
    new Set(
      arr
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  );

const normalizeDisplayStatusOptions = (rows: MasterOption[]): string[] => {
  const mapped = rows.map((x) => mapBackendStatusToDisplay(x.text || x.value));
  return dedupeStrings(mapped);
};

function RequiredDeliveryDateCard({
  deliveryDateValue,
}: {
  deliveryDateValue?: string | null;
}) {
  const deliveryDate = parseServerDate(deliveryDateValue);
  const daysLeft = getDaysUntilDelivery(deliveryDateValue);

  const isOverdue = typeof daysLeft === "number" && daysLeft < 0;
  const isUrgent =
    typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 7;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg p-4"
      style={{
        backgroundColor: "rgba(1, 67, 87, 0.05)",
        border: "1px solid rgba(1, 67, 87, 0.12)",
      }}
    >
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "#014357" }}
      >
        <CalendarDays className="h-5 w-5 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Label className="text-sm" style={{ color: "#014357" }}>
            Required Delivery Date
          </Label>

          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex">
                <Info className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[220px] text-xs">
                This is the buyer&apos;s requested delivery date. Please plan
                your ETD and ETA accordingly.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="text-lg font-medium" style={{ color: "#014357" }}>
          {deliveryDate ? format(deliveryDate, "EEEE, MMMM dd, yyyy") : "-"}
        </p>

        {typeof daysLeft === "number" && (
          <div className="mt-1 flex items-center gap-1.5">
            <Clock
              className="h-3.5 w-3.5"
              style={{
                color: isOverdue ? "#DC2626" : isUrgent ? "#ED832D" : "#6AA75D",
              }}
            />
            <span
              className="text-sm"
              style={{
                color: isOverdue ? "#DC2626" : isUrgent ? "#ED832D" : "#6AA75D",
              }}
            >
              {isOverdue
                ? `${Math.abs(daysLeft)} days overdue`
                : daysLeft === 0
                  ? "Delivery due today"
                  : `${daysLeft} days remaining`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadFileField({
  label,
  file,
  inputRef,
  disabled,
  onChange,
  onClear,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;

    const syntheticEvent = {
      target: { files: e.dataTransfer.files, value: dropped.name },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label style={{ color: "#014357", fontWeight: 600 }}>{label}</Label>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />

      {file ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet
              className="h-5 w-5 shrink-0"
              style={{ color: "#014357" }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-800 truncate max-w-[220px] mt-4">
                {file.name}
              </span>
              <span className="text-xs text-gray-500 mb-4">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 ml-2"
            disabled={disabled}
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors"
          style={{
            borderColor: isDragging ? "#014357" : "#CBD5E1",
            backgroundColor: isDragging ? "rgba(1, 67, 87, 0.04)" : "#F8FAFC",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Upload
            className="h-7 w-7"
            style={{ color: isDragging ? "#014357" : "#94A3B8" }}
          />
          <div>
            <p className="text-sm font-medium" style={{ color: "#014357" }}>
              Drag & drop your file here
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              or{" "}
              <span className="underline" style={{ color: "#014357" }}>
                browse to upload
              </span>
            </p>
          </div>
          <p className="text-[11px] text-gray-400">.xlsx or .xls only</p>
        </div>
      )}
    </div>
  );
}

// ================== Component ==================
export function PurchaseOrder({ user }: PurchaseOrderProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<OrderKey | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [specialFilter, setSpecialFilter] = useState<AttentionFilter>(() =>
    getInitialAttentionFilterFromQuery(),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [appliedFilters, setAppliedFilters] = useState<AppliedAdvancedFilters>({
    status: "",
    storageLocation: "",
    plant: "",
    purchasingGroup: "",
    supplier: "",
    purchasingDocType: "",
  });

  const [draftFilters, setDraftFilters] = useState<AppliedAdvancedFilters>({
    status: "",
    storageLocation: "",
    plant: "",
    purchasingGroup: "",
    supplier: "",
    purchasingDocType: "",
  });

  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [summary, setSummary] = useState<PurchaseOrderSummary | null>(null);
  const [cardSummary, setCardSummary] = useState<PurchaseOrderSummary | null>(
    null,
  );
  const [pagination, setPagination] = useState<PurchaseOrderPagination | null>(
    null,
  );

  const [masterFilters, setMasterFilters] =
    useState<PurchaseOrderMasterResponse>({
      listStatus: [],
      listPlant: [],
      listLocation: [],
      listDocType: [],
      listPurchasingGroup: [],
    });
  const [loadingMasterFilters, setLoadingMasterFilters] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Needing Update state
  const [needingUpdateItems, setNeedingUpdateItems] = useState<
    PurchaseOrderItem[]
  >([]);
  const [needingUpdateMeta, setNeedingUpdateMeta] = useState<{
    TotalFiltered: number;
    PageSize: number;
    PageNumber: number;
    TotalPages: number;
  } | null>(null);
  const [needingUpdatePage, setNeedingUpdatePage] = useState(1);
  const [needingUpdatePageSize, setNeedingUpdatePageSize] = useState(10);
  const [loadingNeedingUpdate, setLoadingNeedingUpdate] = useState(false);

  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseOrderItem | null>(
    null,
  );
  const [updateScheduleStatus, setUpdateScheduleStatus] =
    useState<UpdateScheduleStatus>("");

  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleTargetOrder, setRescheduleTargetOrder] =
    useState<PurchaseOrderItem | null>(null);
  const [newEtd, setNewEtd] = useState<Date | undefined>(todayStart());
  const [newLeadtimeDays, setNewLeadtimeDays] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [selectedDelayReasonId, setSelectedDelayReasonId] = useState<
    string | null
  >(null);
  const [delayReasons, setDelayReasons] = useState<
    { id: number | string; title: string }[]
  >([]);

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<
    "update" | "reschedule" | null
  >(null);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFileME2N, setUploadFileME2N] = useState<File | null>(null);
  const [uploadFileME5A, setUploadFileME5A] = useState<File | null>(null);
  const [uploadFileZMM013R, setUploadFileZMM013R] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const fileInputME2NRef = useRef<HTMLInputElement | null>(null);
  const fileInputME5ARef = useRef<HTMLInputElement | null>(null);
  const fileInputZMM013RRef = useRef<HTMLInputElement | null>(null);

  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<ColumnVis>(() =>
    initialColumnsForRole(user.role),
  );

  const vendorName = useMemo(() => {
    const s = getAuthSession();
    return isVendorSession(s) ? s.vendorName : "";
  }, [user.role]);

  const toggleColumn = useCallback((column: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  }, []);

  const currentAttentionParam: 1 | 2 | null = useMemo(() => {
    return specialFilter ? ATTENTION_UI_TO_BACKEND[specialFilter] : null;
  }, [specialFilter]);

  const resetUploadState = useCallback(() => {
    setUploadFileME2N(null);
    setUploadFileME5A(null);
    setUploadFileZMM013R(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadStatusText("");

    if (fileInputME2NRef.current) fileInputME2NRef.current.value = "";
    if (fileInputME5ARef.current) fileInputME5ARef.current.value = "";
    if (fileInputZMM013RRef.current) fileInputZMM013RRef.current.value = "";
  }, []);

  const clearUploadFile = useCallback((type: UploadFileType) => {
    switch (type) {
      case "ME2N":
        setUploadFileME2N(null);
        if (fileInputME2NRef.current) fileInputME2NRef.current.value = "";
        break;
      case "ME5A":
        setUploadFileME5A(null);
        if (fileInputME5ARef.current) fileInputME5ARef.current.value = "";
        break;
      case "ZMM013R":
        setUploadFileZMM013R(null);
        if (fileInputZMM013RRef.current) fileInputZMM013RRef.current.value = "";
        break;
    }
  }, []);

  const getIdPoItem = useCallback((order: PurchaseOrderItem | null): string => {
    if (!order) return "";
    return order.id !== null && order.id !== undefined && order.id !== ""
      ? String(order.id)
      : String(order.purchasingDocument || "");
  }, []);

  const getOrderRequiredDeliveryDate = useCallback(
    (order: PurchaseOrderItem | null): string | null => {
      if (!order) return null;
      return order.reEtaDate || order.deliveryDate || null;
    },
    [],
  );

  const currentEtaForReschedule = useMemo(() => {
    return safeDateOnly(getOrderRequiredDeliveryDate(rescheduleTargetOrder));
  }, [getOrderRequiredDeliveryDate, rescheduleTargetOrder]);

  const newEtaDateForReschedule = useMemo(() => {
    if (!newEtd) return null;
    const days = parseInt(newLeadtimeDays, 10);
    if (!newLeadtimeDays || Number.isNaN(days) || days <= 0) return null;
    return addDaysDateOnly(newEtd, days);
  }, [newEtd, newLeadtimeDays]);

  const submitPoStatusUpdate = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetchWithAuth(API.POSTATUS_UPSERT(), {
        method: "POST",
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
          data?.message ||
            data?.Message ||
            data?.title ||
            "Failed to update PO status",
        );
      }

      return data;
    },
    [],
  );

  const submitReEtaCreate = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetchWithAuth(API.REETA_CREATE(), {
        method: "POST",
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
          data?.message ||
            data?.Message ||
            data?.title ||
            "Failed to create reschedule ETA request",
        );
      }

      return data;
    },
    [],
  );

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
      filters: AppliedAdvancedFilters,
      keyword?: string,
    ) => {
      const url = new URL(API.SUMMARYPO());

      const tabStatusParam =
        tab === "all"
          ? null
          : (STATUS_TAB_TO_PARAM[tab as Exclude<StatusTab, "all">] ?? null);

      const filterStatusParam =
        filters.status && filters.status !== "all"
          ? mapDisplayStatusToBackend(filters.status)
          : null;

      const effectiveStatusParam = filterStatusParam ?? tabStatusParam;

      if (effectiveStatusParam) {
        url.searchParams.set("status", effectiveStatusParam);
      }

      if (attention === 1 || attention === 2) {
        url.searchParams.set("attention", String(attention));
        url.searchParams.set("attraction", String(attention));
      }

      if (user.role === "vendor" && vendorName) {
        url.searchParams.set("vendorName", vendorName);
      } else if (filters.supplier && filters.supplier !== "all") {
        url.searchParams.set("vendorName", filters.supplier);
      }

      if (filters.plant && filters.plant !== "all") {
        url.searchParams.set("plant", filters.plant);
      }

      if (filters.storageLocation && filters.storageLocation !== "all") {
        url.searchParams.set("storageLocation", filters.storageLocation);
      }

      if (filters.purchasingGroup && filters.purchasingGroup !== "all") {
        url.searchParams.set("purchasingGroup", filters.purchasingGroup);
      }

      if (filters.purchasingDocType && filters.purchasingDocType !== "all") {
        url.searchParams.set("purchasingDocType", filters.purchasingDocType);
      }

      if (keyword && keyword.length > 2) {
        url.searchParams.set("keyword", keyword);
      }

      url.searchParams.set("pageNumber", String(pageNumber));
      url.searchParams.set("pageSize", String(pageSize));

      return url;
    },
    [user.role, vendorName],
  );

  const buildCardsUrl = useCallback(() => {
    const url = new URL(API.SUMMARYPO());

    if (user.role === "vendor" && vendorName) {
      url.searchParams.set("vendorName", vendorName);
    }

    return url;
  }, [user.role, vendorName]);

  const buildMasterUrl = useCallback(() => {
    const url = new URL(API.MASTERPO());

    const tabStatusParam =
      activeTab === "all"
        ? null
        : (STATUS_TAB_TO_PARAM[activeTab as Exclude<StatusTab, "all">] ?? null);

    const filterStatusParam =
      appliedFilters.status && appliedFilters.status !== "all"
        ? mapDisplayStatusToBackend(appliedFilters.status)
        : null;

    const effectiveStatusParam = filterStatusParam ?? tabStatusParam;

    if (effectiveStatusParam) {
      url.searchParams.set("status", effectiveStatusParam);
    }

    if (currentAttentionParam === 1 || currentAttentionParam === 2) {
      url.searchParams.set("attention", String(currentAttentionParam));
    }

    if (user.role === "vendor" && vendorName) {
      url.searchParams.set("vendorName", vendorName);
    } else if (appliedFilters.supplier && appliedFilters.supplier !== "all") {
      url.searchParams.set("vendorName", appliedFilters.supplier);
    }

    return url;
  }, [activeTab, currentAttentionParam, user.role, vendorName, appliedFilters]);

  const fetchCardSummary = useCallback(async () => {
    try {
      const url = buildCardsUrl();
      const res = await fetchWithAuth(url.toString(), {
        method: "GET",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        console.error("[PO] cardSummary HTTP error", msg);
        return;
      }

      const json = await res.json();
      const unwrapped = unwrapPOPayload(json);
      setCardSummary(unwrapped.summary ?? null);
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        console.error("[PO] cardSummary fetch failed", e);
      }
    }
  }, [buildCardsUrl]);

  const fetchPurchaseOrders = useCallback(
    async (
      tab: StatusTab,
      attention: 1 | 2 | null,
      pageNumber: number,
      pageSize: number,
      keyword?: string,
    ) => {
      setLoading(true);
      setLoadError(null);

      console.log("[PO] fetchPurchaseOrders called with:", {
        tab,
        attention,
        pageNumber,
        pageSize,
        keyword,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const effectiveTab: StatusTab = attention ? "all" : tab;
      const url = buildListUrl(
        effectiveTab,
        attention,
        pageNumber,
        pageSize,
        appliedFilters,
        keyword,
      );

      console.log("[PO] Request URL:", url.toString());

      try {
        const res = await fetchWithAuth(url.toString(), {
          method: "GET",
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
        if (err?.message === "Session expired") {
          return;
        }

        console.error("[PO] list fetch failed:", err);
        const isAbort = err?.name === "AbortError";

        setLoadError(
          isAbort
            ? "Request timeout. Please try again."
            : "Failed to load purchase orders",
        );
        setSummary(null);
        setOrders([]);
        setPagination(null);
        toast.error(
          isAbort
            ? "Request timeout"
            : err?.message || "Failed to load purchase orders",
        );
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    },
    [buildListUrl, appliedFilters],
  );

  const refreshPurchaseOrdersList = useCallback(async () => {
    console.log("[PO] Refreshing purchase orders list...");
    await fetchPurchaseOrders(
      activeTab,
      currentAttentionParam,
      currentPage,
      itemsPerPage,
      searchQuery,
    );
  }, [
    activeTab,
    currentAttentionParam,
    currentPage,
    itemsPerPage,
    searchQuery,
    fetchPurchaseOrders,
  ]);

  const fetchNeedingUpdate = useCallback(
    async (page: number, pageSize: number, keyword?: string) => {
      if (user.role !== "vendor") return;
      if (!vendorName) return;

      setLoadingNeedingUpdate(true);

      const url = new URL(API.PO_NEEDING_UPDATE());
      url.searchParams.set("vendorName", vendorName);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));

      if (keyword && keyword.length > 2) {
        url.searchParams.set("keyword", keyword);
      }

      try {
        const res = await fetchWithAuth(url.toString(), {
          method: "GET",
          headers: buildAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error(await parseErrorResponse(res));
        }

        const json = await res.json();
        const lvl1 = (json?.data ??
          json?.Data ??
          json?.payload ??
          json?.result ??
          json) as AnyObj;
        const lvl2 = (lvl1?.Data ?? lvl1?.data ?? lvl1) as AnyObj;

        const itemsRaw =
          lvl2?.items ?? lvl2?.Items ?? lvl2?.rows ?? lvl2?.Rows ?? [];

        const items = (
          Array.isArray(itemsRaw) ? itemsRaw : toArray(itemsRaw)
        ) as PurchaseOrderItem[];

        const normalizedItems = items.map((x: any) => ({
          ...x,
          id: normalizeItemId(x),
          isScheduled:
            x?.isScheduled ?? x?.IsScheduled ?? x?.is_scheduled ?? null,
          isApproveReETA:
            x?.isApproveReETA ??
            x?.IsApproveReETA ??
            x?.is_approve_re_eta ??
            null,
          hasPendingReETA:
            x?.hasPendingReETA ??
            x?.HasPendingReETA ??
            x?.has_pending_re_eta ??
            null,
          deliveryDate:
            x?.deliveryDate ?? x?.DeliveryDate ?? x?.["Delivery Date"] ?? null,
          etaDate:
            x?.etaDate ?? x?.ETADate ?? x?.EtaDate ?? x?.["ETA Date"] ?? null,
          qtyOrder:
            x?.qtyOrder ??
            x?.QtyOrder ??
            x?.["Qty Order"] ??
            x?.quantityOrder ??
            x?.QuantityOrder ??
            x?.orderQty ??
            x?.OrderQty ??
            null,
          reEtaDate:
            x?.reEtaDate ??
            x?.ReEtaDate ??
            x?.["Re-ETA Date"] ??
            x?.latestReEtaDate ??
            x?.LatestReEtaDate ??
            x?.proposedETA ??
            x?.ProposedETA ??
            null,
          reETACount:
            x?.reETACount ??
            x?.ReETACount ??
            x?.re_eta_count ??
            x?.ReEtaCount ??
            null,
        })) as PurchaseOrderItem[];

        const metaRaw = (lvl2?.meta ?? lvl2?.Meta ?? null) as AnyObj;
        const meta = metaRaw
          ? {
              TotalFiltered: Number(
                metaRaw.TotalFiltered ?? metaRaw.totalFiltered ?? 0,
              ),
              PageSize: Number(
                metaRaw.PageSize ?? metaRaw.pageSize ?? pageSize,
              ),
              PageNumber: Number(
                metaRaw.PageNumber ?? metaRaw.pageNumber ?? page,
              ),
              TotalPages: Number(metaRaw.TotalPages ?? metaRaw.totalPages ?? 0),
            }
          : null;

        setNeedingUpdateItems(normalizedItems);
        setNeedingUpdateMeta(meta);
      } catch (err: any) {
        if (err?.message !== "Session expired") {
          console.error("[PO] needing update fetch failed:", err);
          toast.error(err?.message || "Failed to load orders needing update");
        }
      } finally {
        setLoadingNeedingUpdate(false);
      }
    },
    [user.role, vendorName],
  );

  const fetchMasterFilters = useCallback(async () => {
    setLoadingMasterFilters(true);

    try {
      const url = buildMasterUrl();
      const res = await fetchWithAuth(url.toString(), {
        method: "GET",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();
      const data = unwrapPOMasterPayload(json);

      setMasterFilters(data);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        console.error("[PO] master filters fetch failed", err);
        toast.error(err?.message || "Failed to load filter options");
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
    void fetchPurchaseOrders(
      activeTab,
      currentAttentionParam,
      currentPage,
      itemsPerPage,
      searchQuery,
    );
  }, [
    activeTab,
    currentAttentionParam,
    currentPage,
    itemsPerPage,
    searchQuery,
    fetchPurchaseOrders,
  ]);

  useEffect(() => {
    void fetchMasterFilters();
  }, [fetchMasterFilters]);

  useEffect(() => {
    if (user.role === "vendor") {
      void fetchNeedingUpdate(
        needingUpdatePage,
        needingUpdatePageSize,
        searchQuery,
      );
    }
  }, [
    user.role,
    needingUpdatePage,
    needingUpdatePageSize,
    searchQuery,
    fetchNeedingUpdate,
  ]);

  const scopedOrders = useMemo(() => {
    let list = orders;

    if (activeTab === "created") {
      list = list.filter(
        (o) => mapBackendStatusToDisplay(o.status) === "PO Submitted",
      );
    } else if (activeTab === "wip") {
      list = list.filter(
        (o) => mapBackendStatusToDisplay(o.status) === "Work in Progress",
      );
    } else if (activeTab === "delivery") {
      list = list.filter(
        (o) => mapBackendStatusToDisplay(o.status) === "On Delivery",
      );
    } else if (activeTab === "cancel") {
      list = list.filter(
        (o) => mapBackendStatusToDisplay(o.status) === "Cancel",
      );
    } else if (activeTab === "received") {
      list = list.filter(
        (o) =>
          isReceivedBackendStatus(o.status) ||
          mapBackendStatusToDisplay(o.status) === "Received",
      );
    }

    if (specialFilter) {
      const attentionValue = ATTENTION_UI_TO_BACKEND[specialFilter];
      list = list.filter(
        (o) => normalizeAttention(o.attention) === attentionValue,
      );
    }

    return list;
  }, [orders, activeTab, specialFilter]);

  const filterOptions = useMemo(() => {
    const supplierOptions =
      user.role !== "vendor"
        ? ["all", ...dedupeStrings(scopedOrders.map((o) => o.nameOfSupplier))]
        : [];

    return {
      status: [
        "all",
        ...normalizeDisplayStatusOptions(masterFilters.listStatus),
      ],
      storage: [
        "all",
        ...dedupeStrings(
          masterFilters.listLocation.map((x) => x.text || x.value),
        ),
      ],
      plant: [
        "all",
        ...dedupeStrings(masterFilters.listPlant.map((x) => x.text || x.value)),
      ],
      group: [
        "all",
        ...dedupeStrings(
          masterFilters.listPurchasingGroup.map((x) => x.text || x.value),
        ),
      ],
      supplier: supplierOptions,
      docType: [
        "all",
        ...dedupeStrings(
          masterFilters.listDocType.map((x) => x.text || x.value),
        ),
      ],
    };
  }, [masterFilters, scopedOrders, user.role]);

  const filteredOrders = useMemo(() => {
    let list = scopedOrders;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          (o.purchasingDocument ?? "").toLowerCase().includes(q) ||
          (o.purchaseRequisition ?? "").toLowerCase().includes(q) ||
          (o.shortText ?? "").toLowerCase().includes(q) ||
          (o.nameOfSupplier ?? "").toLowerCase().includes(q) ||
          (o.material ?? "").toLowerCase().includes(q) ||
          (o.qtyOrder ?? "").toString().toLowerCase().includes(q) ||
          (o.etaDate ?? "").toLowerCase().includes(q) ||
          (o.reEtaDate ?? "").toLowerCase().includes(q) ||
          mapBackendStatusToDisplay(o.status).toLowerCase().includes(q),
      );
    }

    if (
      appliedFilters.status &&
      appliedFilters.status !== "all" &&
      appliedFilters.status === "Received"
    ) {
      list = list.filter(
        (o) =>
          isReceivedBackendStatus(o.status) ||
          mapBackendStatusToDisplay(o.status) === "Received",
      );
    }

    return list;
  }, [scopedOrders, searchQuery, appliedFilters.status]);

  const delayCount = useMemo(() => {
    const v = cardSummary?.PODelay;
    if (typeof v === "number") return v;
    return orders.filter((o) => normalizeAttention(o.attention) === 2).length;
  }, [cardSummary, orders]);

  const cancelCount = useMemo(() => {
    const v = summary?.POCancel ?? cardSummary?.POCancel;
    if (typeof v === "number") return v;
    return orders.filter(
      (o) => mapBackendStatusToDisplay(o.status) === "Cancel",
    ).length;
  }, [summary, cardSummary, orders]);

  const receivedCount = useMemo(() => {
    if (summary) {
      return (
        (summary.POPartiallyReceived ?? 0) + (summary.POFullyReceived ?? 0)
      );
    }

    return orders.filter((o) => isReceivedBackendStatus(o.status)).length;
  }, [summary, orders]);

  const isServerPagination = pagination !== null;

  const totalOrders = isServerPagination
    ? pagination.totalFiltered
    : filteredOrders.length;

  const totalPages = isServerPagination
    ? Math.max(1, pagination.totalPages)
    : Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage) || 1);

  const pageOrders = isServerPagination
    ? filteredOrders
    : filteredOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      );

  const startIndex = totalOrders === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + pageOrders.length, totalOrders);

  const hasActiveFilters = useMemo(
    () =>
      !!(
        (appliedFilters.status && appliedFilters.status !== "all") ||
        (appliedFilters.storageLocation &&
          appliedFilters.storageLocation !== "all") ||
        (appliedFilters.plant && appliedFilters.plant !== "all") ||
        (appliedFilters.purchasingGroup &&
          appliedFilters.purchasingGroup !== "all") ||
        (user.role !== "vendor" &&
          appliedFilters.supplier &&
          appliedFilters.supplier !== "all") ||
        (appliedFilters.purchasingDocType &&
          appliedFilters.purchasingDocType !== "all")
      ),
    [user.role, appliedFilters],
  );

  const activeFilterCount = useMemo(
    () =>
      [
        appliedFilters.status && appliedFilters.status !== "all",
        appliedFilters.storageLocation &&
          appliedFilters.storageLocation !== "all",
        appliedFilters.plant && appliedFilters.plant !== "all",
        appliedFilters.purchasingGroup &&
          appliedFilters.purchasingGroup !== "all",
        user.role !== "vendor" &&
          appliedFilters.supplier &&
          appliedFilters.supplier !== "all",
        appliedFilters.purchasingDocType &&
          appliedFilters.purchasingDocType !== "all",
      ].filter(Boolean).length,
    [user.role, appliedFilters],
  );

  const ordersNeedingUpdate = needingUpdateItems;

  const handleSearchChange = useCallback((v: string) => {
    setSearchQuery(v);
    setCurrentPage(1);
    setNeedingUpdatePage(1);
  }, []);

  const handleItemsPerPageChange = useCallback((v: string) => {
    setItemsPerPage(Number(v));
    setCurrentPage(1);
  }, []);

  const handleOpenUpdateDialog = useCallback((order: PurchaseOrderItem) => {
    console.log(
      "[Update Dialog] isApproveReETA:",
      order.isApproveReETA,
      "| hasPendingReETA:",
      order.hasPendingReETA,
      "| attention:",
      order.attention,
      "| normalizeAttention:",
      normalizeAttention(order.attention),
    );
    setOrderToUpdate(order);
    setUpdateScheduleStatus(order.attention === 2 ? "no" : "yes");
    setIsUpdateDialogOpen(true);
  }, []);

  const fetchDelayReasons = useCallback(async () => {
    try {
      const res = await fetchWithAuth(API.DELAY_REASONS_LIST(), {
        method: "GET",
        headers: buildAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: any[] = Array.isArray(data)
        ? data
        : (data?.Data ?? data?.data ?? data?.Items ?? data?.items ?? []);
      setDelayReasons(
        list.map((r: any) => ({
          id: r.ID ?? r.id,
          title: r.TITLE ?? r.title ?? "",
        })),
      );
    } catch {
      // silently ignore
    }
  }, []);

  const handleOpenRescheduleDialog = useCallback(
    async (order?: PurchaseOrderItem | null) => {
      const target = order ?? orderToUpdate ?? rescheduleTargetOrder ?? null;

      if (!target) {
        toast.error("Purchase order not found");
        return;
      }

      setRescheduleTargetOrder(target);
      setNewEtd(todayStart());
      setNewLeadtimeDays("");
      setRescheduleReason("");
      setEvidenceFile(null);
      setSelectedDelayReasonId(null);
      await fetchDelayReasons();
      setRescheduleDialogOpen(true);
    },
    [orderToUpdate, rescheduleTargetOrder, fetchDelayReasons],
  );

  const handleCloseRescheduleDialog = useCallback(() => {
    setRescheduleDialogOpen(false);
    setNewEtd(todayStart());
    setNewLeadtimeDays("");
    setRescheduleReason("");
    setEvidenceFile(null);
    setSelectedDelayReasonId(null);
  }, []);

  const handleEvidenceFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isPdfOrImageFile(file)) {
        return toast.error("Only PDF or Image files are allowed");
      }

      if (!isValidFileSize(file, 1)) {
        return toast.error("File size must not exceed 1MB");
      }

      setEvidenceFile(file);
      toast.success("Evidence file uploaded successfully");
    },
    [],
  );

  const handleSubmitReschedule = useCallback(async () => {
    try {
      const idPoItem = getIdPoItem(rescheduleTargetOrder);

      if (!idPoItem) {
        toast.error("ID PO Item not found.");
        return;
      }

      if (!currentEtaForReschedule) {
        toast.error("Required delivery date is not set.");
        return;
      }

      if (!newEtd) {
        toast.error("Please select a valid new ETD.");
        return;
      }

      const newLeadtime = parseInt(newLeadtimeDays, 10);
      if (!newLeadtimeDays || Number.isNaN(newLeadtime) || newLeadtime <= 0) {
        toast.error("Please enter a valid new lead time.");
        return;
      }

      if (!newEtaDateForReschedule) {
        toast.error("New ETA could not be calculated.");
        return;
      }

      if (!rescheduleReason.trim()) {
        toast.error("Please provide a reason for rescheduling.");
        return;
      }

      if (!selectedDelayReasonId) {
        toast.error("Please select a category reason.");
        return;
      }

      const proposedEtaDays = diffDaysDateOnly(
        newEtaDateForReschedule,
        startOfDay(newEtd),
      );

      setSubmittingReschedule(true);

      const formData = new FormData();
      formData.append("IdPoItem", String(idPoItem));
      formData.append(
        "PoNumber",
        String(trim(rescheduleTargetOrder?.["Purchasing Document"]) ?? ""),
      );
      formData.append(
        "PoItemNo",
        String(trim(rescheduleTargetOrder?.Item) ?? ""),
      );
      formData.append(
        "VendorName",
        String(trim(rescheduleTargetOrder?.["Name of Supplier"]) ?? ""),
      );

      formData.append("NewETD", format(newEtd, "yyyy-MM-dd"));
      formData.append("ProposedEtaDays", String(proposedEtaDays));
      formData.append("Reason", rescheduleReason.trim());
      if (selectedDelayReasonId) {
        formData.append("DelayReasonId", selectedDelayReasonId);
      }
      if (evidenceFile) {
        formData.append("EvidenceFile", evidenceFile);
      }

      const token = getAuthToken();
      const res = await fetchWithAuth(API.REETA_CREATE(), {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const text = await res.text();
          const parsed = (() => {
            try {
              return JSON.parse(text);
            } catch {
              return null;
            }
          })();
          msg =
            parsed?.message || parsed?.Message || parsed?.error || text || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      toast.success("Reschedule request submitted successfully.");

      setRescheduleDialogOpen(false);
      setIsUpdateDialogOpen(false);
      setOrderToUpdate(null);
      setNewEtd(todayStart());
      setNewLeadtimeDays("");
      setRescheduleReason("");
      setEvidenceFile(null);
      setSelectedDelayReasonId(null);

      await fetchCardSummary();
      await fetchPurchaseOrders(
        activeTab,
        currentAttentionParam,
        currentPage,
        itemsPerPage,
        searchQuery,
      );
      await fetchMasterFilters();
      await fetchNeedingUpdate(
        needingUpdatePage,
        needingUpdatePageSize,
        searchQuery,
      );
    } catch (error: any) {
      if (error?.message !== "Session expired") {
        toast.error(error?.message || "Failed to submit reschedule request.");
      }
    } finally {
      setSubmittingReschedule(false);
    }
  }, [
    activeTab,
    currentAttentionParam,
    currentEtaForReschedule,
    currentPage,
    evidenceFile,
    fetchCardSummary,
    fetchMasterFilters,
    fetchNeedingUpdate,
    fetchPurchaseOrders,
    getIdPoItem,
    itemsPerPage,
    needingUpdatePage,
    needingUpdatePageSize,
    newEtd,
    newEtaDateForReschedule,
    newLeadtimeDays,
    rescheduleReason,
    rescheduleTargetOrder,
    searchQuery,
    selectedDelayReasonId,
  ]);

  const openConfirmationModal = useCallback(
    (action: "update" | "reschedule") => {
      setPendingSubmitAction(action);
      setConfirmationChecked(false);
      setConfirmationModalOpen(true);
    },
    [],
  );

  const closeConfirmationModal = useCallback(() => {
    setConfirmationModalOpen(false);
    setConfirmationChecked(false);
    setPendingSubmitAction(null);
  }, []);

  const handleSubmitUpdate = useCallback(async () => {
    try {
      if (!orderToUpdate) {
        toast.error("No purchase order selected");
        return;
      }

      if (!updateScheduleStatus) {
        toast.error("Please select update confirmation");
        return;
      }

      if (updateScheduleStatus === "no") {
        return;
      }

      if (orderToUpdate.isApproveReETA === false) {
        return;
      }

      const idPoItem = getIdPoItem(orderToUpdate);

      if (!idPoItem) {
        toast.error("ID PO Item not found");
        return;
      }

      setSubmittingUpdate(orderToUpdate.attention === 2 ? false : true);

      await submitPoStatusUpdate({
        IDPOItem: idPoItem,
        IsScheduled: true,
        DeliveryUpdate: "On Schedule",
      });

      toast.success(
        `Update submitted for PO ${orderToUpdate.purchasingDocument}`,
      );

      setIsUpdateDialogOpen(false);
      setOrderToUpdate(null);
      setUpdateScheduleStatus("");

      await fetchCardSummary();
      await fetchPurchaseOrders(
        activeTab,
        currentAttentionParam,
        currentPage,
        itemsPerPage,
        searchQuery,
      );
      await fetchMasterFilters();
      await fetchNeedingUpdate(
        needingUpdatePage,
        needingUpdatePageSize,
        searchQuery,
      );
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        console.error("[PO] submit delivery update failed", err);
        toast.error(err?.message || "Failed to submit update");
      }
    } finally {
      setSubmittingUpdate(false);
    }
  }, [
    orderToUpdate,
    updateScheduleStatus,
    getIdPoItem,
    submitPoStatusUpdate,
    fetchCardSummary,
    fetchPurchaseOrders,
    fetchMasterFilters,
    fetchNeedingUpdate,
    activeTab,
    currentAttentionParam,
    currentPage,
    itemsPerPage,
    needingUpdatePage,
    needingUpdatePageSize,
    searchQuery,
  ]);

  const handleConfirmedSubmit = useCallback(() => {
    if (!confirmationChecked || !pendingSubmitAction) return;
    closeConfirmationModal();
    if (pendingSubmitAction === "update") {
      void handleSubmitUpdate();
    } else if (pendingSubmitAction === "reschedule") {
      void handleSubmitReschedule();
    }
  }, [
    confirmationChecked,
    pendingSubmitAction,
    closeConfirmationModal,
    handleSubmitUpdate,
    handleSubmitReschedule,
  ]);

  const clearFilters = useCallback(() => {
    setDraftFilters({
      status: "",
      storageLocation: "",
      plant: "",
      purchasingGroup: "",
      supplier: "",
      purchasingDocType: "",
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

  const handleToggleAttentionCard = useCallback(
    (type: Exclude<AttentionFilter, null>) => {
      setCurrentPage(1);
      setActiveTab("all");

      setSpecialFilter((prev) => {
        const next: AttentionFilter = prev === type ? null : type;
        syncAttractionQuery(next ? ATTENTION_UI_TO_BACKEND[next] : null);
        return next;
      });
    },
    [],
  );

  const processUploadFile = useCallback(
    (
      file: File | null,
      setter: React.Dispatch<React.SetStateAction<File | null>>,
      input?: HTMLInputElement | null,
    ) => {
      if (!file) {
        setter(null);
        if (input) input.value = "";
        return;
      }

      if (!isExcelFile(file)) {
        toast.error("File must be an Excel file (.xlsx or .xls)");
        setter(null);
        if (input) input.value = "";
        return;
      }

      setter(file);
    },
    [],
  );

  const handleFileChangeME2N = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      processUploadFile(file, setUploadFileME2N, e.target);
    },
    [processUploadFile],
  );

  const handleFileChangeME5A = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      processUploadFile(file, setUploadFileME5A, e.target);
    },
    [processUploadFile],
  );

  const handleFileChangeZMM013R = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      processUploadFile(file, setUploadFileZMM013R, e.target);
    },
    [processUploadFile],
  );

  const handleSubmitUploadPO = useCallback(async () => {
    if (!uploadFileME2N) {
      toast.error("Please select ME2N file first");
      return;
    }

    if (!uploadFileME5A) {
      toast.error("Please select ME5A file first");
      return;
    }

    if (!uploadFileZMM013R) {
      toast.error("Please select ZMM013R file first");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText("Preparing upload...");

    try {
      const formData = new FormData();
      formData.append("ME2NFile", uploadFileME2N);
      formData.append("ME5AFile", uploadFileME5A);
      formData.append("ZMM013RFile", uploadFileZMM013R);

      const token = getAuthToken();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API.IMPORT_PO(), true);

        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onloadstart = () => {
          setUploadProgress(0);
          setUploadStatusText("Starting upload...");
        };

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const rawPercent = Math.round((event.loaded / event.total) * 100);
            const percent = clampUploadProgress(rawPercent);
            setUploadProgress(percent);
            setUploadStatusText(`Uploading... ${percent}%`);
          } else {
            setUploadStatusText("Uploading...");
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
            if (xhr.status === 401) {
              redirectToLoginExpired();
              reject(new Error("Session expired"));
              return;
            }

            setUploadProgress(99);
            setUploadStatusText("Processing file on server...");
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error while uploading file"));
        };

        xhr.ontimeout = () => {
          reject(new Error("Upload timeout"));
        };

        xhr.onload = () => {
          if (xhr.status === 401) {
            redirectToLoginExpired();
            reject(new Error("Session expired"));
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            setUploadStatusText("Upload completed");
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

      toast.success("Purchase order data imported successfully");

      setUploadProgress(100);
      setUploadStatusText("Upload completed");

      await new Promise((resolve) => setTimeout(resolve, 400));

      setUploadStatusText("Refreshing data...");

      await fetchCardSummary();
      await fetchPurchaseOrders(
        activeTab,
        currentAttentionParam,
        currentPage,
        itemsPerPage,
        searchQuery,
      );
      await fetchMasterFilters();

      setIsUploadDialogOpen(false);
      resetUploadState();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        console.error("[PO] import failed", err);
        toast.error(err?.message || "Failed to import purchase order data");
        setUploadStatusText("");
      }
    } finally {
      setUploading(false);
    }
  }, [
    uploadFileME2N,
    uploadFileME5A,
    uploadFileZMM013R,
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
        "Qty Order",
        "Name of Supplier",
        "Quantity Received",
        "Still to be delivered (qty)",
        "Plant",
        "Storage location",
      ];

      const zmm013rHeaders = [
        "Purchase Order",
        "Purchase Requisition",
        "Purchase Order Item",
        "GR Created Date",
      ];

      const me5aHeaders = [
        "Order",
        "Changed On",
        "Purchase order",
        "Purchase Requisition",
        "Item of requisition",
        "Material",
        "Purchase Order Date",
        "Created by",
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([me2nHeaders]),
        "ME2N",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([me5aHeaders]),
        "ME5A",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([zmm013rHeaders]),
        "ZMM013R",
      );

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();

      XLSX.writeFile(wb, `TemplatePO_${dd}-${mm}-${yyyy}.xlsx`);
      toast.success("Template downloaded");
    } catch (err) {
      console.error("[PO] template export failed", err);
      toast.error("Failed to download template");
    }
  }, []);

  const handleDownloadPOData = useCallback(async () => {
    try {
      setExporting(true);

      const exportUrl = buildListUrl(
        activeTab,
        currentAttentionParam,
        1,
        2147483647,
        appliedFilters,
        searchQuery,
      );

      const res = await fetchWithAuth(exportUrl.toString(), {
        method: "GET",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();
      const unwrapped = unwrapPOPayload(json);
      const exportOrders = Array.isArray(unwrapped.items)
        ? unwrapped.items
        : [];

      const orderedKeys: ColumnKey[] = [
        "purchaseRequisition",
        "itemOfRequisition",
        "purchasingDocument",
        "item",
        "documentDate",
        "deliveryDate",
        "etaDate",
        "purchasingDocType",
        "purchasingGroup",
        "shortText",
        "material",
        "qtyOrder",
        "nameOfSupplier",
        "quantityReceived",
        "stillToBeDelivered",
        "plant",
        "storageLocation",
        "order",
        "changedOn",
        "grCreatedDate",
        "remarks",
        "reETACount",
        "attention",
      ];

      const cols = orderedKeys.filter((k) => visibleColumns[k]);
      const headers = cols
        .map((k) => columnLabel(k, user.role))
        .concat(["Status"]);

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return "";

        if (typeof v === "number" || typeof v === "string") {
          const att = normalizeAttention(v as AttentionRaw);
          if (att === 1) return "Need Update";
          if (att === 2) return "Delay";
        }

        const s = String(v);
        const escaped = s.replace(/"/g, '""');
        if (/[",\n]/.test(escaped)) return `"${escaped}"`;
        return escaped;
      };

      const rows = exportOrders.map((o) => {
        const row = cols.map((k) => escapeCell((o as any)[k]));
        row.push(escapeCell(mapBackendStatusToDisplay(o.status)));
        return row.join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\r\n");

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const filename = `PO_(${dd}-${mm}-${yyyy}).csv`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.setAttribute("download", filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export complete");
    } catch (err: any) {
      console.error("[PO] export failed", err);
      toast.error(err?.message || "Failed to export PO data");
    } finally {
      setExporting(false);
    }
  }, [
    activeTab,
    currentAttentionParam,
    appliedFilters,
    searchQuery,
    buildListUrl,
    visibleColumns,
    user.role,
  ]);

  const columns = useMemo(() => {
    const mk = (
      key: ColumnKey,
      render?: (o: PurchaseOrderItem) => React.ReactNode,
    ) => ({
      key,
      label: columnLabel(key, user.role),
      visible: visibleColumns[key],
      render: render ?? ((o: PurchaseOrderItem) => (o as any)[key] ?? "-"),
    });

    return [
      mk("purchaseRequisition", (o) => (
        <span className="font-medium">{o.purchaseRequisition}</span>
      )),
      mk("itemOfRequisition", (o) => o.itemOfRequisition),
      mk("purchasingDocument", (o) => (
        <span className="font-medium">{o.purchasingDocument}</span>
      )),
      mk("item", (o) => o.item),
      mk("documentDate", (o) => (
        <span className="text-sm text-gray-600">{o.documentDate}</span>
      )),
      mk("deliveryDate", (o) => (
        <span className="text-sm text-gray-600">{o.deliveryDate || "-"}</span>
      )),
      mk("etaDate", (o) => (
        <span className="text-sm text-gray-600">{o.etaDate || "-"}</span>
      )),
      mk("purchasingDocType", (o) => o.purchasingDocType),
      mk("purchasingGroup", (o) => o.purchasingGroup),
      mk("shortText", (o) => (
        <span className="max-w-xs truncate block">{o.shortText}</span>
      )),
      mk("material", (o) => (
        <span className="text-sm text-gray-600">{o.material}</span>
      )),
      mk("qtyOrder", (o) => (
        <span className="text-right block">{o.qtyOrder || "-"}</span>
      )),
      mk("nameOfSupplier", (o) => o.nameOfSupplier),
      mk("quantityReceived", (o) => (
        <span className="text-right block">{o.quantityReceived}</span>
      )),
      mk("stillToBeDelivered", (o) => (
        <span className="text-right block">{o.stillToBeDelivered}</span>
      )),
      mk("plant", (o) => o.plant),
      mk("storageLocation", (o) => o.storageLocation),
      mk("order", (o) => (
        <span className="text-sm text-gray-600">{o.order || "-"}</span>
      )),
      mk("changedOn", (o) => (
        <span className="text-sm text-gray-600">{o.changedOn || "-"}</span>
      )),
      mk("grCreatedDate", (o) => (
        <span className="text-sm text-gray-600">{o.grCreatedDate || "-"}</span>
      )),
      mk("remarks", (o) => (
        <span className="max-w-xs truncate block">{o.remarks || "-"}</span>
      )),
      mk("reETACount", (o) => (
        <span className="text-right block">{o.reETACount ?? "-"}</span>
      )),
      mk("attention", (o) => attentionBadge(o.attention)),
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
                        style={{
                          backgroundColor: statusColor(display),
                          color: "white",
                        }}
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
                        style={{ borderColor: "#014357", color: "#014357" }}
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
              <span className="text-sm text-gray-600 whitespace-nowrap">
                Rows per page:
              </span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={handleItemsPerPageChange}
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
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
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
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {totalOrders === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, totalOrders)} of {totalOrders} results
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
    ],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full overflow-x-hidden">
      {selectedOrderId !== null ? (
        <PurchaseOrderDetail
          user={user}
          orderId={String(selectedOrderId)}
          onBack={() => setSelectedOrderId(null)}
          onRefreshPurchaseOrders={refreshPurchaseOrdersList}
        />
      ) : (
        <>
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2" style={{ color: "#014357" }}>
              Purchase Orders
            </h1>
            <p className="text-gray-600">
              Track and manage all purchase orders
            </p>
          </div>

          {loading && (
            <div className="mb-4 text-sm text-gray-500">
              Loading purchase orders...
            </div>
          )}
          {loadError && (
            <div className="mb-4 text-sm text-red-600">{loadError}</div>
          )}

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

            {user.role === "admin" && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  size="sm"
                  onClick={handleDownloadPOData}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader className="h-4 w-4 sm:mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {exporting ? "Exporting..." : "Export"}
                  </span>
                </Button>

                <Button
                  style={{ backgroundColor: "#014357" }}
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
                "p-4 shadow-[0_2px_4px_rgba(220,38,38,0.25)] border-0 cursor-pointer transition-all w-full",
                specialFilter === "delay" ? "overdue-active" : "",
              ].join(" ")}
              style={{ backgroundColor: "rgba(220, 38, 38, 0.1)" }}
              onClick={() => handleToggleAttentionCard("delay")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <AlertTriangle
                      className="h-4 w-4"
                      style={{ color: "#DC2626" }}
                    />
                  </div>
                  <div
                    className="text-gray-900 text-sm"
                    style={{ fontWeight: 600 }}
                  >
                    Delay
                  </div>
                </div>
                <div
                  className="text-2xl font-bold"
                  style={{ color: "#DC2626", fontWeight: 800 }}
                >
                  {delayCount}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex gap-3 mb-6 flex-wrap">
            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(1, 67, 87, 0.1)" }}
                >
                  <Package className="h-4 w-4" style={{ color: "#014357" }} />
                </div>
                <div className="text-gray-600 text-sm">Total PO Items</div>
              </div>
              <div className="text-3xl" style={{ color: "#014357" }}>
                {summary?.TotalPO ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(237, 131, 45, 0.1)" }}
                >
                  <FilePlus className="h-4 w-4" style={{ color: "#ED832D" }} />
                </div>
                <div className="text-gray-600 text-sm">PO Submitted</div>
              </div>
              <div className="text-3xl" style={{ color: "#ED832D" }}>
                {summary?.POSubmitted ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(92, 140, 182, 0.1)" }}
                >
                  <Loader className="h-4 w-4" style={{ color: "#5C8CB6" }} />
                </div>
                <div className="text-gray-600 text-sm">Work in Progress</div>
              </div>
              <div className="text-3xl" style={{ color: "#5C8CB6" }}>
                {summary?.POWorkInProgress ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(0, 131, 131, 0.1)" }}
                >
                  <Truck className="h-4 w-4" style={{ color: "#008383" }} />
                </div>
                <div className="text-gray-600 text-sm">On Delivery</div>
              </div>
              <div className="text-3xl" style={{ color: "#008383" }}>
                {summary?.POOnDelivery ?? 0}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(220, 38, 38, 0.1)" }}
                >
                  <Ban className="h-4 w-4" style={{ color: "#DC2626" }} />
                </div>
                <div className="text-gray-600 text-sm">Cancel</div>
              </div>
              <div className="text-3xl" style={{ color: "#DC2626" }}>
                {cancelCount}
              </div>
            </Card>

            <Card className="flex-1 min-w-[180px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: "rgba(106, 167, 93, 0.1)" }}
                >
                  <CheckCircle2
                    className="h-4 w-4"
                    style={{ color: "#6AA75D" }}
                  />
                </div>
                <div className="text-gray-600 text-sm">Received</div>
              </div>
              <div className="text-3xl" style={{ color: "#6AA75D" }}>
                {receivedCount}
              </div>
            </Card>
          </div>

          {user.role === "vendor" && ordersNeedingUpdate.length > 0 && (
            <Card
              className="mb-6 p-6"
              style={{ borderColor: "#ED832D", borderWidth: "2px" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5" style={{ color: "#ED832D" }} />
                <h2 style={{ color: "#014357" }}>Orders Needing Update</h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                These are your active orders requiring confirmation. Please
                confirm whether they are still on track or need re-ETA.
              </p>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchasing Document</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Short Text</TableHead>
                      <TableHead>ETA Date</TableHead>
                      <TableHead>Days Until ETA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {ordersNeedingUpdate.map((o, idx) => {
                      const display = mapBackendStatusToDisplay(o.status);
                      let effectiveEtaDateStr: string | null = null;
                      if (o.reEtaDate?.trim()) {
                        effectiveEtaDateStr = o.reEtaDate;
                      } else if (o.etaDate?.trim()) {
                        effectiveEtaDateStr = o.etaDate;
                      } else if (o.deliveryDate?.trim()) {
                        effectiveEtaDateStr = o.deliveryDate;
                      }
                      const d = parseDdMmmYyyy(effectiveEtaDateStr);
                      const diffDays = d ? diffDaysFromToday(d) : null;

                      return (
                        <TableRow key={`${getOrderKey(o)}-${idx}`}>
                          <TableCell className="font-medium">
                            {o.purchasingDocument}
                          </TableCell>
                          <TableCell>{o.item}</TableCell>
                          <TableCell>{o.shortText}</TableCell>
                          <TableCell>{effectiveEtaDateStr || "-"}</TableCell>
                          <TableCell>
                            {diffDays === null ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <Badge
                                style={{
                                  backgroundColor:
                                    diffDays === 0 ? "#d4183d" : "#ED832D",
                                  color: "white",
                                }}
                              >
                                {diffDays === 0
                                  ? "Today"
                                  : `${diffDays} day${diffDays > 1 ? "s" : ""}`}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge
                              style={{
                                backgroundColor: statusColor(display),
                                color: "white",
                              }}
                            >
                              {display}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenUpdateDialog(o)}
                            >
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

              {/* Needing Update Pagination */}
              {needingUpdateMeta && needingUpdateMeta.TotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="text-sm text-gray-600">
                    Showing{" "}
                    {needingUpdateItems.length === 0
                      ? 0
                      : (needingUpdatePage - 1) * needingUpdatePageSize +
                        1}{" "}
                    to{" "}
                    {Math.min(
                      needingUpdatePage * needingUpdatePageSize,
                      needingUpdateMeta.TotalFiltered,
                    )}{" "}
                    of {needingUpdateMeta.TotalFiltered} results
                  </div>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setNeedingUpdatePage((p) => Math.max(1, p - 1))
                          }
                          className={
                            needingUpdatePage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>

                      {[...Array(needingUpdateMeta.TotalPages)].map((_, i) => {
                        const page = i + 1;

                        if (
                          page === 1 ||
                          page === needingUpdateMeta.TotalPages ||
                          (page >= needingUpdatePage - 1 &&
                            page <= needingUpdatePage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setNeedingUpdatePage(page)}
                                isActive={needingUpdatePage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }

                        if (
                          page === needingUpdatePage - 2 ||
                          page === needingUpdatePage + 2
                        ) {
                          return <PaginationEllipsis key={page} />;
                        }

                        return null;
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setNeedingUpdatePage((p) =>
                              Math.min(needingUpdateMeta.TotalPages, p + 1),
                            )
                          }
                          className={
                            needingUpdatePage === needingUpdateMeta.TotalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>

                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    Page {needingUpdatePage} of {needingUpdateMeta.TotalPages}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
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
                  <PopoverContent
                    className="w-[280px] max-h-[500px]"
                    align="end"
                  >
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">
                          Customize Table View
                        </h4>
                        <p className="text-xs text-gray-500">
                          Show or hide columns. Some cannot be hidden.
                        </p>
                      </div>

                      <ScrollArea className="h-[320px]">
                        <div className="space-y-2 pr-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="col-purchasingDocument"
                              checked={visibleColumns.purchasingDocument}
                              disabled
                            />
                            <label
                              htmlFor="col-purchasingDocument"
                              className="text-sm cursor-not-allowed text-gray-700"
                            >
                              Purchasing Document
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="col-item"
                              checked={visibleColumns.item}
                              disabled
                            />
                            <label
                              htmlFor="col-item"
                              className="text-sm cursor-not-allowed text-gray-700"
                            >
                              Item
                            </label>
                          </div>

                          <Separator className="my-3" />

                          {(Object.keys(visibleColumns) as ColumnKey[])
                            .filter(
                              (k) =>
                                !["purchasingDocument", "item"].includes(k),
                            ) // 👈 add "item" here
                            .map((k) => (
                              <div
                                key={k}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`col-${k}`}
                                  checked={visibleColumns[k]}
                                  onCheckedChange={() => toggleColumn(k)}
                                />
                                <label
                                  htmlFor={`col-${k}`}
                                  className="text-sm cursor-pointer"
                                >
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
                          style={{ backgroundColor: "#ED832D", color: "white" }}
                        >
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Advanced Filters</DialogTitle>
                      <DialogDescription>
                        Filter purchase orders by multiple criteria
                      </DialogDescription>
                    </DialogHeader>

                    {loadingMasterFilters && (
                      <div className="py-2 text-sm text-gray-500">
                        Loading filter options...
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select
                          value={draftFilters.status}
                          onValueChange={(v) =>
                            setDraftFilters((prev) => ({ ...prev, status: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.status.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === "all" ? "All" : opt}
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
                            setDraftFilters((prev) => ({
                              ...prev,
                              storageLocation: v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All storage locations" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.storage.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === "all" ? "All" : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Plant</Label>
                        <Select
                          value={draftFilters.plant}
                          onValueChange={(v) =>
                            setDraftFilters((prev) => ({ ...prev, plant: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All plants" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.plant.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === "all" ? "All" : opt}
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
                            setDraftFilters((prev) => ({
                              ...prev,
                              purchasingGroup: v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All groups" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.group.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === "all" ? "All" : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {user.role !== "vendor" && (
                        <div className="grid gap-2">
                          <Label>Supplier</Label>
                          <Select
                            value={draftFilters.supplier}
                            onValueChange={(v) =>
                              setDraftFilters((prev) => ({
                                ...prev,
                                supplier: v,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All suppliers" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions.supplier.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt === "all" ? "All" : opt}
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
                            setDraftFilters((prev) => ({
                              ...prev,
                              purchasingDocType: v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All document types" />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOptions.docType.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt === "all" ? "All" : opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={clearFilters}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Filters
                      </Button>
                      <Button
                        style={{ backgroundColor: "#014357" }}
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

          <Dialog
            open={isUpdateDialogOpen}
            onOpenChange={(open) => {
              setIsUpdateDialogOpen(open);
              if (!open) {
                setOrderToUpdate(null);
                setUpdateScheduleStatus("");
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle style={{ color: "#014357" }}>
                  Update Purchase Order
                </DialogTitle>
                <DialogDescription>
                  Confirm whether this PO item is still on track with the
                  current ETA or needs re-ETA.
                </DialogDescription>
                {orderToUpdate && (
                  <div className="flex items-center gap-2 pt-2">
                    <Badge
                      style={{
                        backgroundColor: statusColor(
                          mapBackendStatusToDisplay(orderToUpdate.status),
                        ),
                        color: "white",
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
                          style={{ borderColor: "#014357" }}
                        >
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#014357" }}
                          />
                          <h3
                            className="text-lg tracking-wide"
                            style={{ color: "#014357" }}
                          >
                            Order Information
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Purchasing Document
                            </p>
                            <p className="text-sm">
                              {orderToUpdate.purchasingDocument}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Item of Requisition
                            </p>
                            <p className="text-sm">
                              {orderToUpdate.itemOfRequisition}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Short Text
                            </p>
                            <p className="text-sm">{orderToUpdate.shortText}</p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              ETA Date
                            </p>
                            <p className="text-sm">
                              {orderToUpdate.etaDate?.trim() ||
                                orderToUpdate.deliveryDate?.trim() ||
                                "N/A"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Re-ETA Date
                            </p>
                            <p className="text-sm">
                              {orderToUpdate.reEtaDate || "N/A"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Qty Order
                            </p>
                            <p className="text-sm">
                              {orderToUpdate.qtyOrder || "N/A"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">
                              Attention
                            </p>
                            <div className="pt-0.5">
                              {attentionBadge(orderToUpdate.attention)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div
                          className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                          style={{ borderColor: "#014357" }}
                        >
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#014357" }}
                          />
                          <h3
                            className="text-lg tracking-wide"
                            style={{ color: "#014357" }}
                          >
                            Update Confirmation
                          </h3>
                        </div>

                        <div className="space-y-4">
                          <Label>Delivery Confirmation </Label>

                          <div className="space-y-3">
                            <label
                              className={[
                                "flex items-start gap-3 rounded-lg border p-4 transition",
                                orderToUpdate.isApproveReETA === false
                                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                  : updateScheduleStatus === "yes"
                                    ? "border-[#014357] bg-slate-50 cursor-pointer"
                                    : "border-gray-200 hover:border-[#014357]/50 cursor-pointer",
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name="scheduleStatus"
                                value="yes"
                                checked={updateScheduleStatus === "yes"}
                                onChange={() => setUpdateScheduleStatus("yes")}
                                disabled={
                                  orderToUpdate.isApproveReETA === false
                                }
                                className="mt-1"
                              />
                              <div>
                                <div
                                  className="font-medium text-sm"
                                  style={{
                                    color:
                                      orderToUpdate.isApproveReETA === false
                                        ? "#9CA3AF"
                                        : "#014357",
                                  }}
                                >
                                  Ya, masih sesuai ETA
                                </div>
                              </div>
                            </label>

                            <label
                              className={[
                                "flex items-start gap-3 rounded-lg border p-4 transition",
                                orderToUpdate.isApproveReETA === false
                                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                  : updateScheduleStatus === "no"
                                    ? "border-[#014357] bg-slate-50 cursor-pointer"
                                    : "border-gray-200 hover:border-[#014357]/50 cursor-pointer",
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name="scheduleStatus"
                                value="no"
                                checked={updateScheduleStatus === "no"}
                                onChange={() => setUpdateScheduleStatus("no")}
                                disabled={
                                  orderToUpdate.isApproveReETA === false
                                }
                                className="mt-1"
                              />
                              <div>
                                <div
                                  className="font-medium text-sm"
                                  style={{
                                    color:
                                      orderToUpdate.isApproveReETA === false
                                        ? "#9CA3AF"
                                        : "#014357",
                                  }}
                                >
                                  Tidak, lakukan Re-ETA
                                </div>
                              </div>
                            </label>
                          </div>

                          {updateScheduleStatus === "no" &&
                            orderToUpdate.hasPendingReETA !== true && (
                              <Alert
                                style={{
                                  borderColor: "#DC2626",
                                  backgroundColor: "rgba(220, 38, 38, 0.06)",
                                }}
                              >
                                <AlertCircle
                                  className="h-4 w-4"
                                  style={{ color: "#DC2626" }}
                                />
                                <AlertDescription className="text-sm text-gray-700">
                                  ETA exceeds the delivery date. Please{" "}
                                  <button
                                    type="button"
                                    className="btn-underlined-text inline border-none bg-transparent p-0 underline cursor-pointer"
                                    style={{ color: "#014357" }}
                                    onClick={() =>
                                      handleOpenRescheduleDialog(orderToUpdate)
                                    }
                                  >
                                    submit a Reschedule ETA Request again
                                  </button>{" "}
                                  before proceeding.
                                </AlertDescription>
                              </Alert>
                            )}

                          {orderToUpdate.hasPendingReETA === true && (
                            <Alert
                              style={{
                                borderColor: "#ED832D",
                                backgroundColor: "rgba(237, 131, 45, 0.06)",
                              }}
                            >
                              <AlertCircle
                                className="h-4 w-4"
                                style={{ color: "#ED832D" }}
                              />
                              <AlertDescription className="text-sm text-gray-700">
                                Waiting for Re-ETA approval. Please wait until
                                the request is reviewed before proceeding.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsUpdateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                      <Button
                      style={{ backgroundColor: "#014357" }}
                      className="text-white hover:opacity-90"
                      onClick={() => openConfirmationModal("update")}
                      disabled={
                        submittingUpdate ||
                        !updateScheduleStatus ||
                        updateScheduleStatus === "no" ||
                        normalizeAttention(orderToUpdate.attention) === 2 ||
                        orderToUpdate.hasPendingReETA === true
                      }
                    >
                      {submittingUpdate ? "Submitting..." : "Submit Update"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={rescheduleDialogOpen}
            onOpenChange={setRescheduleDialogOpen}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle style={{ color: "#014357" }}>
                  Create Reschedule ETA Request
                </DialogTitle>
                <DialogDescription>
                  Review the current schedule and submit a request with New ETD
                  and New Lead Time.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <RequiredDeliveryDateCard
                  deliveryDateValue={getOrderRequiredDeliveryDate(
                    rescheduleTargetOrder,
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>
                      New ETD <span className="text-red-500">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="mt-1 w-full justify-start text-left"
                          type="button"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {newEtd ? (
                            format(newEtd, "PPP")
                          ) : (
                            <span>Select new ETD</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={newEtd}
                          onSelect={setNewEtd}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="newLeadtimeDays">
                      New Lead Time <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newLeadtimeDays"
                      type="number"
                      min={1}
                      value={newLeadtimeDays}
                      onChange={(e) => setNewLeadtimeDays(e.target.value)}
                      placeholder="Enter new lead time"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Label className="mb-2 block text-sm text-gray-600">
                    New ETA (New ETD + New Lead Time)
                  </Label>
                  <p className="text-lg" style={{ color: "#014357" }}>
                    {newEtaDateForReschedule
                      ? format(newEtaDateForReschedule, "MMM dd, yyyy")
                      : "Not set"}
                  </p>
                </div>

                <div>
                  <Label>
                    Category Reason <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedDelayReasonId ?? ""}
                    onValueChange={(value) =>
                      setSelectedDelayReasonId(value || null)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {delayReasons.length > 0 ? (
                        delayReasons.map((reason) => (
                          <SelectItem key={reason.id} value={String(reason.id)}>
                            {reason.title}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No categories available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rescheduleReason">
                    Reason for Rescheduling{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="rescheduleReason"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Provide a detailed reason for the reschedule request..."
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Re-Eta Request Evidence (Upload & Review)</Label>
                  {!evidenceFile ? (
                    <label
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors hover:bg-gray-50"
                      style={{ borderColor: "#9CA3AF" }}
                    >
                      <div
                        className="flex mt-4 h-10 w-15 items-center justify-center rounded-full"
                        style={{ backgroundColor: "rgba(156, 163, 175, 0.15)" }}
                      >
                        <Upload
                          className="h-5 w-10"
                          style={{ color: "#6B7280" }}
                        />
                      </div>
                      <p className="text-sm" style={{ color: "#014357" }}>
                        Click to upload PDF / Image Document
                      </p>
                      <p className="text-xs text-gray-400">
                        Maximum file size: 1MB
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                        onChange={handleEvidenceFileUpload}
                        disabled={submittingReschedule}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div
                      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: "#F4F6F4",
                        borderColor: "#C5D5C5",
                      }}
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded"
                        style={{ backgroundColor: "#9CA3AF" }}
                      >
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm" style={{ color: "#014357" }}>
                          {evidenceFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(evidenceFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEvidenceFile(null)}
                        disabled={submittingReschedule}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleCloseRescheduleDialog}
                  disabled={submittingReschedule}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => openConfirmationModal("reschedule")}
                  style={{ backgroundColor: "#014357" }}
                  className="text-white hover:opacity-90"
                  disabled={submittingReschedule}
                >
                  {submittingReschedule ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
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
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle style={{ color: "#014357" }}>
                  Upload Purchase Order
                </DialogTitle>
                <DialogDescription>
                  Upload 3 file Excel terpisah untuk <b>ME2N</b>, <b>ME5A</b>,
                  dan <b>ZMM013R</b>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <UploadFileField
                  label="ME2N File (.xlsx / .xls)"
                  file={uploadFileME2N}
                  inputRef={fileInputME2NRef}
                  disabled={uploading}
                  onChange={handleFileChangeME2N}
                  onClear={() => clearUploadFile("ME2N")}
                />

                <UploadFileField
                  label="ME5A File (.xlsx / .xls)"
                  file={uploadFileME5A}
                  inputRef={fileInputME5ARef}
                  disabled={uploading}
                  onChange={handleFileChangeME5A}
                  onClear={() => clearUploadFile("ME5A")}
                />

                <UploadFileField
                  label="ZMM013R File (.xlsx / .xls)"
                  file={uploadFileZMM013R}
                  inputRef={fileInputZMM013RRef}
                  disabled={uploading}
                  onChange={handleFileChangeZMM013R}
                  onClear={() => clearUploadFile("ZMM013R")}
                />

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {uploadStatusText || "Uploading..."}
                      </span>
                      <span
                        className="font-medium"
                        style={{ color: "#014357" }}
                      >
                        {uploadProgress}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${uploadProgress}%`,
                          backgroundColor: "#014357",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>

                <Button
                  style={{ backgroundColor: "#014357" }}
                  className="text-white hover:opacity-90"
                  onClick={handleSubmitUploadPO}
                  disabled={
                    uploading ||
                    !uploadFileME2N ||
                    !uploadFileME5A ||
                    !uploadFileZMM013R
                  }
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={confirmationModalOpen}
            onOpenChange={(open) => !open && closeConfirmationModal()}
          >
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle style={{ color: "#014357" }}>
                  Pernyataan Syarat dan Ketentuan
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Mohon baca seluruh ketentuan di bawah ini sebelum melanjutkan.
                </DialogDescription>
              </DialogHeader>

              <div
                className="flex-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-4"
                style={{ maxHeight: "400px" }}
              >
                <p className="mb-4 font-medium" style={{ color: "#014357" }}>
                  Pernyataan Syarat dan Ketentuan Terkait Keterlambatan Supply
                </p>
                <p className="mb-4 text-sm text-gray-700">
                  Dengan ini kami sampaikan bahwa Vendor wajib memenuhi seluruh
                  komitmen pengadaan barang dan/atau jasa sesuai dengan jadwal,
                  spesifikasi, dan ketentuan yang telah disepakati dalam
                  Kontrak/PO/SOW yang berlaku.
                </p>
                <p className="mb-4 text-sm text-gray-700">
                  Apabila Vendor tidak memenuhi waktu supply sebagaimana
                  tercantum dalam kontrak, maka hal tersebut akan dikategorikan
                  sebagai pelanggaran kontraktual dan Procurement berhak untuk
                  menjatuhkan sanksi sesuai dengan ketentuan yang telah
                  disepakati, termasuk namun tidak terbatas pada:
                </p>
                <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-gray-700">
                  <li>
                    Pengenaan denda keterlambatan berdasarkan perhitungan dan
                    persentase yang ditetapkan dalam kontrak;
                  </li>
                  <li>
                    Pemotongan nilai pembayaran atas barang dan/atau jasa yang
                    disuplai;
                  </li>
                  <li>
                    Penerbitan surat peringatan tertulis (SP) kepada Vendor;
                  </li>
                  <li>
                    Pembekuan sementara aktivitas supply hingga kewajiban
                    dipenuhi;
                  </li>
                  <li>
                    Pemutusan kontrak secara sepihak apabila keterlambatan
                    terjadi secara berulang atau berdampak signifikan terhadap
                    operasional perusahaan;
                  </li>
                  <li>
                    Evaluasi kinerja Vendor yang dapat memengaruhi keikutsertaan
                    Vendor pada proses pengadaan di masa mendatang.
                  </li>
                </ol>
                <p className="mb-4 text-sm text-gray-700">
                  Procurement berhak untuk menerapkan satu atau lebih sanksi
                  tersebut sesuai dengan tingkat dan dampak pelanggaran, tanpa
                  mengurangi hak-hak lain sebagaimana diatur dalam kontrak dan
                  peraturan yang berlaku.
                </p>
                <p className="mb-4 text-sm text-gray-700">
                  Dengan dilanjutkannya proses pekerjaan dan/atau supply, Vendor
                  dianggap telah mengetahui, menyetujui, dan bersedia mematuhi
                  seluruh ketentuan serta sanksi yang tercantum dalam kontrak
                  dan pernyataan ini.
                </p>
                <p className="mb-4 font-medium" style={{ color: "#014357" }}>
                  Pernyataan Konfirmasi Vendor
                </p>
                <p className="mb-4 text-sm text-gray-700">
                  Sebagai bentuk konfirmasi, mohon Vendor menyatakan persetujuan
                  atas pertanyaan berikut sebelum melanjutkan progres pekerjaan:
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={confirmationChecked}
                    onChange={(e) => setConfirmationChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    Saya telah membaca, memahami, dan menyetujui seluruh
                    ketentuan serta sanksi terkait keterlambatan supply
                    sebagaimana tercantum dalam kontrak dan pernyataan ini.
                  </span>
                </label>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={closeConfirmationModal}>
                  Batal
                </Button>
                <Button
                  onClick={handleConfirmedSubmit}
                  disabled={!confirmationChecked}
                  style={{
                    backgroundColor: confirmationChecked
                      ? "#014357"
                      : "#94A3B8",
                  }}
                  className="text-white hover:opacity-90"
                >
                  Saya Setuju &amp; Lanjutkan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
