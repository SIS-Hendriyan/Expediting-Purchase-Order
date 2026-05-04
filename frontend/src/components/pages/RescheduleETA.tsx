import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  X,
  FileText,
  AlertCircle,
  AlertTriangle,
  Plus,
  Download,
  FileCheck,
  Loader2,
  Check,
  ChevronsUpDown,
  Calendar,
  Info,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { ScrollArea } from "../ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "../ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { format } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";

import { API } from "../../config";
import type { User } from "./Login";
import {
  getAccessToken,
  redirectToLoginExpired,
} from "../../utils/authSession";

// =====================
// Types
// =====================
type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "AWAITING_VENDOR_DOC"
  | "REJECTED"
  | "VENDOR_DOC_UPLOADED";

type ReEtaRow = {
  ID: number;
  POREETANUMBER: string;

  "ID PO Item"?: string;
  "PO Number"?: string;
  "PO Item No"?: string;

  "Vendor Code"?: string;
  "Vendor Name"?: string;

  "Current ETA"?: string;
  "Proposed ETA"?: number;
  ResultETA?: string;

  "Reschedule Reason"?: string;
  "Reschedule Status"?: RequestStatus;

  Feedback?: string;
  CREATED_AT?: string;
  CREATED_BY?: string;
  FEEDBACK_AT?: string;
  FEEDBACK_BY?: string;

  VENDOR_RESPONSE_AT?: string;
  VENDOR_RESPONSE_BY?: string;

  HasEvidence?: number;
  HasFeedbackAttachment?: number;
  HasVendorResponse?: number;

  "Evidence Doc ID"?: number;
  "Feedback Doc ID"?: number;
  "VendorResp Doc ID"?: number;

  // detail fields
  ShortText?: string;
  ETD?: string;
  CurrentETD?: string;
  CurrentNewETA?: string;
  "ETA Days"?: number;
  RequestETADate?: string;
  ResultProposeEtaDesc?: string;
  FeedbackFileName?: string;

  // delay reason
  DelayReasonTitle?: string;
  DelayReasonDescription?: string;

  // evidence file
  EvidenceBase64?: string;
  EvidenceContentType?: string;
  EvidenceFileName?: string;
  EvidenceSize?: number;
};

type SummaryRow = {
  "Total Requests"?: number;
  "Pending Review"?: number;
  Approved?: number;
  "Awaiting Vendor Doc"?: number;
  Rejected?: number;
};

type MetaRow = {
  TotalRows?: number;
  Page?: number;
  PageSize?: number;
};

type PoItemRow = {
  ID: number;
  "Purchasing Document": string;
  Item: string;
  "Name of Supplier": string;
  "Short Text"?: string;
  ETD?: string;
  "ETA Days"?: number;
  ReEtaDate?: string;
  Status?: string;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface RescheduleETAProps {
  user: User;
}

type ActionDialogState = {
  open: boolean;
  type: "approve" | "reject" | null;
  request: ReEtaRow | null;
};

type DetailsDialogState = {
  open: boolean;
  request: ReEtaRow | null;
};

type VendorResponseDialogState = {
  open: boolean;
  request: ReEtaRow | null;
};

// =====================
// Auth helpers
// =====================
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

// =====================
// Utils
// =====================
const unwrap = (json: any) => json?.data ?? json?.Data ?? json;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf";
}

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

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const blob = new Blob([new Uint8Array(byteNumbers)], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName || "document.pdf";
  a.click();

  URL.revokeObjectURL(url);
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithAuth(url, {
    ...init,
    headers: {
      ...buildAuthHeaders(),
      ...(init.headers || {}),
    },
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

      msg = parsed?.message || parsed?.Message || parsed?.error || text || msg;
    } catch {
      // ignore
    }

    throw new Error(msg);
  }

  return (await res.json()) as T;
}

// ===== Date-only helpers =====
const pad2 = (n: number) => String(n).padStart(2, "0");

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

