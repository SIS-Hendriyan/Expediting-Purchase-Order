import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
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
  Plus,
  Download,
  FileCheck,
  Loader2,
  Check,
  ChevronsUpDown,
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
import { API } from "../../config";
import type { User } from "./Login";
import { getAccessToken } from "../../utils/authSession";

// Searchable dropdown (shadcn pattern)
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";

// =====================
// Types (match backend SP)
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

  "Current ETA"?: string; // date
  "Proposed ETA"?: number; // int (days)
  ResultETA?: string; // date from SP (optional)

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
  "Purchasing Document": string; // PO number
  Item: string; // item no
  "Name of Supplier": string;
  "Short Text"?: string;
  ETD?: string;
  "ETA Days"?: number;
  ReEtaDate?: string; // current ETA date (ETD + ETA days)
  Status?: string;
};

interface RescheduleETAProps {
  user: User;
}

// =====================
// Auth helpers (same style as PurchaseOrder.tsx)
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

// =====================
// Utils
// =====================
const unwrap = (json: any) => json?.data ?? json?.Data ?? json;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SelectOption = { value: string; label: string; disabled?: boolean };

function SearchableSelect(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
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
  } = props;

  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-[260px] overflow-auto">
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                disabled={opt.disabled}
                onSelect={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === opt.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "document.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
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
// ===== Date-only helpers (safe, no timezone shifting) =====
const pad2 = (n: number) => String(n).padStart(2, "0");

const monthMap: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Parse date-only dari beberapa format umum:
// - "2025-01-03"
// - "2025-01-03T00:00:00"
// - "03-Jan-2025"
// - "Jan 03, 2025"
function parseDateOnly(input?: string | null): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // ISO yyyy-mm-dd (or with time)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, m, d); // local date-only
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // dd-MMM-yyyy (e.g. 03-Jan-2025)
  const dmy = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = monthMap[dmy[2].toLowerCase()];
    const y = Number(dmy[3]);
    if (m === undefined) return null;
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Fallback: try native parse (for "Jan 03, 2025")
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;

  // normalize to date-only local
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function addDaysDateOnly(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function formatYMD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export function RescheduleETA({ user }: RescheduleETAProps) {
  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);

  // Data
  const [summary, setSummary] = useState<SummaryRow>({});
  const [meta, setMeta] = useState<MetaRow>({});
  const [rows, setRows] = useState<ReEtaRow[]>([]);

  // PO items for Create
  const [poItems, setPoItems] = useState<PoItemRow[]>([]);

  // Dialogs
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "approve" | "reject" | null;
    request: ReEtaRow | null;
  }>({ open: false, type: null, request: null });

  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; request: ReEtaRow | null }>({
    open: false,
    request: null,
  });

  const [remark, setRemark] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [vendorResponseDialog, setVendorResponseDialog] = useState<{ open: boolean; request: ReEtaRow | null }>({
    open: false,
    request: null,
  });
  const [vendorResponseFile, setVendorResponseFile] = useState<File | null>(null);

  // Create form
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [newETADays, setNewETADays] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // =====================
  // Status helpers
  // =====================
  const getStatusLabel = (s?: RequestStatus) => {
    switch (s) {
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
  };

  const getStatusColor = (s?: RequestStatus) => {
    switch (s) {
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
  };

  const isAwaitingVendorDoc = (r: ReEtaRow) => r["Reschedule Status"] === "AWAITING_VENDOR_DOC";

  // =====================
  // Fetch list
  // =====================
  const fetchList = async () => {
    try {
      setLoading(true);

      const qs = new URLSearchParams();
      if (searchQuery.trim()) qs.set("q", searchQuery.trim());
      qs.set("page", String(currentPage));
      qs.set("pageSize", String(itemsPerPage));

      const raw = await apiFetch<any>(API.REETA_LIST() + `?${qs.toString()}`, { method: "GET" });
      const payload = unwrap(raw);

      setSummary(payload?.summary || {});
      setMeta(payload?.meta || {});
      setRows(payload?.items || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load requests");
      setSummary({});
      setMeta({});
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, currentPage, itemsPerPage]);

  // =====================
  // Paging
  // =====================
  const totalRows = Number(meta?.TotalRows || 0);
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
  // PO Items (Create dialog)
  // =====================
 const loadPoItems = async () => {
  try {
    const qs = new URLSearchParams();
    qs.set("eligibleOnly", "true");
    qs.set("page", "1");
    qs.set("pageSize", "200");

    if (user.role === "vendor" && user.company) {
      qs.set("vendor", user.company);
    }

    const raw = await apiFetch<any>(API.PO_ITEMS() + `?${qs.toString()}`, {
      method: "GET",
    });

    const payload = unwrap(raw);
    console.log(payload);
    console.log(user.company);
    console.log(user);

    const items: PoItemRow[] = payload?.items || payload || [];

    setPoItems(items);
  } catch (e: any) {
    toast.error(e.message || "Failed to load PO items");
    setPoItems([]);
  }
};
  const handleOpenCreateDialog = async () => {
    setCreateDialog(true);
    setSelectedPO("");
    setSelectedItem("");
    setNewETADays("");
    setRescheduleReason("");
    await loadPoItems();
  };

  const handleCloseCreateDialog = () => {
    setCreateDialog(false);
    setSelectedPO("");
    setSelectedItem("");
    setNewETADays("");
    setRescheduleReason("");
  };

const getDocButtonColor = (s?: RequestStatus) => {
  // default kalau status undefined
  if (s === "APPROVED") return { color: "#6AA75D", hoverClass: "hover:bg-green-50" };
  if (s === "REJECTED") return { color: "#d4183d", hoverClass: "hover:bg-red-50" };
  // fallback (misal pending/awaiting)
  return { color: "#014357", hoverClass: "hover:bg-slate-50" };
};

  const uniquePONumbers = useMemo(
    () => Array.from(new Set(poItems.map((x) => x["Purchasing Document"]))),
    [poItems]
  );

  const itemsForSelectedPO = useMemo(() => {
    if (!selectedPO) return [];
    return poItems.filter((x) => x["Purchasing Document"] === selectedPO);
  }, [poItems, selectedPO]);

  const selectedPoItem = useMemo(() => {
    if (!selectedPO || !selectedItem) return null;
    return poItems.find((x) => x["Purchasing Document"] === selectedPO && x.Item === selectedItem) || null;
  }, [poItems, selectedPO, selectedItem]);

  const calculateETADate = (etd: string, days: number): string => {
     const base = parseDateOnly(etd);
  if (!base) return "-";
  const eta = addDaysDateOnly(base, days);
  return formatYMD(eta); // aman, tidak pakai toISOString()
  };

  const calculateNewETADate = (): string | null => {
    if (!selectedPoItem?.ETD) return null;
    const days = parseInt(newETADays, 10);
    if (!Number.isFinite(days) || days <= 0) return null;
    return calculateETADate(selectedPoItem.ETD, days);
  };

 const handleSubmitRequest = async () => {
  if (!selectedPO) return toast.error("Please select a Purchase Order");
  if (!selectedItem) return toast.error("Please select an Item of Requisition");

  const days = parseInt(newETADays, 10);
  if (!Number.isFinite(days) || days <= 0) return toast.error("Please enter a valid new ETA in days");
  if (!rescheduleReason.trim()) return toast.error("Please provide a reason for rescheduling");
  if (!selectedPoItem) return toast.error("PO item not found");

  const currentDays = Number(selectedPoItem["ETA Days"] ?? 0);
  if (currentDays > 0 && days <= currentDays) {
    return toast.error("New ETA days must be greater than current ETA days");
  }

  const payload = {
    idPoItem: selectedPoItem.ID,
    poNumber: selectedPoItem["Purchasing Document"],
    poItemNo: selectedPoItem.Item,
    vendorName: selectedPoItem["Name of Supplier"],
    currentEta: selectedPoItem.ReEtaDate || null,
    proposedEtaDays: days,
    reason: rescheduleReason,

    evidenceFileName: null,
    evidenceContentType: null,
    evidenceSize: null,
    evidenceBase64: null,
  };

  // ✅ DEBUG LOG (before request)
  console.log("[ReETA][CREATE] url =", API.REETA_CREATE());
  console.log("[ReETA][CREATE] payload =", payload);
  console.log("[ReETA][CREATE] token exists =", !!getAuthToken());

  try {
    setLoading(true);

    // ✅ pakai fetch langsung supaya bisa lihat raw error body
    const res = await fetch(API.REETA_CREATE(), {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const text = await res.text(); // ambil raw body dulu

    // ✅ DEBUG LOG (after request)
    console.log("[ReETA][CREATE] status =", res.status);
    console.log("[ReETA][CREATE] raw response text =", text);

    // coba parse json kalau bisa
    const parsed = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    console.log("[ReETA][CREATE] parsed json =", parsed);

    if (!res.ok) {
      const msg =
        parsed?.message ||
        parsed?.Message ||
        parsed?.error ||
        text ||
        `HTTP ${res.status}`;

      throw new Error(msg);
    }

    toast.success("Reschedule request submitted successfully");
    handleCloseCreateDialog();
    setCurrentPage(1);
    await fetchList();
  } catch (e: any) {
    // ✅ DEBUG LOG (catch)
    console.error("[ReETA][CREATE] ERROR =", e);
    console.error("[ReETA][CREATE] ERROR message =", e?.message);

    toast.error(e?.message || "Failed submit request");
  } finally {
    setLoading(false);
  }
};

  // =====================
  // Approve / Reject (Admin)
  // =====================
  const handleOpenActionDialog = (type: "approve" | "reject", request: ReEtaRow) => {
    setActionDialog({ open: true, type, request });
    setRemark("");
    setUploadedFile(null);
  };

  const handleCloseActionDialog = () => {
    setActionDialog({ open: false, type: null, request: null });
    setRemark("");
    setUploadedFile(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Only PDF files are allowed");
    if (file.size > 100 * 1024 * 1024) return toast.error("File size must not exceed 100MB");
    setUploadedFile(file);
    toast.success("File uploaded successfully");
  };

  const handleSubmitAction = async () => {
    const req = actionDialog.request;
    if (!req || !actionDialog.type) return;

    if (!remark.trim()) return toast.error("Please provide a reason or remark");
    if (actionDialog.type === "reject" && !uploadedFile) {
      return toast.error("Record of Event file is required for rejection");
    }

    try {
      setLoading(true);

      let base64: string | null = null;
      let fileName: string | null = null;
      let contentType: string | null = null;
      let fileSize: number | null = null;

      if (uploadedFile) {
        base64 = await fileToBase64(uploadedFile);
        fileName = uploadedFile.name;
        contentType = uploadedFile.type;
        fileSize = uploadedFile.size;
      }

      const payload = { feedback: remark, fileName, contentType, fileSize, base64 };

      if (actionDialog.type === "approve") {
        await apiFetch<any>(API.REETA_APPROVE(req.ID), { method: "POST", body: JSON.stringify(payload) });
        toast.success("Request approved successfully");
      } else {
        await apiFetch<any>(API.REETA_REJECT(req.ID), { method: "POST", body: JSON.stringify(payload) });
        toast.success("Request rejected successfully");
      }

      handleCloseActionDialog();
      await fetchList();
    } catch (e: any) {
      toast.error(e.message || "Failed process request");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Details
  // =====================
  const handleViewDetails = async (request: ReEtaRow) => {
    try {
        
      const raw = await apiFetch<any>(API.REETA_DETAIL(request.ID), { method: "GET" });
      const payload = unwrap(raw);
      console.log(payload);
      setDetailsDialog({ open: true, request: payload || request });
    } catch {
      setDetailsDialog({ open: true, request });
    }
  };

  // =====================
  // Vendor Response Upload
  // =====================
  const handleOpenVendorResponseDialog = (request: ReEtaRow) => {
    setVendorResponseDialog({ open: true, request });
    setVendorResponseFile(null);
  };

  const handleCloseVendorResponseDialog = () => {
    setVendorResponseDialog({ open: false, request: null });
    setVendorResponseFile(null);
  };

  const handleVendorResponseFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Only PDF files are allowed");
    if (file.size > 100 * 1024 * 1024) return toast.error("File size must not exceed 100MB");
    setVendorResponseFile(file);
    toast.success("File uploaded successfully");
  };

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
      color: "rgb(255, 165, 0)",
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

  const handleSubmitVendorResponse = async () => {
    if (!vendorResponseFile) return toast.error("Please upload a supporting document");
    const req = vendorResponseDialog.request;
    if (!req) return;

    try {
      setLoading(true);
      const base64 = await fileToBase64(vendorResponseFile);

      const payload = {
        fileName: vendorResponseFile.name || "vendor_response.pdf",
        contentType: vendorResponseFile.type,
        fileSize: vendorResponseFile.size,
        base64,
      };

      await apiFetch<any>(API.REETA_VENDOR_RESPONSE(req.ID), { method: "POST", body: JSON.stringify(payload) });

      toast.success("Supporting document uploaded successfully");
      handleCloseVendorResponseDialog();
      await fetchList();
    } catch (e: any) {
      toast.error(e.message || "Failed upload document");
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // Download Doc (base64)
  // =====================
  const handleDownloadDoc = async (docId?: number, fallbackName?: string) => {
    if (!docId) return toast.error("Document not available");

    try {
      const raw = await apiFetch<any>(API.REETA_DOC(docId), { method: "GET" });
      const d = unwrap(raw);

      const base64 = d?.BASE64_DATA ?? d?.base64_data ?? d?.base64;
      const name = d?.FILE_NAME ?? fallbackName ?? "document.pdf";
      if (!base64) return toast.error("No base64 data");

      downloadBase64Pdf(base64, name);
    } catch (e: any) {
      toast.error(e.message || "Failed download document");
    }
  };

  // =====================
  // Derived counts
  // =====================
  const totalRequests = Number(summary?.["Total Requests"] || 0);
  const pendingCount = Number(summary?.["Pending Review"] || 0);
  const approvedCount = Number(summary?.Approved || 0);
  const awaitingVendorCount = Number(summary?.["Awaiting Vendor Doc"] || 0);
  const rejectedCount = Number(summary?.Rejected || 0);

  const paginatedRequests = rows;

  // =====================
  // Searchable dropdown options
  // =====================
  const pageSizeOptions: SelectOption[] = useMemo(
    () => ["10", "25", "50", "100"].map((v) => ({ value: v, label: v })),
    []
  );

  const poNumberOptions: SelectOption[] = useMemo(
    () => uniquePONumbers.map((po) => ({ value: po, label: po })),
    [uniquePONumbers]
  );

  const itemOptions: SelectOption[] = useMemo(
    () =>
      itemsForSelectedPO.map((item) => ({
        value: item.Item,
        label: `${item.Item} - ${item["Short Text"] || "(no description)"}`,
      })),
    [itemsForSelectedPO]
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
            <Plus className="h-4 w-4 mr-2" />
            Create Request
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative w-96 mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search by request number, PO number, vendor, reason..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(1, 67, 87, 0.1)" }}>
              <FileText className="h-4 w-4" style={{ color: "#014357" }} />
            </div>
            <div className="text-gray-600 text-sm">Total Requests</div>
          </div>
          <div className="text-3xl" style={{ color: "#014357" }}>
            {totalRequests}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(237, 131, 45, 0.1)" }}>
              <Clock className="h-4 w-4" style={{ color: "#ED832D" }} />
            </div>
            <div className="text-gray-600 text-sm">Pending Review</div>
          </div>
          <div className="text-3xl" style={{ color: "#ED832D" }}>
            {pendingCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(106, 167, 93, 0.1)" }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: "#6AA75D" }} />
            </div>
            <div className="text-gray-600 text-sm">Approved</div>
          </div>
          <div className="text-3xl" style={{ color: "#6AA75D" }}>
            {approvedCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(255, 165, 0, 0.1)" }}>
              <AlertCircle className="h-4 w-4" style={{ color: "#FFA500" }} />
            </div>
            <div className="text-gray-600 text-sm text-xs">Awaiting Vendor Doc</div>
          </div>
          <div className="text-3xl" style={{ color: "#FFA500" }}>
            {awaitingVendorCount}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(212, 24, 61, 0.1)" }}>
              <XCircle className="h-4 w-4" style={{ color: "#d4183d" }} />
            </div>
            <div className="text-gray-600 text-sm">Rejected</div>
          </div>
          <div className="text-3xl" style={{ color: "#d4183d" }}>
            {rejectedCount}
          </div>
        </Card>
      </div>

      {/* Requests Table */}
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
                <TableHead>Requested ETA</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <FileCheck className="h-4 w-4" />
                    Docs
                  </div>
                </TableHead>
                <TableHead className="sticky right-[140px] bg-white z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                  Status
                </TableHead>
                <TableHead className="sticky right-0 bg-white z-10" style={{ width: "140px", minWidth: "140px" }}>
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
                    <div className="py-10 text-center text-gray-500">No data</div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRequests.map((r) => (
                  <TableRow key={r.ID} className={`group ${isAwaitingVendorDoc(r) ? "bg-orange-50" : ""}`}>
                    <TableCell>{r.POREETANUMBER}</TableCell>
                    <TableCell>{r["PO Number"] || "-"}</TableCell>
                    <TableCell>{r["PO Item No"] || "-"}</TableCell>
                    {user.role === "admin" && <TableCell>{r["Vendor Name"] || "-"}</TableCell>}

                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(r["Current ETA"])}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1" style={{ color: "#ED832D" }}>
                        <Clock className="h-3 w-3" />
                        {formatDate(r.ResultETA)}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-gray-600">{formatDate(r.CREATED_AT)}</TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {r.HasFeedbackAttachment || r["Feedback Doc ID"] ? (
                          <Badge variant="outline" className="text-xs w-fit" style={{ borderColor: "#014357", color: "#014357" }}>
                            Admin ✓
                          </Badge>
                        ) : null}

                        {r.HasVendorResponse || r["VendorResp Doc ID"] ? (
                          <Badge variant="outline" className="text-xs w-fit" style={{ borderColor: "#008383", color: "#008383" }}>
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
                      <Badge style={{ backgroundColor: getStatusColor(r["Reschedule Status"]) }} className="text-white text-xs whitespace-nowrap">
                        {getStatusLabel(r["Reschedule Status"])}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className={`sticky right-0 z-10 ${isAwaitingVendorDoc(r) ? "bg-orange-50" : "bg-white"} group-hover:bg-muted/50`}
                      style={{ width: "140px", minWidth: "140px" }}
                    >
                      <div className="flex gap-2">
                        {user.role === "vendor" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ borderColor: "#014357", color: "#014357" }}
                              onClick={() => handleViewDetails(r)}
                              className="w-9 h-9 p-0"
                              title="View Details"
                              disabled={loading}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {isAwaitingVendorDoc(r) && (
                              <Button
                                size="sm"
                                style={{ backgroundColor: "#FFA500" }}
                                className="text-white w-9 h-9 p-0"
                                onClick={() => handleOpenVendorResponseDialog(r)}
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
                            style={{ borderColor: "#014357", color: "#014357" }}
                            onClick={() => handleViewDetails(r)}
                            disabled={loading}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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

        {/* Pagination (server-side) */}
        <div className="flex items-center justify-between px-4 py-4 border-t gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">Rows per page:</span>

            {/* ✅ Searchable dropdown */}
            <div className="w-[90px]">
              <SearchableSelect
                value={itemsPerPage.toString()}
                onChange={(v) => handleItemsPerPageChange(v)}
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
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, idx) => {
                const pageNumber = idx + 1;
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
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
                } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                  return <PaginationEllipsis key={pageNumber} />;
                }
                return null;
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="text-sm text-gray-600 whitespace-nowrap">
            Page {currentPage} of {totalPages} • Total {totalRows} rows
          </div>
        </div>
      </Card>

      {/* Create Request Dialog (Vendor) */}
      <Dialog open={createDialog} onOpenChange={(open) => !open && handleCloseCreateDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle style={{ color: "#014357" }}>Create Reschedule ETA Request</DialogTitle>
            <DialogDescription>
              Submit a request to reschedule the Estimated Date of Delivery for your purchase order.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <Label>
                  Purchase Order Number <span className="text-red-500">*</span>
                </Label>

                {/* ✅ Searchable dropdown */}
                <SearchableSelect
                  value={selectedPO}
                  onChange={(v) => {
                    setSelectedPO(v);
                    setSelectedItem("");
                  }}
                  placeholder="Select a purchase order"
                  searchPlaceholder="Search PO number..."
                  options={poNumberOptions}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Item of Requisition <span className="text-red-500">*</span>
                </Label>

                {/* ✅ Searchable dropdown */}
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
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item Description</p>
                    <p className="text-sm">{selectedPoItem["Short Text"] || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">ETD</p>
                      <p className="text-sm">{formatDate(selectedPoItem.ETD)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Current ETA</p>
                      <div className="space-y-1">
                        <p className="text-sm">{formatDate(selectedPoItem.ReEtaDate)}</p>
                        <p
                          className="text-xs inline-block px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(1, 67, 87, 0.1)", color: "#014357" }}
                        >
                          ({Number(selectedPoItem["ETA Days"] ?? 0)} days after ETD)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  New ETA (in days after ETD) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter number of days"
                  value={newETADays}
                  onChange={(e) => setNewETADays(e.target.value)}
                  disabled={!selectedPoItem || loading}
                />
                {selectedPoItem && newETADays && parseInt(newETADays, 10) > 0 && (
                  <div className="mt-2 p-4 rounded-lg border" style={{ backgroundColor: "#FFF4E6", borderColor: "#ED832D" }}>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">New ETA Date</p>
                    <p className="text-lg mb-1" style={{ color: "#ED832D" }}>
                      {calculateNewETADate() ? formatDate(calculateNewETADate()!) : "-"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Extension: +{Math.max(0, parseInt(newETADays, 10) - Number(selectedPoItem["ETA Days"] ?? 0))} days
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Reason for Rescheduling <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Provide detailed reason for the ETA reschedule request..."
                  rows={5}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="resize-none"
                  disabled={loading}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseCreateDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#014357" }}
              className="text-white hover:opacity-90"
              onClick={handleSubmitRequest}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Approve/Reject Dialog */}
      {user.role === "admin" && (
        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && handleCloseActionDialog()}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle style={{ color: "#014357" }}>
                {actionDialog.type === "approve" ? "Approve" : "Reject"} Reschedule Request
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
                      className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                      style={{ borderColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                      />
                      <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>
                        Request Information
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Request No</p>
                          <p className="text-sm">{actionDialog.request.POREETANUMBER}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">PO Number</p>
                          <p className="text-sm">{actionDialog.request["PO Number"]}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item</p>
                          <p className="text-sm">{actionDialog.request["PO Item No"]}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Vendor</p>
                          <p className="text-sm">{actionDialog.request["Vendor Name"]}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Current ETA</p>
                          <p className="text-xl mb-1">{formatDate(actionDialog.request["Current ETA"])}</p>
                          <p className="text-sm text-gray-600">
                            +{Number(actionDialog.request["Proposed ETA"] ?? 0)} days
                          </p>
                        </div>
                        <div className="rounded-lg p-4 border" style={{ backgroundColor: "#FFF4E6", borderColor: "#ED832D" }}>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Requested ETA</p>
                          <p className="text-xl mb-1" style={{ color: "#ED832D" }}>
                            {formatDate(actionDialog.request.ResultETA)}
                          </p>
                          <p className="text-sm" style={{ color: "#ED832D" }}>
                            Proposed: {Number(actionDialog.request["Proposed ETA"] ?? 0)} day(s)
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Vendor&apos;s Reason</p>
                        <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed">
                          {actionDialog.request["Reschedule Reason"] || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                      style={{ borderColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                      />
                      <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>
                        {actionDialog.type === "approve" ? "Approval Remark" : "Rejection Details"}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block">
                          {actionDialog.type === "approve" ? "Remark" : "Reason for Rejection"}
                          <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Textarea
                          placeholder={actionDialog.type === "approve" ? "Enter your approval remark..." : "Provide detailed reason..."}
                          rows={4}
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          className="resize-none"
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <Label className="mb-2 block">
                          Record of Event (PDF)
                          {actionDialog.type === "reject" && <span className="text-red-500 ml-1">*</span>}
                          {actionDialog.type === "approve" && <span className="text-gray-500 ml-1">(Optional)</span>}
                        </Label>
                        <p className="text-xs text-gray-500 mb-3">
                          {actionDialog.type === "reject"
                            ? "Supporting documentation for rejection (PDF format, max 100MB)"
                            : "Optional supporting documentation (PDF format, max 100MB)"}
                        </p>

                        {!uploadedFile ? (
                          <label
                            className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-gray-400 hover:bg-gray-50"
                            style={{ borderColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                          >
                            <div className="text-center">
                              <div
                                className="mx-auto mb-3 p-3 rounded-full"
                                style={{ backgroundColor: actionDialog.type === "approve" ? "#E8F5E9" : "#FFE6EB", width: "fit-content" }}
                              >
                                <Upload className="h-6 w-6" style={{ color: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }} />
                              </div>
                              <p className="text-sm mb-1" style={{ color: "#014357" }}>Click to upload PDF document</p>
                              <p className="text-xs text-gray-500">Maximum file size: 100MB</p>
                            </div>
                            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
                          </label>
                        ) : (
                          <div
                            className="flex items-center justify-between p-4 rounded-lg border-2"
                            style={{
                              backgroundColor: actionDialog.type === "approve" ? "#E8F5E9" : "#FFE6EB",
                              borderColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded" style={{ backgroundColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}>
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p className="text-sm" style={{ color: "#014357" }}>{uploadedFile.name}</p>
                                <p className="text-xs text-gray-600">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setUploadedFile(null)} className="hover:bg-white/50" disabled={loading}>
                              <X className="h-4 w-4" style={{ color: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }} />
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
              <Button variant="outline" onClick={handleCloseActionDialog} disabled={loading}>
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: actionDialog.type === "approve" ? "#6AA75D" : "#d4183d" }}
                className="text-white"
                onClick={handleSubmitAction}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {actionDialog.type === "approve" ? "Approve Request" : "Reject Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, request: null })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle style={{ color: "#014357" }}>Request Details</DialogTitle>
            <DialogDescription>View complete information about this reschedule request.</DialogDescription>

            {detailsDialog.request && (
              <div className="flex items-center gap-2 pt-2">
                <Badge
                  style={{ backgroundColor: getStatusColor(detailsDialog.request["Reschedule Status"]) }}
                  className="text-white px-4 py-1.5"
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
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: "#014357" }}>
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#014357" }} />
                    <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>Basic Information</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Request No</p>
                      <p className="text-sm">{detailsDialog.request.POREETANUMBER}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">PO Number</p>
                      <p className="text-sm">{detailsDialog.request["PO Number"] || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item</p>
                      <p className="text-sm">{detailsDialog.request["PO Item No"] || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Vendor</p>
                      <p className="text-sm">{detailsDialog.request["Vendor Name"] || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item Description</p>
                      <p className="text-sm">{detailsDialog.request.ShortText || "-"}</p>
                    </div>
                    <div className="invisible">
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Item Description</p>
                        <p className="text-sm">{detailsDialog.request.ShortText || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Request Date</p>
                      <p className="text-sm">{formatDate(detailsDialog.request.CREATED_AT)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">ETD</p>
                      <p className="text-sm">{formatDate(detailsDialog.request.ETD) || "-"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: "#014357" }}>
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#014357" }} />
                    <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>ETA Details</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Current ETA</p>
                      <p className="text-xl mb-1">{formatDate(detailsDialog.request["Current ETA"])}</p>
                      <p className="text-sm text-gray-600">
                        {detailsDialog.request["ETA Days"]+ " days after ETD"}
                      </p>
                    </div>
                    <div className="rounded-lg p-4 border" style={{ backgroundColor: "#FFF4E6", borderColor: "#ED832D" }}>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Requested ETA</p>
                      <p className="text-xl mb-1" style={{ color: "#ED832D" }}>
                        {formatDate(detailsDialog.request.RequestETADate)}
                      </p>
                      <p className="text-sm" style={{ color: "#ED832D" }}>
                        +{detailsDialog.request.ResultProposeEtaDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: "#014357" }}>
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#014357" }} />
                    <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>Vendor&apos;s Reason</h3>
                  </div>
                  <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed">
                    {detailsDialog.request["Reschedule Reason"] || "-"}
                  </p>
                </div>

                {detailsDialog.request["Reschedule Status"] !== "PENDING" && (
                  <div>
                    <div
                      className="flex items-center gap-3 mb-4 pb-3 border-b-2"
                      style={{ borderColor: getStatusColor(detailsDialog.request["Reschedule Status"]) }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: getStatusColor(detailsDialog.request["Reschedule Status"]) }}
                      />
                      <h3 className="text-lg tracking-wide" style={{ color: "#014357" }}>Admin Response</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Processed By</p>
                          <p className="text-sm">{detailsDialog.request.FEEDBACK_BY || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Processed Date</p>
                          <p className="text-sm">{formatDate(detailsDialog.request.FEEDBACK_AT)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Remark</p>
                        <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed">
                          {detailsDialog.request.Feedback || "-"}
                        </p>
                      </div>

                      {detailsDialog.request?.["Feedback Doc ID"] && (() => {
  const status = detailsDialog.request?.["Reschedule Status"];
  const theme = getDocButtonTheme(status);

  return (
    <div>
      <Label className="mb-2 block">Admin&apos;s Record of Event</Label>

      <div
        className="flex items-center justify-between p-4 rounded-lg border-2"
        style={{ backgroundColor: theme.softBg, borderColor: theme.color }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded" style={{ backgroundColor: theme.color }}>
            <FileText className="h-6 w-6 text-white" />
          </div>

          <div>
            <p className="text-sm" style={{ color: "#014357" }}>
              Doc # {detailsDialog.request?.FeedbackFileName}
            </p>
            <p className="text-xs text-gray-600">PDF Document</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleDownloadDoc(
              detailsDialog.request?.["Feedback Doc ID"],
              "record_of_event.pdf"
            )
          }
          style={{ borderColor: theme.color, color: theme.color }}
          className={theme.hoverClass}
          disabled={loading}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
})()}

                      {detailsDialog.request["VendorResp Doc ID"] ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Vendor&apos;s Supporting Document</p>
                          <div className="flex items-center justify-between p-4 rounded-lg border-2" style={{ backgroundColor: "rgba(0, 131, 131, 0.1)", borderColor: "#008383" }}>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded" style={{ backgroundColor: "#008383" }}>
                                <FileText className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p className="text-sm" style={{ color: "#014357" }}>Doc #{detailsDialog.request["VendorResp Doc ID"]}</p>
                                <p className="text-xs text-gray-600">Uploaded {formatDate(detailsDialog.request.VENDOR_RESPONSE_AT)}</p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadDoc(detailsDialog.request?.["VendorResp Doc ID"], "vendor_response.pdf")}
                              style={{ borderColor: "#008383", color: "#008383" }}
                              className="hover:bg-teal-50"
                              disabled={loading}
                            >
                              <Download className="h-4 w-4 mr-2" />
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
            {user.role === "admin" && detailsDialog.request?.["Reschedule Status"] === "PENDING" ? (
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
              <Button variant="outline" onClick={() => setDetailsDialog({ open: false, request: null })} disabled={loading}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Response Upload Dialog */}
      {user.role === "vendor" && (
        <Dialog open={vendorResponseDialog.open} onOpenChange={(open) => !open && handleCloseVendorResponseDialog()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle style={{ color: "#014357" }}>Upload Supporting Document</DialogTitle>
              <DialogDescription>
                The admin has rejected your request with a supporting document. Please upload your response document.
              </DialogDescription>
            </DialogHeader>

            {vendorResponseDialog.request && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Request No</p>
                      <p className="text-sm">{vendorResponseDialog.request.POREETANUMBER}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">PO Number</p>
                      <p className="text-sm">{vendorResponseDialog.request["PO Number"]}</p>
                    </div>
                  </div>
                </div>

                {vendorResponseDialog.request["Feedback Doc ID"] && (
                  <div>
                    <Label className="mb-2 block">Admin&apos;s Record of Event</Label>
                    <div className="flex items-center justify-between p-4 rounded-lg border-2" style={{ backgroundColor: "#FFE6EB", borderColor: "#d4183d" }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded" style={{ backgroundColor: "#d4183d" }}>
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm" style={{ color: "#014357" }}>Doc #{vendorResponseDialog.request["Feedback Doc ID"]}</p>
                          <p className="text-xs text-gray-600">PDF Document</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadDoc(vendorResponseDialog.request?.["Feedback Doc ID"], "record_of_event.pdf")}
                        style={{ borderColor: "#d4183d", color: "#d4183d" }}
                        className="hover:bg-red-50"
                        disabled={loading}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="mb-2 block">
                    Your Supporting Document (PDF) <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">Upload your response document in PDF format (max 100MB)</p>

                  {!vendorResponseFile ? (
                    <label
                      className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-gray-400 hover:bg-gray-50"
                      style={{ borderColor: "#FFA500" }}
                    >
                      <div className="text-center">
                        <div className="mx-auto mb-3 p-3 rounded-full" style={{ backgroundColor: "rgba(255, 165, 0, 0.1)", width: "fit-content" }}>
                          <Upload className="h-6 w-6" style={{ color: "#FFA500" }} />
                        </div>
                        <p className="text-sm mb-1" style={{ color: "#014357" }}>Click to upload PDF document</p>
                        <p className="text-xs text-gray-500">Maximum file size: 100MB</p>
                      </div>
                      <input type="file" accept="application/pdf" className="hidden" onChange={handleVendorResponseFileUpload} disabled={loading} />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-lg border-2" style={{ backgroundColor: "rgba(255, 165, 0, 0.1)", borderColor: "#FFA500" }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded" style={{ backgroundColor: "#FFA500" }}>
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm" style={{ color: "#014357" }}>{vendorResponseFile.name}</p>
                          <p className="text-xs text-gray-600">{(vendorResponseFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setVendorResponseFile(null)} className="hover:bg-white/50" disabled={loading}>
                        <X className="h-4 w-4" style={{ color: "#FFA500" }} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseVendorResponseDialog} disabled={loading}>
                Cancel
              </Button>
              <Button style={{ backgroundColor: "#FFA500" }} className="text-white" onClick={handleSubmitVendorResponse} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}