function parseDateOnly(input?: string | null): Date | null {
  if (!input) return null;

  const s = String(input).trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = monthMap[dmy[2].toLowerCase()];
    const y = Number(dmy[3]);

    if (m === undefined) return null;

    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;

  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function todayStart(): Date {
  return startOfDay(new Date());
}

function addDaysDateOnly(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function diffDaysDateOnly(later: Date, earlier: Date): number {
  const laterOnly = startOfDay(later);
  const earlierOnly = startOfDay(earlier);
  return Math.ceil(
    (laterOnly.getTime() - earlierOnly.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getDaysUntilDelivery(value?: string | null): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const startToday = todayStart();
  const startTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const diffMs = startTarget.getTime() - startToday.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function RequiredDeliveryDateCard({
  deliveryDateValue,
}: {
  deliveryDateValue?: string | null;
}) {
  const deliveryDate = deliveryDateValue ? new Date(deliveryDateValue) : null;
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
            Required Delivery Dates
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
          {deliveryDate && !Number.isNaN(deliveryDate.getTime())
            ? format(deliveryDate, "EEEE, MMMM dd, yyyy")
            : "-"}
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

function formatYMD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// =====================
// Shared ETA / status helpers
// =====================
function getStatusLabel(status?: RequestStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "AWAITING_VENDOR_DOC":
      return "Awaiting Vendor Doc";
    case "REJECTED":
      return "Rejected";
    case "VENDOR_DOC_UPLOADED":
      return "Vendor Doc Uploaded";
    default:
      return "-";
  }
}

function getStatusColor(status?: RequestStatus) {
  switch (status) {
    case "APPROVED":
      return "#6AA75D";
    case "PENDING":
      return "#ED832D";
    case "AWAITING_VENDOR_DOC":
      return "#FFA500";
    case "REJECTED":
      return "#d4183d";
    case "VENDOR_DOC_UPLOADED":
      return "#008383";
    default:
      return "#014357";
  }
}

function isAwaitingVendorDoc(row: ReEtaRow) {
  return row["Reschedule Status"] === "AWAITING_VENDOR_DOC";
}

function getRequestedEtaDate(row?: ReEtaRow | null): string | null {
  return row?.ResultETA || row?.RequestETADate || null;
}

function getRequestedEtaDesc(row?: ReEtaRow | null): string {
  if (row?.ResultProposeEtaDesc) {
    return String(row.ResultProposeEtaDesc);
  }

  const proposed = safeNumber(row?.["Proposed ETA"], 0);
  return `${proposed} day(s)`;
}

function getEtaDayDifference(request: ReEtaRow): number {
  const currentEta = parseDateOnly(request["Current ETA"]);
  const newEta = parseDateOnly(getRequestedEtaDate(request));
  if (!currentEta || !newEta) return 0;

  const diffMs = newEta.getTime() - currentEta.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getDocButtonTheme(status?: RequestStatus) {
  if (status === "APPROVED") {
    return {
      color: "#6AA75D",
      hoverClass: "hover:bg-green-50",
      softBg: "rgba(106,167,93,0.12)",
    };
  }

  if (status === "REJECTED") {
    return {
      color: "#d4183d",
      hoverClass: "hover:bg-red-50",
      softBg: "rgba(212,24,61,0.10)",
    };
  }

  if (status === "AWAITING_VENDOR_DOC") {
    return {
      color: "#FFA500",
      hoverClass: "hover:bg-orange-50",
      softBg: "rgba(255,165,0,0.12)",
    };
  }

  return {
    color: "#014357",
    hoverClass: "hover:bg-slate-50",
    softBg: "rgba(1,67,87,0.08)",
  };
}

// =====================
// Searchable Select
// =====================
function SearchableSelect(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  onSearch?: (keyword: string) => Promise<void> | void;
  loading?: boolean;
  minSearchLength?: number;
}) {
  const {
    value,
    onChange,
    placeholder = "Select...",
    options,
    disabled,
    searchPlaceholder = "Search...",
    emptyText = "No results",
    className,
    onSearch,
    loading,
    minSearchLength = 1,
  } = props;

  const [open, setOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const lastSearchedRef = useRef<string>("");
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  // Debounce search
  useEffect(() => {
    if (!onSearch) return;

    const trimmed = searchKeyword.trim();
    if (!trimmed || trimmed.length < minSearchLength) return;

    // Hindari fetch ulang untuk keyword yang sama
    if (trimmed === lastSearchedRef.current) return;

    const timer = setTimeout(() => {
      lastSearchedRef.current = trimmed;
      void onSearch(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchKeyword, onSearch, minSearchLength]);

  const showMinSearchMessage =
    onSearch && (!searchKeyword || searchKeyword.length < minSearchLength);

  const actualEmptyText = showMinSearchMessage
    ? `Type at least ${minSearchLength} characters to search...`
    : emptyText;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      lastSearchedRef.current = "";
      setSearchKeyword("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] max-h-[400px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command className="flex flex-col">
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchKeyword}
            onValueChange={setSearchKeyword}
          />

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && (
            <>
              <CommandEmpty>{actualEmptyText}</CommandEmpty>
              <div className="max-h-[320px] overflow-y-auto overflow-x-hidden">
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      disabled={opt.disabled}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearchKeyword("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === opt.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =====================
// Component
// =====================
export function RescheduleETA({ user }: RescheduleETAProps) {
  // list/filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);

  // data state
  const [summary, setSummary] = useState<SummaryRow>({});
  const [meta, setMeta] = useState<MetaRow>({});
  const [rows, setRows] = useState<ReEtaRow[]>([]);
  const [poItems, setPoItems] = useState<PoItemRow[]>([]);

  // dialogs
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    type: null,
    request: null,
  });

  const [detailsDialog, setDetailsDialog] = useState<DetailsDialogState>({
    open: false,
    request: null,
  });

  const [vendorResponseDialog, setVendorResponseDialog] =
    useState<VendorResponseDialogState>({
      open: false,
      request: null,
    });

  const [createDialog, setCreateDialog] = useState(false);

  // form states
  const [remark, setRemark] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [vendorResponseFile, setVendorResponseFile] = useState<File | null>(
    null,
  );
  const [vendorDelayReasonId, setVendorDelayReasonId] = useState("");
  const [vendorRemark, setVendorRemark] = useState("");

  const [selectedPO, setSelectedPO] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [newETADays, setNewETADays] = useState("");
  const [newEtd, setNewEtd] = useState<Date | undefined>(todayStart());
  const [newLeadtimeDays, setNewLeadtimeDays] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [selectedDelayReasonId, setSelectedDelayReasonId] = useState("");
  const [delayReasons, setDelayReasons] = useState<
    { id: number; title: string; describe: string }[]
  >([]);
  const [loadingDelayReasons, setLoadingDelayReasons] = useState(false);
  const [loadingPoItems, setLoadingPoItems] = useState(false);
  const [pendingReEtaAlert, setPendingReEtaAlert] = useState<string | null>(
    null,
  );

  const [poItemDetail, setPoItemDetail] = useState<Record<string, any> | null>(
    null,
  );
  const [loadingPoDetail, setLoadingPoDetail] = useState(false);

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);

  // =====================
  // Load list
  // =====================
  const fetchList = async () => {
    try {
      setLoading(true);

      const qs = new URLSearchParams();
      if (searchQuery.trim()) qs.set("q", searchQuery.trim());
      qs.set("page", String(currentPage));
      qs.set("pageSize", String(itemsPerPage));

      const raw = await apiFetch<any>(`${API.REETA_LIST()}?${qs.toString()}`, {
        method: "GET",
      });

      const payload = unwrap(raw);

      setSummary(payload?.summary || {});
      setMeta(payload?.meta || {});
      setRows(payload?.items || []);
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        toast.error(e.message || "Failed to load requests");
        setSummary({});
        setMeta({});
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, currentPage, itemsPerPage]);

  // =====================
  // Pagination
  // =====================
  const totalRows = safeNumber(meta?.TotalRows, 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    const n = Number(value);
    setItemsPerPage(Number.isFinite(n) && n > 0 ? n : 10);
    setCurrentPage(1);
  };

  // =====================
  // Create dialog helpers
  // =====================
  const loadPoItems = useCallback(
    async (keyword?: string) => {
      try {
        setLoadingPoItems(true);
        const qs = new URLSearchParams();
        qs.set("eligibleOnly", "true");
        qs.set("page", "1");
        qs.set("pageSize", "50");

        if (keyword && keyword.trim()) {
          qs.set("q", keyword.trim());
        }

        if (user.role === "vendor" && user.company) {
          qs.set("vendor", user.company);
        }

        const raw = await apiFetch<any>(`${API.PO_ITEMS()}?${qs.toString()}`, {
          method: "GET",
        });

        const payload = unwrap(raw);
        const items: PoItemRow[] = payload?.items || payload || [];

        setPoItems(items);
      } catch (e: any) {
        if (e?.message !== "Session expired") {
          toast.error(e.message || "Failed to load PO items");
          setPoItems([]);
        }
      } finally {
        setLoadingPoItems(false);
      }
    },
    [user.role, user.company],
  );

  const resetCreateForm = () => {
    setSelectedPO("");
    setSelectedItem("");
    setNewETADays("");
    setNewEtd(todayStart());
    setNewLeadtimeDays("");
    setRescheduleReason("");
    setEvidenceFile(null);
    setSelectedDelayReasonId("");
    setPendingReEtaAlert(null);
    setPoItemDetail(null);
    setConfirmationChecked(false);
  };

  const fetchDelayReasons = async () => {
    try {
      setLoadingDelayReasons(true);
      const raw = await apiFetch<any>(API.DELAY_REASONS_LIST(), {
        method: "GET",
      });
      const list: any[] = Array.isArray(raw)
        ? raw
        : (raw?.Data ?? raw?.data ?? raw?.Items ?? raw?.items ?? []);
      setDelayReasons(
        list.map((r: any) => ({
          id: r.ID ?? r.id,
          title: r.TITLE ?? r.title ?? "",
          describe: r.DESCRIBE ?? r.describe ?? "",
        })),
      );
    } catch {
      // silently ignore — dropdown is optional
    } finally {
      setLoadingDelayReasons(false);
    }
  };

  const handleOpenCreateDialog = async () => {
    setCreateDialog(true);
    resetCreateForm();
    setPoItems([]);
    await fetchDelayReasons();
  };

  const handleCloseCreateDialog = () => {
    setCreateDialog(false);
    resetCreateForm();
  };

  const checkPendingReEta = async (purchaseDocument: string) => {
    if (!purchaseDocument) {
      setPendingReEtaAlert(null);
      return;
    }

    try {
      const url = `${API.REETA_DETAIL(0)}?purchaseDocument=${encodeURIComponent(purchaseDocument)}`;
      const raw = await apiFetch<any>(url, { method: "GET" });
      const payload = unwrap(raw);

      const status =
        payload?.["Reschedule Status"] ?? payload?.rescheduleStatus ?? "";
      if (String(status).toUpperCase() === "PENDING") {
        setPendingReEtaAlert(
          "Waiting for Re-ETA approval. Please wait until the request is reviewed before proceeding.",
        );
      } else {
        setPendingReEtaAlert(null);
      }
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        console.error("[ReEta] check pending failed:", e);
      }
      setPendingReEtaAlert(null);
    }
  };

  const uniquePONumbers = useMemo(
    () => Array.from(new Set(poItems.map((x) => x["Purchasing Document"]))),
    [poItems],
  );

  const itemsForSelectedPO = useMemo(() => {
    if (!selectedPO) return [];
    return poItems.filter((x) => x["Purchasing Document"] === selectedPO);
  }, [poItems, selectedPO]);

  const selectedPoItem = useMemo(() => {
    if (!selectedPO || !selectedItem) return null;

    return (
      poItems.find(
        (x) =>
          x["Purchasing Document"] === selectedPO && x.Item === selectedItem,
      ) || null
    );
  }, [poItems, selectedPO, selectedItem]);

  const currentEtaDisplay = useMemo(() => {
    if (!selectedPoItem) return null;
    return (
      // poItemDetail?.["Delivery date"] ??
      // poItemDetail?.DeliveryDate ??
      selectedPoItem.ReEtaDate ?? selectedPoItem.ETD ?? null
    );
  }, [selectedPoItem, poItemDetail]);

  useEffect(() => {
    if (!selectedPoItem) {
      setPoItemDetail(null);
      return;
    }

    const fetchPoDetail = async () => {
      setLoadingPoDetail(true);
      try {
        const res = await fetchWithAuth(
          API.DETAILPO(selectedPoItem.ID, "detail"),
          {
            method: "GET",
            headers: buildAuthHeaders(),
          },
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const data = json?.Data ?? json?.data;
        console.log(data);
        setPoItemDetail(data?.PoDetail ?? data ?? null);
      } catch (e: any) {
        console.error("[RescheduleETA] fetch PO detail failed:", e);
      } finally {
        setLoadingPoDetail(false);
      }
    };

    void fetchPoDetail();
  }, [selectedPoItem]);

  const calculateETADate = (etd: string, days: number): string => {
    const base = parseDateOnly(etd);
    if (!base) return "-";

    const eta = addDaysDateOnly(base, days);
    return formatYMD(eta);
  };

  const calculateNewETADate = (): string | null => {
    if (!selectedPoItem?.ETD) return null;

    const days = parseInt(newETADays, 10);
    if (!Number.isFinite(days) || days <= 0) return null;

    return calculateETADate(selectedPoItem.ETD, days);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPO) {
      return toast.error("Please select a Purchase Order");
    }

    if (!selectedItem) {
      return toast.error("Please select an Item of Requisition");
    }

    if (!selectedPoItem) {
      return toast.error("PO item not found");
    }

    if (!newEtd) {
      return toast.error("Please select a valid new ETD");
    }

    const newLeadtime = parseInt(newLeadtimeDays, 10);
    if (!newLeadtimeDays || Number.isNaN(newLeadtime) || newLeadtime <= 0) {
      return toast.error("Please enter a valid new lead time");
    }

    if (!rescheduleReason.trim()) {
      return toast.error("Please provide a reason for rescheduling");
    }

    if (!selectedDelayReasonId) {
      return toast.error("Please select a category reason");
    }

    const proposedEtaDays = newLeadtime;
    const newEtdFormatted = formatYMD(newEtd);
    const currentEtaDate = parseDateOnly(currentEtaDisplay);

    const formData = new FormData();
    formData.append("IdPoItem", String(selectedPoItem.ID ?? ""));
    formData.append(
      "PoNumber",
      String(selectedPoItem["Purchasing Document"] ?? ""),
    );
    formData.append("PoItemNo", String(selectedPoItem.Item ?? ""));
    formData.append(
      "VendorName",
      String(selectedPoItem["Name of Supplier"] ?? ""),
    );
    if (currentEtaDate) {
      formData.append("CurrentETA", formatYMD(currentEtaDate));
    }
    if (newEtdFormatted) {
      formData.append("NewETD", newEtdFormatted);
    }
    formData.append("ProposedEtaDays", String(proposedEtaDays));
    formData.append("Reason", rescheduleReason.trim());
    if (selectedDelayReasonId) {
      formData.append("DelayReasonId", selectedDelayReasonId);
    }
    if (evidenceFile) {
      formData.append("EvidenceFile", evidenceFile);
    }

    try {
      setLoading(true);

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

      toast.success("Reschedule request submitted successfully");
      setConfirmationModalOpen(false);
      setConfirmationChecked(false);
      handleCloseCreateDialog();
      setCurrentPage(1);
      await fetchList();
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        toast.error(e?.message || "Failed submit request");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClickSubmitRequest = () => {
    if (loading) return;

    if (!selectedPO) {
      return toast.error("Please select a Purchase Order");
    }

    if (!selectedItem) {
      return toast.error("Please select an Item of Requisition");
    }

    if (!selectedPoItem) {
      return toast.error("PO item not found");
    }

    if (!newEtd) {
      return toast.error("Please select a valid new ETD");
    }

    const newLeadtime = parseInt(newLeadtimeDays, 10);
    if (!newLeadtimeDays || Number.isNaN(newLeadtime) || newLeadtime <= 0) {
      return toast.error("Please enter a valid new lead time");
    }

    if (!rescheduleReason.trim()) {
      return toast.error("Please provide a reason for rescheduling");
    }

    if (!selectedDelayReasonId) {
      return toast.error("Please select a category reason");
    }

    if (pendingReEtaAlert) {
      return toast.error(pendingReEtaAlert);
    }

    setConfirmationModalOpen(true);
    setConfirmationChecked(false);
  };

  const openConfirmationModal = () => {
    setConfirmationModalOpen(true);
    setConfirmationChecked(false);
  };

  const closeConfirmationModal = () => {
    setConfirmationModalOpen(false);
    setConfirmationChecked(false);
  };

  const handleConfirmedSubmit = () => {
    if (!confirmationChecked) return;
    void handleSubmitRequest();
  };

  // =====================
  // Approve / Reject
  // =====================
  const handleOpenActionDialog = (
    type: "approve" | "reject",
    request: ReEtaRow,
  ) => {
    setActionDialog({
      open: true,
      type,
      request,
    });
    setRemark("");
    setUploadedFile(null);
  };

  const handleCloseActionDialog = () => {
    setActionDialog({
      open: false,
      type: null,
      request: null,
    });
    setRemark("");
    setUploadedFile(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPdfOrImageFile(file)) {
      return toast.error("Only PDF or Image files are allowed");
    }

    if (!isValidFileSize(file, 1)) {
      return toast.error("File size must not exceed 1MB");
    }

    setUploadedFile(file);
    toast.success("File uploaded successfully");
  };

  const handleEvidenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleSubmitAction = async () => {
    const req = actionDialog.request;
    if (!req || !actionDialog.type) return;

    if (!remark.trim()) {
      return toast.error("Please provide a reason or remark");
    }

    if (actionDialog.type === "reject" && !uploadedFile) {
      return toast.error("Record of Event file is required for rejection");
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("Feedback", remark.trim());
      if (uploadedFile) {
        formData.append("AttachmentFile", uploadedFile);
      }

      const token = getAuthToken();
      const endpoint =
        actionDialog.type === "approve"
          ? API.REETA_APPROVE(req.ID)
          : API.REETA_REJECT(req.ID);
      const res = await fetchWithAuth(endpoint, {
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

      toast.success(
        actionDialog.type === "approve"
          ? "Request approved successfully"
          : "Request rejected successfully",
      );

      handleCloseActionDialog();
      await fetchList();
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        toast.error(e.message || "Failed process request");
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Details
  // =====================
  const handleViewDetails = async (request: ReEtaRow) => {
    try {
      const raw = await apiFetch<any>(API.REETA_DETAIL(request.ID), {
        method: "GET",
      });

      const payload = unwrap(raw);
      // Pastikan Current ETA di modal sama persis dengan nilai di kolom tabel
      if (
        payload &&
        typeof payload === "object" &&
        request["Current ETA"] !== undefined
      ) {
        // payload["Current ETA"] = request["Current ETA"];
      }
      console.log("payload re eta detail", payload);
      setDetailsDialog({
        open: true,
        request: payload || request,
      });
    } catch (e: any) {
      if (e?.message === "Session expired") return;

      setDetailsDialog({
        open: true,
        request,
      });
    }
  };

  // =====================
  // Vendor response
  // =====================
  const handleOpenVendorResponseDialog = async (request: ReEtaRow) => {
    setLoading(true);
    try {
      const raw = await apiFetch<any>(API.REETA_DETAIL(request.ID), {
        method: "GET",
      });
      const payload = unwrap(raw);
      if (
        payload &&
        typeof payload === "object" &&
        request["Current ETA"] !== undefined
      ) {
        payload["Current ETA"] = request["Current ETA"];
      }
      setVendorResponseDialog({
        open: true,
        request: payload || request,
      });
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        setVendorResponseDialog({
          open: true,
          request,
        });
      }
    } finally {
      setLoading(false);
    }
    setVendorResponseFile(null);
    setVendorDelayReasonId("");
    setVendorRemark("");
  };

  const handleCloseVendorResponseDialog = () => {
    setVendorResponseDialog({
      open: false,
      request: null,
    });
    setVendorResponseFile(null);
    setVendorDelayReasonId("");
    setVendorRemark("");
  };

  const handleVendorResponseFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPdfOrImageFile(file)) {
      return toast.error("Only PDF or Image files are allowed");
    }

    if (!isValidFileSize(file, 1)) {
      return toast.error("File size must not exceed 1MB");
    }

    setVendorResponseFile(file);
    toast.success("File uploaded successfully");
  };

  const handleSubmitVendorResponse = async () => {
    if (!vendorResponseFile) {
      return toast.error("Please upload a supporting document");
    }

    const req = vendorResponseDialog.request;
    if (!req) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("ResponseFile", vendorResponseFile);

      const token = getAuthToken();
      const res = await fetchWithAuth(API.REETA_VENDOR_RESPONSE(req.ID), {
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

      toast.success("Supporting document uploaded successfully");
      handleCloseVendorResponseDialog();
      await fetchList();
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        toast.error(e.message || "Failed upload document");
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Documents
  // =====================
  const handleDownloadDoc = async (docId?: number, fallbackName?: string) => {
    if (!docId) {
      return toast.error("Document not available");
    }

    try {
      const raw = await apiFetch<any>(API.REETA_DOC(docId), {
        method: "GET",
      });

      const d = unwrap(raw);
      const base64 = d?.BASE64_DATA ?? d?.base64_data ?? d?.base64;
      const name = d?.FILE_NAME ?? fallbackName ?? "document.pdf";

      if (!base64) {
        return toast.error("No base64 data");
      }

      downloadBase64Pdf(base64, name);
    } catch (e: any) {
      if (e?.message !== "Session expired") {
        toast.error(e.message || "Failed download document");
      }
    }
  };

  // =====================
  // Derived data
  // =====================
  const totalRequests = safeNumber(summary?.["Total Requests"], 0);
  const pendingCount = safeNumber(summary?.["Pending Review"], 0);
  const approvedCount = safeNumber(summary?.Approved, 0);
  const awaitingVendorCount = safeNumber(summary?.["Awaiting Vendor Doc"], 0);
  const rejectedCount = safeNumber(summary?.Rejected, 0);

  const paginatedRequests = rows;

  const pageSizeOptions: SelectOption[] = useMemo(
    () => ["10", "25", "50", "100"].map((v) => ({ value: v, label: v })),
    [],
  );

  const poNumberOptions: SelectOption[] = useMemo(
    () => uniquePONumbers.map((po) => ({ value: po, label: po })),
    [uniquePONumbers],
  );

  const itemOptions: SelectOption[] = useMemo(
    () =>
      itemsForSelectedPO.map((item) => ({
        value: item.Item,
        label: `${item.Item} - ${item["Short Text"] || "(no description)"}`,
      })),
    [itemsForSelectedPO],
  );

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2" style={{ color: "#014357" }}>
            Reschedule ETA Requests
          </h1>
          <p className="text-gray-600">
            {user.role === "vendor"
              ? "Manage your reschedule requests"
              : "Review and process vendor reschedule requests"}
          </p>
        </div>

        {user.role === "vendor" && (
          <Button
            style={{ backgroundColor: "#014357" }}
            className="text-white hover:opacity-90"
            onClick={handleOpenCreateDialog}
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Request
          </Button>
        )}
      </div>

      <div className="relative mb-6 w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <Input
          placeholder="Search by request number, PO number, vendor, reason..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: "rgba(1, 67, 87, 0.1)" }}
            >
              <FileText className="h-4 w-4" style={{ color: "#014357" }} />
            </div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </div>
          <div className="text-3xl" style={{ color: "#014357" }}>
            {totalRequests}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: "rgba(237, 131, 45, 0.1)" }}
            >
              <Clock className="h-4 w-4" style={{ color: "#ED832D" }} />
            </div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </div>
          <div className="text-3xl" style={{ color: "#ED832D" }}>
            {pendingCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: "rgba(106, 167, 93, 0.1)" }}
            >
              <CheckCircle2 className="h-4 w-4" style={{ color: "#6AA75D" }} />
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="text-3xl" style={{ color: "#6AA75D" }}>
            {approvedCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: "rgba(255, 165, 0, 0.1)" }}
            >
              <AlertCircle className="h-4 w-4" style={{ color: "#FFA500" }} />
            </div>
            <div className="text-xs text-gray-600">Awaiting Vendor Doc</div>
          </div>
          <div className="text-3xl" style={{ color: "#FFA500" }}>
            {awaitingVendorCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: "rgba(212, 24, 61, 0.1)" }}
            >
              <XCircle className="h-4 w-4" style={{ color: "#d4183d" }} />
            </div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="text-3xl" style={{ color: "#d4183d" }}>
            {rejectedCount}
          </div>
        </Card>
      </div>

      <Card>
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request No</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Item</TableHead>
                {user.role === "admin" && <TableHead>Vendor</TableHead>}
                <TableHead>Current ETA</TableHead>
                <TableHead>NEW ETA</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <FileCheck className="h-4 w-4" />
                    Docs
                  </div>
                </TableHead>
                <TableHead className="sticky right-[140px] z-10 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                  Status
                </TableHead>
                <TableHead
                  className="sticky right-0 z-10 bg-white"
                  style={{ width: "140px", minWidth: "140px" }}
                >
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={user.role === "admin" ? 10 : 9}>
                    <div className="flex items-center justify-center gap-2 py-10 text-gray-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user.role === "admin" ? 10 : 9}>
                    <div className="py-10 text-center text-gray-500">
                      No data
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRequests.map((r) => (
                  <TableRow
                    key={r.ID}
                    className={`group ${
                      isAwaitingVendorDoc(r) ? "bg-orange-50" : ""
                    }`}
                  >
                    <TableCell>{r.POREETANUMBER}</TableCell>
                    <TableCell>{r["PO Number"] || "-"}</TableCell>
                    <TableCell>{r["PO Item No"] || "-"}</TableCell>
                    {user.role === "admin" && (
                      <TableCell>{r["Vendor Name"] || "-"}</TableCell>
                    )}

                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(r["Current ETA"])}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      <div
                        className="flex items-center gap-1"
                        style={{ color: "#ED832D" }}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDate(getRequestedEtaDate(r))}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-gray-600">
                      {formatDate(r.CREATED_AT)}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {r.HasFeedbackAttachment || r["Feedback Doc ID"] ? (
                          <Badge
                            variant="outline"
                            className="w-fit text-xs"
                            style={{
                              borderColor: "#014357",
                              color: "#014357",
                            }}
                          >
                            Admin ✓
                          </Badge>
                        ) : null}

                        {r.HasVendorResponse || r["VendorResp Doc ID"] ? (
                          <Badge
                            variant="outline"
                            className="w-fit text-xs"
                            style={{
                              borderColor: "#008383",
                              color: "#008383",
                            }}
                          >
                            Vendor ✓
                          </Badge>
                        ) : null}

                        {!(
                          r.HasFeedbackAttachment ||
                          r["Feedback Doc ID"] ||
                          r.HasVendorResponse ||
                          r["VendorResp Doc ID"]
                        ) && <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </TableCell>

                    <TableCell
                      className={`sticky right-[140px] z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)] ${
                        isAwaitingVendorDoc(r) ? "bg-orange-50" : "bg-white"
                      } group-hover:bg-muted/50`}
                    >
                      <Badge
                        style={{
                          backgroundColor: getStatusColor(
                            r["Reschedule Status"],
                          ),
                        }}
                        className="whitespace-nowrap text-xs text-white"
                      >
                        {getStatusLabel(r["Reschedule Status"])}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className={`sticky right-0 z-10 ${
                        isAwaitingVendorDoc(r) ? "bg-orange-50" : "bg-white"
                      } group-hover:bg-muted/50`}
                      style={{ width: "140px", minWidth: "140px" }}
                    >
                      <div className="flex gap-2">
                        {user.role === "vendor" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{
                                borderColor: "#014357",
                                color: "#014357",
                              }}
                              onClick={() => handleViewDetails(r)}
                              className="h-9 w-9 p-0"
                              title="View Details"
                              disabled={loading}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {isAwaitingVendorDoc(r) && (
                              <Button
                                size="sm"
                                style={{ backgroundColor: "#FFA500" }}
                                className="h-9 w-9 p-0 text-white"
                                onClick={() =>
                                  handleOpenVendorResponseDialog(r)
                                }
                                title="Upload Document"
                                disabled={loading}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            style={{
                              borderColor: "#014357",
                              color: "#014357",
                            }}
                            onClick={() => handleViewDetails(r)}
                            disabled={loading}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Details
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-4 border-t px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-gray-600">
              Rows per page:
            </span>

            <div className="w-[90px]">
              <SearchableSelect
                value={itemsPerPage.toString()}
                onChange={handleItemsPerPageChange}
                placeholder="Rows"
                searchPlaceholder="Search size..."
                options={pageSizeOptions}
                disabled={loading}
              />
            </div>
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

              {[...Array(totalPages)].map((_, idx) => {
                const pageNumber = idx + 1;

                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 &&
                    pageNumber <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }

                if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return <PaginationEllipsis key={pageNumber} />;
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

          <div className="whitespace-nowrap text-sm text-gray-600">
            Page {currentPage} of {totalPages} • Total {totalRows} rows
          </div>
        </div>
      </Card>

      <Dialog
        open={createDialog}
        onOpenChange={(open) => !open && handleCloseCreateDialog()}
      >
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle style={{ color: "#014357" }}>
              Create Reschedule ETA Request
            </DialogTitle>
            <DialogDescription>
              Submit a request to reschedule the Estimated Date of Delivery for
              your purchase order.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <Label>
                  Purchase Order Number <span className="text-red-500">*</span>
                </Label>

                <SearchableSelect
                  value={selectedPO}
                  onChange={(v) => {
                    setSelectedPO(v);
                    setSelectedItem("");
                    setPendingReEtaAlert(null);
                    void checkPendingReEta(v);
                  }}
                  placeholder="Select a purchase order"
                  searchPlaceholder="Type at least 2 characters..."
                  options={poNumberOptions}
                  disabled={loading}
                  onSearch={(keyword) => loadPoItems(keyword)}
                  loading={loadingPoItems}
                  minSearchLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Item <span className="text-red-500">*</span>
                </Label>

                <SearchableSelect
                  value={selectedItem}
                  onChange={setSelectedItem}
                  placeholder="Select an item"
                  searchPlaceholder="Search item..."
                  options={itemOptions}
                  disabled={!selectedPO || loading}
                />
              </div>

              {selectedPoItem && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Label className="mb-2 block text-sm text-gray-600">
                    Current ETA
                  </Label>
                  <p className="text-lg" style={{ color: "#014357" }}>
                    {poItemDetail?.CurrentEta
                      ? (() => {
                          const etaDate = new Date(poItemDetail.CurrentEta);
                          const days = poItemDetail?.CurrentETADays;
                          if (days && !Number.isNaN(Number(days))) {
                            const calculated = addDaysDateOnly(
                              etaDate,
                              Number(days),
                            );
                            return formatDate(formatYMD(calculated));
                          }
                          return formatDate(poItemDetail.CurrentEta);
                        })()
                      : currentEtaDisplay
                        ? formatDate(currentEtaDisplay)
                        : "Not set"}
                  </p>
                </div>
              )}

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
                        disabled={!selectedPoItem || loading}
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
                    disabled={!selectedPoItem || loading}
                  />
                </div>
              </div>

              {selectedPoItem && newEtd && newLeadtimeDays && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Label className="mb-2 block text-sm text-gray-600">
                    New ETA (New ETD + New Lead Time)
                  </Label>
                  <p className="text-lg" style={{ color: "#014357" }}>
                    {(() => {
                      const days = parseInt(newLeadtimeDays, 10);
                      if (!Number.isFinite(days) || days <= 0) return "Not set";
                      const newEtaDate = addDaysDateOnly(newEtd, days);
                      return `${formatDate(formatYMD(newEtaDate))}`;
                    })()}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Category Reason <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  value={selectedDelayReasonId}
                  onChange={setSelectedDelayReasonId}
                  placeholder={
                    loadingDelayReasons
                      ? "Loading categories..."
                      : "Select a category"
                  }
                  searchPlaceholder="Search category..."
                  emptyText="No categories found"
                  options={delayReasons.map((dr) => ({
                    value: String(dr.id),
                    label: dr.title,
                  }))}
                  disabled={loading || loadingDelayReasons}
                />
                {selectedDelayReasonId &&
                  (() => {
                    const found = delayReasons.find(
                      (dr) => String(dr.id) === selectedDelayReasonId,
                    );
                    return found?.describe ? (
                      <p className="text-xs text-gray-500">{found.describe}</p>
                    ) : null;
                  })()}
              </div>

              <div className="space-y-2">
                <Label>
                  Reason for Rescheduling{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Provide a detailed reason for the reschedule request..."
                  rows={4}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="resize-none"
                  disabled={loading}
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
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(156, 163, 175, 0.15)" }}
                    >
                      <Upload
                        className="h-5 w-5"
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
                      disabled={loading}
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
                      disabled={loading}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {pendingReEtaAlert && (
                <div
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{
                    backgroundColor: "rgba(237, 131, 45, 0.06)",
                    border: "1px solid rgba(237, 131, 45, 0.15)",
                  }}
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "#ED832D" }}
                  />
                  <p className="text-sm text-gray-700">{pendingReEtaAlert}</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={handleCloseCreateDialog}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              style={{
                backgroundColor: pendingReEtaAlert ? "#9CA3AF" : "#014357",
              }}
              className="text-white hover:opacity-90"
              onClick={handleClickSubmitRequest}
              disabled={loading || !!pendingReEtaAlert}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
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
              Apabila Vendor tidak memenuhi waktu supply sebagaimana tercantum
              dalam kontrak, maka hal tersebut akan dikategorikan sebagai
              pelanggaran kontraktual dan Procurement berhak untuk menjatuhkan
              sanksi sesuai dengan ketentuan yang telah disepakati, termasuk
              namun tidak terbatas pada:
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
              <li>Penerbitan surat peringatan tertulis (SP) kepada Vendor;</li>
              <li>
                Pembekuan sementara aktivitas supply hingga kewajiban dipenuhi;
              </li>
              <li>
                Pemutusan kontrak secara sepihak apabila keterlambatan terjadi
                secara berulang atau berdampak signifikan terhadap operasional
                perusahaan;
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
              seluruh ketentuan serta sanksi yang tercantum dalam kontrak dan
              pernyataan ini.
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
                Saya telah membaca, memahami, dan menyetujui seluruh ketentuan
                serta sanksi terkait keterlambatan supply sebagaimana tercantum
                dalam kontrak dan pernyataan ini.
              </span>
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeConfirmationModal}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmedSubmit}
              disabled={loading || !confirmationChecked}
              style={{
                backgroundColor:
                  confirmationChecked && !loading ? "#014357" : "#94A3B8",
              }}
              className="text-white hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Saya Setuju & Lanjutkan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user.role === "admin" && (
        <Dialog
          open={actionDialog.open}
          onOpenChange={(open) => !open && handleCloseActionDialog()}
        >
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle style={{ color: "#014357" }}>
                {actionDialog.type === "approve" ? "Approve" : "Reject"}{" "}
                Reschedule Request
              </DialogTitle>
              <DialogDescription>
                {actionDialog.type === "approve"
                  ? "Review the request details and provide your approval remark."
                  : "Review the request details, provide a reason, and upload the required Record of Event."}
              </DialogDescription>
            </DialogHeader>

            {actionDialog.request && (
              <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
                <div className="space-y-6 py-2">
                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
                      style={{
                        borderColor:
                          actionDialog.type === "approve"
                            ? "#6AA75D"
                            : "#d4183d",
                      }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            actionDialog.type === "approve"
                              ? "#6AA75D"
                              : "#d4183d",
                        }}
                      />
                      <h3
                        className="text-lg tracking-wide"
                        style={{ color: "#014357" }}
                      >
                        Request Information
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Request No
                          </p>
                          <p className="text-sm">
                            {actionDialog.request.POREETANUMBER}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Vendor
                          </p>
                          <p className="text-sm">
                            {actionDialog.request["Vendor Name"] || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            PO
                          </p>
                          <p className="text-sm">
                            {actionDialog.request["PO Number"] || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Item
                          </p>
                          <p className="text-sm">
                            {actionDialog.request["PO Item No"] || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Item Description
                          </p>
                          <p className="text-sm">
                            {actionDialog.request.ShortText || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Request Date
                          </p>
                          <p className="text-sm">
                            {formatDate(actionDialog.request.CREATED_AT)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3
                          className="text-lg tracking-wide mb-4"
                          style={{ color: "#014357" }}
                        >
                          ETA Details
                        </h3>

                        {(() => {
                          const diff = getEtaDayDifference(
                            actionDialog.request,
                          );
                          if (diff > 0) {
                            return (
                              <div
                                className="mb-4 flex items-center gap-3 rounded-lg p-3"
                                style={{
                                  backgroundColor: "rgba(237, 131, 45, 0.06)",
                                  border: "1px solid rgba(237, 131, 45, 0.15)",
                                }}
                              >
                                <AlertTriangle
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: "#ED832D" }}
                                />
                                <p className="text-sm text-gray-700">
                                  New ETA is {diff} day{diff > 1 ? "s" : ""}{" "}
                                  later than current ETA
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <div>
                              <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                                CURRENT ETD
                              </p>
                              <p className="text-sm font-medium">
                                {formatDate(actionDialog.request.CurrentETD) ||
                                  "-"}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                                CURRENT ETA
                              </p>
                              <p className="text-sm font-medium">
                                {formatDate(
                                  actionDialog.request["Current ETA"],
                                ) || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">
                                {safeNumber(
                                  actionDialog.request["ETA Days"],
                                  actionDialog.request["Proposed ETA"],
                                )}{" "}
                                days after ETD
                              </p>
                            </div>
                          </div>

                          <div
                            className="rounded-lg border p-4 space-y-3"
                            style={{
                              backgroundColor: "#FFF4E6",
                              borderColor: "#ED832D",
                            }}
                          >
                            <div>
                              <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                                NEW ETD
                              </p>
                              <p
                                className="text-sm font-medium"
                                style={{ color: "#ED832D" }}
                              >
                                {formatDate(
                                  actionDialog.request.CurrentNewETA,
                                ) || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                                NEW ETA
                              </p>
                              <p
                                className="text-sm font-medium"
                                style={{ color: "#ED832D" }}
                              >
                                {formatDate(
                                  getRequestedEtaDate(actionDialog.request),
                                ) || "-"}
                              </p>
                            </div>
                            <div>
                              <p
                                className="text-xs"
                                style={{ color: "#ED832D" }}
                              >
                                +{getRequestedEtaDesc(actionDialog.request)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                          Vendor&apos;s Reason
                        </p>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                          {actionDialog.request.DelayReasonTitle && (
                            <div className="flex flex-col gap-1">
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                Category
                              </p>
                              <div className="flex items-start gap-2">
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: "rgba(1, 67, 87, 0.1)",
                                    color: "#014357",
                                  }}
                                >
                                  {actionDialog.request.DelayReasonTitle}
                                </span>
                              </div>
                              {actionDialog.request.DelayReasonDescription && (
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  {actionDialog.request.DelayReasonDescription}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col gap-1">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Remark
                            </p>
                            <p className="text-sm leading-relaxed">
                              {actionDialog.request["Reschedule Reason"] || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
                      style={{
                        borderColor:
                          actionDialog.type === "approve"
                            ? "#6AA75D"
                            : "#d4183d",
                      }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            actionDialog.type === "approve"
                              ? "#6AA75D"
                              : "#d4183d",
                        }}
                      />
                      <h3
                        className="text-lg tracking-wide"
                        style={{ color: "#014357" }}
                      >
                        {actionDialog.type === "approve"
                          ? "Approval Remark"
                          : "Rejection Details"}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">
                          {actionDialog.type === "approve"
                            ? "Remark"
                            : "Reason for Rejection"}
                          <span className="ml-1 text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={
                            actionDialog.type === "approve"
                              ? "Enter your approval remark..."
                              : "Provide detailed reason..."
                          }
                          rows={4}
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          className="resize-none"
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block">
                          Record of Event (PDF / Image)
                          {actionDialog.type === "reject" && (
                            <span className="ml-1 text-red-500">*</span>
                          )}
                          {actionDialog.type === "approve" && (
                            <span className="ml-1 text-gray-500">
                              (Optional)
                            </span>
                          )}
                        </Label>
                        <p className="mb-3 text-xs text-gray-500">
                          {actionDialog.type === "reject"
                            ? "Supporting documentation for rejection (PDF / Image, max 1MB)"
                            : "Optional supporting documentation (PDF / Image, max 1MB)"}
                        </p>

                        {!uploadedFile ? (
                          <label
                            className="flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all hover:border-gray-400 hover:bg-gray-50"
                            style={{
                              borderColor:
                                actionDialog.type === "approve"
                                  ? "#6AA75D"
                                  : "#d4183d",
                            }}
                          >
                            <div className="text-center">
                              <div
                                className="mx-auto mb-3 rounded-full p-3"
                                style={{
                                  backgroundColor:
                                    actionDialog.type === "approve"
                                      ? "#E8F5E9"
                                      : "#FFE6EB",
                                  width: "fit-content",
                                }}
                              >
                                <Upload
                                  className="h-6 w-6"
                                  style={{
                                    color:
                                      actionDialog.type === "approve"
                                        ? "#6AA75D"
                                        : "#d4183d",
                                  }}
                                />
                              </div>
                              <p
                                className="mb-1 text-sm"
                                style={{ color: "#014357" }}
                              >
                                Click to upload PDF / Image Document
                              </p>
                              <p className="text-xs text-gray-500">
                                Maximum file size: 1MB
                              </p>
                            </div>

                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleFileUpload}
                              disabled={loading}
                            />
                          </label>
                        ) : (
                          <div
                            className="flex items-center justify-between rounded-lg border-2 p-4"
                            style={{
                              backgroundColor:
                                actionDialog.type === "approve"
                                  ? "#E8F5E9"
                                  : "#FFE6EB",
                              borderColor:
                                actionDialog.type === "approve"
                                  ? "#6AA75D"
                                  : "#d4183d",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="rounded p-2"
                                style={{
                                  backgroundColor:
                                    actionDialog.type === "approve"
                                      ? "#6AA75D"
                                      : "#d4183d",
                                }}
                              >
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p
                                  className="text-sm"
                                  style={{ color: "#014357" }}
                                >
                                  {uploadedFile.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {(uploadedFile.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUploadedFile(null)}
                              className="hover:bg-white/50"
                              disabled={loading}
                            >
                              <X
                                className="h-4 w-4"
                                style={{
                                  color:
                                    actionDialog.type === "approve"
                                      ? "#6AA75D"
                                      : "#d4183d",
                                }}
                              />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={handleCloseActionDialog}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                style={{
                  backgroundColor:
                    actionDialog.type === "approve" ? "#6AA75D" : "#d4183d",
                }}
                className="text-white"
                onClick={handleSubmitAction}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {actionDialog.type === "approve"
                  ? "Approve Request"
                  : "Reject Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={detailsDialog.open}
        onOpenChange={(open) =>
          !open && setDetailsDialog({ open: false, request: null })
        }
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle style={{ color: "#014357" }}>
              Request Details
            </DialogTitle>
            <DialogDescription>
              View complete information about this reschedule request.
            </DialogDescription>

            {detailsDialog.request && (
              <div className="flex items-center gap-2 pt-2">
                <Badge
                  style={{
                    backgroundColor: getStatusColor(
                      detailsDialog.request["Reschedule Status"],
                    ),
                  }}
                  className="px-4 py-1.5 text-white"
                >
                  {getStatusLabel(detailsDialog.request["Reschedule Status"])}
                </Badge>
              </div>
            )}
          </DialogHeader>

          {detailsDialog.request && (
            <ScrollArea className="max-h-[calc(85vh-220px)] pr-4">
              <div className="space-y-6 py-2">
                <div>
                  <div
                    className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                      Basic Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        Request No
                      </p>
                      <p className="text-sm">
                        {detailsDialog.request.POREETANUMBER}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        Vendor
                      </p>
                      <p className="text-sm">
                        {detailsDialog.request["Vendor Name"] || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        PO
                      </p>
                      <p className="text-sm">
                        {detailsDialog.request["PO Number"] || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        Item
                      </p>
                      <p className="text-sm">
                        {detailsDialog.request["PO Item No"] || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        Item Description
                      </p>
                      <p className="text-sm">
                        {detailsDialog.request.ShortText || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                        Request Date
                      </p>
                      <p className="text-sm">
                        {formatDate(detailsDialog.request.CREATED_AT)}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                      ETA Details
                    </h3>
                  </div>

                  {(() => {
                    const diff = getEtaDayDifference(detailsDialog.request);
                    if (diff > 0) {
                      return (
                        <div
                          className="mb-4 flex items-center gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(237, 131, 45, 0.06)",
                            border: "1px solid rgba(237, 131, 45, 0.15)",
                          }}
                        >
                          <AlertTriangle
                            className="h-4 w-4 shrink-0"
                            style={{ color: "#ED832D" }}
                          />
                          <p className="text-sm text-gray-700">
                            New ETA is {diff} day{diff > 1 ? "s" : ""} later
                            than current ETA
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                          CURRENT ETD
                        </p>
                        <p className="text-sm font-medium">
                          {formatDate(detailsDialog.request.CurrentETD) || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                          CURRENT ETA
                        </p>
                        <p className="text-sm font-medium">
                          {formatDate(detailsDialog.request["Current ETA"]) ||
                            "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">
                          {safeNumber(detailsDialog.request["ETA Days"], 0)}{" "}
                          days after ETD
                        </p>
                      </div>
                    </div>

                    <div
                      className="rounded-lg border p-4 space-y-3"
                      style={{
                        backgroundColor: "#FFF4E6",
                        borderColor: "#ED832D",
                      }}
                    >
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                          NEW ETD
                        </p>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "#ED832D" }}
                        >
                          {formatDate(detailsDialog.request.CurrentNewETA) ||
                            "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                          NEW ETA
                        </p>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "#ED832D" }}
                        >
                          {formatDate(
                            getRequestedEtaDate(detailsDialog.request),
                          ) || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "#ED832D" }}>
                          +{getRequestedEtaDesc(detailsDialog.request)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                      Vendor&apos;s Reason
                    </h3>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    {detailsDialog.request.DelayReasonTitle && (
                      <div className="flex flex-col gap-1">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Category
                        </p>
                        <div className="flex items-start gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: "rgba(1, 67, 87, 0.1)",
                              color: "#014357",
                            }}
                          >
                            {detailsDialog.request.DelayReasonTitle}
                          </span>
                        </div>
                        {detailsDialog.request.DelayReasonDescription && (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {detailsDialog.request.DelayReasonDescription}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Remark
                      </p>
                      <p className="text-sm leading-relaxed">
                        {detailsDialog.request["Reschedule Reason"] || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Vendor Re ETA Request Evidence */}
                  {detailsDialog.request.EvidenceBase64 && (
                    <div>
                      <Label className="mb-3 mt-3 block">
                        Vendor Re ETA Request Evidence
                      </Label>

                      <div
                        className="flex items-center justify-between rounded-lg border-2 p-4"
                        style={{
                          backgroundColor: "#F9FAFB",
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="rounded p-2"
                            style={{ backgroundColor: "#9CA3AF" }}
                          >
                            <FileText className="h-6 w-6 text-white" />
                          </div>

                          <div>
                            <p className="text-sm" style={{ color: "#014357" }}>
                              {detailsDialog.request.EvidenceFileName ||
                                "Evidence Document"}
                            </p>
                            <p className="text-xs text-gray-600">
                              {detailsDialog.request.EvidenceContentType?.includes(
                                "pdf",
                              )
                                ? "PDF Document"
                                : "Image Document"}
                              {detailsDialog.request.EvidenceSize
                                ? ` • ${(detailsDialog.request.EvidenceSize / 1024).toFixed(1)} KB`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const base64 =
                                detailsDialog.request?.EvidenceBase64;
                              if (!base64) return;
                              const mime =
                                detailsDialog.request?.EvidenceContentType ||
                                "application/octet-stream";
                              const byteCharacters = atob(base64);
                              const byteNumbers = new Array(
                                byteCharacters.length,
                              );
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                              }
                              const byteArray = new Uint8Array(byteNumbers);
                              const blob = new Blob([byteArray], {
                                type: mime,
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download =
                                detailsDialog.request?.EvidenceFileName ||
                                "evidence_document";
                              a.click();
                              setTimeout(
                                () => URL.revokeObjectURL(url),
                                60_000,
                              );
                            }}
                            style={{
                              borderColor: "#9CA3AF",
                              color: "#374151",
                            }}
                            className="hover:bg-gray-50"
                            disabled={loading}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {detailsDialog.request["Reschedule Status"] !== "PENDING" && (
                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
                      style={{
                        borderColor: getStatusColor(
                          detailsDialog.request["Reschedule Status"],
                        ),
                      }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: getStatusColor(
                            detailsDialog.request["Reschedule Status"],
                          ),
                        }}
                      />
                      <h3
                        className="text-lg tracking-wide"
                        style={{ color: "#014357" }}
                      >
                        Admin Response
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Processed By
                          </p>
                          <p className="text-sm">
                            {detailsDialog.request.FEEDBACK_BY || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                            Processed Date
                          </p>
                          <p className="text-sm">
                            {formatDate(detailsDialog.request.FEEDBACK_AT)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                          Remark
                        </p>
                        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed">
                          {detailsDialog.request.Feedback || "-"}
                        </p>
                      </div>

                      {user.role !== "vendor" &&
                        detailsDialog.request["Feedback Doc ID"]
                        ? (() => {
                            const status =
                              detailsDialog.request["Reschedule Status"];
                            const theme = getDocButtonTheme(status);

                            return (
                              <div>
                                <Label className="mb-2 block">
                                  Admin&apos;s Record of Event
                                </Label>

                                <div
                                  className="flex items-center justify-between rounded-lg border-2 p-4"
                                  style={{
                                    backgroundColor: theme.softBg,
                                    borderColor: theme.color,
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="rounded p-2"
                                      style={{ backgroundColor: theme.color }}
                                    >
                                      <FileText className="h-6 w-6 text-white" />
                                    </div>

                                    <div>
                                      <p
                                        className="text-sm"
                                        style={{ color: "#014357" }}
                                      >
                                        Doc #{" "}
                                        {detailsDialog.request
                                          .FeedbackFileName ||
                                          detailsDialog.request[
                                            "Feedback Doc ID"
                                          ]}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        PDF Document
                                      </p>
                                    </div>
                                  </div>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDownloadDoc(
                                        detailsDialog.request?.[
                                          "Feedback Doc ID"
                                        ],
                                        "record_of_event.pdf",
                                      )
                                    }
                                    style={{
                                      borderColor: theme.color,
                                      color: theme.color,
                                    }}
                                    className={theme.hoverClass}
                                    disabled={loading}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            );
                          })()
                        : null}

                      {detailsDialog.request["VendorResp Doc ID"] ? (
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            Vendor&apos;s Supporting Document
                          </p>
                          <div
                            className="flex items-center justify-between rounded-lg border-2 p-4"
                            style={{
                              backgroundColor: "rgba(0, 131, 131, 0.1)",
                              borderColor: "#008383",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="rounded p-2"
                                style={{ backgroundColor: "#008383" }}
                              >
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p
                                  className="text-sm"
                                  style={{ color: "#014357" }}
                                >
                                  Doc #{" "}
                                  {detailsDialog.request["VendorResp Doc ID"]}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Uploaded{" "}
                                  {formatDate(
                                    detailsDialog.request.VENDOR_RESPONSE_AT,
                                  )}
                                </p>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDownloadDoc(
                                  detailsDialog.request?.["VendorResp Doc ID"],
                                  "vendor_response.pdf",
                                )
                              }
                              style={{
                                borderColor: "#008383",
                                color: "#008383",
                              }}
                              className="hover:bg-teal-50"
                              disabled={loading}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            {user.role === "admin" &&
            detailsDialog.request?.["Reschedule Status"] === "PENDING" ? (
              <>
                <Button
                  onClick={() => {
                    const req = detailsDialog.request!;
                    setDetailsDialog({ open: false, request: null });
                    handleOpenActionDialog("reject", req);
                  }}
                  style={{ backgroundColor: "#d4183d", color: "white" }}
                  disabled={loading}
                >
                  Reject
                </Button>

                <Button
                  onClick={() => {
                    const req = detailsDialog.request!;
                    setDetailsDialog({ open: false, request: null });
                    handleOpenActionDialog("approve", req);
                  }}
                  style={{ backgroundColor: "#6AA75D" }}
                  className="text-white"
                  disabled={loading}
                >
                  Approve
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setDetailsDialog({ open: false, request: null })}
                disabled={loading}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user.role === "vendor" && (
        <Dialog
          open={vendorResponseDialog.open}
          onOpenChange={(open) => !open && handleCloseVendorResponseDialog()}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle style={{ color: "#014357" }}>
                Upload Supporting Document
              </DialogTitle>
              <DialogDescription>
                The admin has rejected your request with a supporting document.
                Please upload your response document.
              </DialogDescription>
            </DialogHeader>

            {vendorResponseDialog.request && (
              <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
                <div className="space-y-6">
                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                        Basic Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          Request No
                        </p>
                        <p className="text-sm">
                          {vendorResponseDialog.request.POREETANUMBER}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          Vendor
                        </p>
                        <p className="text-sm">
                          {vendorResponseDialog.request["Vendor Name"] || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          PO
                        </p>
                        <p className="text-sm">
                          {vendorResponseDialog.request["PO Number"] || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          Item
                        </p>
                        <p className="text-sm">
                          {vendorResponseDialog.request["PO Item No"] || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          Item Description
                        </p>
                        <p className="text-sm">
                          {vendorResponseDialog.request.ShortText || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
                          Request Date
                        </p>
                        <p className="text-sm">
                          {formatDate(vendorResponseDialog.request.CREATED_AT)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                        ETA Details
                      </h3>
                    </div>

                    {(() => {
                      const diff = getEtaDayDifference(
                        vendorResponseDialog.request,
                      );
                      if (diff > 0) {
                        return (
                          <div
                            className="mb-4 flex items-center gap-3 rounded-lg p-3"
                            style={{
                              backgroundColor: "rgba(237, 131, 45, 0.06)",
                              border: "1px solid rgba(237, 131, 45, 0.15)",
                            }}
                          >
                            <AlertTriangle
                              className="h-4 w-4 shrink-0"
                              style={{ color: "#ED832D" }}
                            />
                            <p className="text-sm text-gray-700">
                              New ETA is {diff} day{diff > 1 ? "s" : ""} later
                              than current ETA
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                            CURRENT ETD
                          </p>
                          <p className="text-sm font-medium">
                            {formatDate(
                              vendorResponseDialog.request.CurrentETD,
                            ) || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                            CURRENT ETA
                          </p>
                          <p className="text-sm font-medium">
                            {formatDate(
                              vendorResponseDialog.request["Current ETA"],
                            ) || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">
                            {safeNumber(
                              vendorResponseDialog.request["ETA Days"],
                              vendorResponseDialog.request["Proposed ETA"],
                            )}{" "}
                            days after ETD
                          </p>
                        </div>
                      </div>

                      <div
                        className="rounded-lg border p-4 space-y-3"
                        style={{
                          backgroundColor: "#FFF4E6",
                          borderColor: "#ED832D",
                        }}
                      >
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                            NEW ETD
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "#ED832D" }}
                          >
                            {formatDate(
                              vendorResponseDialog.request.CurrentNewETA,
                            ) || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                            NEW ETA
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "#ED832D" }}
                          >
                            {formatDate(
                              getRequestedEtaDate(vendorResponseDialog.request),
                            ) || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "#ED832D" }}>
                            +{getRequestedEtaDesc(vendorResponseDialog.request)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      className="mb-4 flex items-center gap-3 border-b-2 pb-3"
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
                        Vendor&apos;s Reason
                      </h3>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                      {vendorResponseDialog.request.DelayReasonTitle && (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Category
                          </p>
                          <div className="flex items-start gap-2">
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(1, 67, 87, 0.1)",
                                color: "#014357",
                              }}
                            >
                              {vendorResponseDialog.request.DelayReasonTitle}
                            </span>
                          </div>
                          {vendorResponseDialog.request
                            .DelayReasonDescription && (
                            <p className="text-xs text-gray-500 leading-relaxed">
                              {
                                vendorResponseDialog.request
                                  .DelayReasonDescription
                              }
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Remark
                        </p>
                        <p className="text-sm leading-relaxed">
                          {vendorResponseDialog.request["Reschedule Reason"] ||
                            "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {user.role !== "vendor" &&
                    vendorResponseDialog.request["Feedback Doc ID"] && (
                    <div>
                      <Label className="mb-2 block">
                        Admin&apos;s Record of Event
                      </Label>
                      <div
                        className="flex items-center justify-between rounded-lg border-2 p-4"
                        style={{
                          backgroundColor: "#FFE6EB",
                          borderColor: "#d4183d",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="rounded p-2"
                            style={{ backgroundColor: "#d4183d" }}
                          >
                            <FileText className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-sm" style={{ color: "#014357" }}>
                              Doc #{" "}
                              {vendorResponseDialog.request.FeedbackFileName ||
                                vendorResponseDialog.request["Feedback Doc ID"]}
                            </p>
                            <p className="text-xs text-gray-600">
                              PDF Document
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadDoc(
                              vendorResponseDialog.request?.["Feedback Doc ID"],
                              "record_of_event.pdf",
                            )
                          }
                          style={{ borderColor: "#d4183d", color: "#d4183d" }}
                          className="hover:bg-red-50"
                          disabled={loading}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="mb-2 block">
                      Your Supporting Document (PDF / Image){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <p className="mb-3 text-xs text-gray-500">
                      Upload your response document in PDF / Image format (max
                      1MB)
                    </p>

                    {!vendorResponseFile ? (
                      <label
                        className="flex h-32 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all hover:border-gray-400 hover:bg-gray-50"
                        style={{ borderColor: "#FFA500" }}
                      >
                        <div className="text-center">
                          <div
                            className="mx-auto mb-3 rounded-full p-3"
                            style={{
                              backgroundColor: "rgba(255, 165, 0, 0.1)",
                              width: "fit-content",
                            }}
                          >
                            <Upload
                              className="h-6 w-6"
                              style={{ color: "#FFA500" }}
                            />
                          </div>
                          <p
                            className="mb-1 text-sm"
                            style={{ color: "#014357" }}
                          >
                            Click to upload PDF / Image Document
                          </p>
                          <p className="text-xs text-gray-500">
                            Maximum file size: 1MB
                          </p>
                        </div>

                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleVendorResponseFileUpload}
                          disabled={loading}
                        />
                      </label>
                    ) : (
                      <div
                        className="flex items-center justify-between rounded-lg border-2 p-4"
                        style={{
                          backgroundColor: "rgba(255, 165, 0, 0.1)",
                          borderColor: "#FFA500",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="rounded p-2"
                            style={{ backgroundColor: "#FFA500" }}
                          >
                            <FileText className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-sm" style={{ color: "#014357" }}>
                              {vendorResponseFile.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {(vendorResponseFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVendorResponseFile(null)}
                          className="hover:bg-white/50"
                          disabled={loading}
                        >
                          <X className="h-4 w-4" style={{ color: "#FFA500" }} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseVendorResponseDialog}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: "#FFA500" }}
                className="text-white"
                onClick={handleSubmitVendorResponse}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
