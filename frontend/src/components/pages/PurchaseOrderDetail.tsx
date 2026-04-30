import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Info,
  Package,
  Upload,
  X,
  PackageCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { API } from "../../config";
import {
  getAccessToken,
  redirectToLoginExpired,
} from "../../utils/authSession";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { User } from "./Login";

// ===================== Types =====================
interface PurchaseOrderDetailProps {
  user: User;
  orderId: string;
  onBack: () => void;
  onRefreshPurchaseOrders?: () => Promise<void> | void;
}

type PendingSubmitAction = "po-submitted" | "on-delivery" | "reschedule" | null;

type DelayReason = {
  id: string | number;
  title: string;
  describe?: string;
};

type FlowStatus =
  | "PO Submitted"
  | "Work in Progress"
  | "On Delivery"
  | "Received";

type ApiStatusFlowRow = {
  Status?: string | null;
  StatusAt?: string | null;
  ["Purchasing Document"]?: string | null;
  Item?: string | null;
  ["ID PO Item"]?: string | null;
  IDPOItem?: string | null;
  IdPoItem?: string | null;
};

type ReEtaFile = {
  name: string;
  uploadedBy?: string | null;
  uploadedDate?: string | null;
  url?: string | null;
  contentType?: string | null;
  base64Data?: string | null;
  size?: number | null;
};
type NormalizedReEta = {
  id: string;
  requestDate: string | null;
  requestedBy: string;
  oldETA: string | null;
  newETA: string | null;
  proposedETADays: string;
  reason: string;
  delayReasonTitle?: string;
  delayReasonDescription?: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  responseDate: string | null;
  evidenceFile?: ReEtaFile | null;
  approvalFile?: ReEtaFile | null;
  rejectionFile?: ReEtaFile | null;
  confirmationFile?: ReEtaFile | null;
  waitingFile?: ReEtaFile | null;
  feedbackDocFile?: ReEtaFile | null;
  evidenceDocFile?: ReEtaFile | null;
  vendorRespDocFile?: ReEtaFile | null;
};

type PoDetail = {
  POID?: string | null;
  ["ID PO Item"]?: string | null;
  IDPOItem?: string | null;
  IdPoItem?: string | null;
  idPoItem?: string | null;
  POIDItem?: string | null;
  POItemID?: string | null;

  ["Purchasing Document"]?: string | null;
  ["Purchase Requisition"]?: string | null;
  Item?: string | null;
  Material?: string | null;
  ["Document Date"]?: string | null;
  ["Delivery date"]?: string | null;
  DeliveryDate?: string | null;
  ["Purchasing Doc. Type"]?: string | null;
  ["Purchasing Group"]?: string | null;
  MaterialDescription?: string | null;
  VendorName?: string | null;
  ["Quantity Received"]?: string | number | null;
  StillToBeDeliveredQty?: string | number | null;
  ["Qty Order"]?: string | number | null;
  QtyOrder?: string | number | null;
  Plant?: string | null;
  ["Storage location"]?: string | null;
  ["Changed On"]?: string | null;
  ["Created By"]?: string | null;
  ["GR Created Date"]?: string | null;

  CurrentETD?: string | null;
  CurrentETADays?: string | number | null;
  CurrentEta?: string | null;

  ETD?: string | null;
  ETA?: string | null;
  ["WIP Remark"]?: string | null;
  WIPRemark?: string | null;
  AWB?: string | null;
  ["Delivery Update"]?: string | null;
  LeadtimeDelivery?: string | number | null;

  AWBFileName?: string | null;
  AWBContentType?: string | null;
  AWBBase64Data?: string | null;

  AWBDocFileName?: string | null;
  AWBDocContentType?: string | null;
  AWBDocBase64?: string | null;
  AWBDocFileSize?: string | number | null;

  FinalActualDeliveryDate?: string | null;
};

type DetailData = {
  StatusFlow?: ApiStatusFlowRow[];
  ReEtaRequests?: any[];
  PoDetail?: PoDetail | null;
  Order?: PoDetail | null;
};

type DetailApiResponse = {
  Data?: DetailData;
  data?: DetailData;
  message?: string;
  Message?: string;
};

type StatusCardData = {
  etd: Date | null;
  etaDate: Date | null;
  etaDays: string;
  remarks: string;
  reEtaDate: Date | null;
};

type StatusRelatedInformationProps = {
  status: FlowStatus;
  poDetail: PoDetail | null;
  latestApprovedReEtaDate?: string | null;
  onDownloadAwbFile?: () => void;
  currentEtaForReschedule?: string | null;
  etaDays?: string;
};

type StatusFlowHistoryProps = {
  status: FlowStatus;
  statusHistory: Record<string, string>;
};

type FileActionCardProps = {
  file: ReEtaFile;
  label: string;
  iconColor?: string;
  onDownload: (file: ReEtaFile) => void;
};

type ReEtaDocFileCardProps = {
  file: ReEtaFile;
  label: string;
  onView: (file: ReEtaFile) => void;
  onDownload: (file: ReEtaFile) => void;
};

type RequiredDeliveryDateCardProps = {
  deliveryDateValue?: string | null;
};

// ===================== Constants =====================
const FLOW_ORDER: FlowStatus[] = [
  "PO Submitted",
  "Work in Progress",
  "On Delivery",
  "Received",
];

const STATUS_LINE_TOP = 24;

const ETA_DELIVERY_DATE_ERROR =
  "ETA exceeds the delivery date. Please submit a Reschedule ETA Request again before proceeding.";

const WIP_REETA_REQUIRED_ERROR =
  "New ETA exceeds the required delivery date. Please submit a Re-ETA request again before proceeding.";

const WAITING_REETA_APPROVAL_MESSAGE =
  "Waiting for Re-ETA approval. Please wait until the request is reviewed before proceeding.";

// ===================== Auth =====================
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

const buildMultipartAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await fetch(input, init);

  if (res.status === 401) {
    redirectToLoginExpired();
    throw new Error("Session expired");
  }

  return res;
};

// ===================== Helpers =====================
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

const toIsoString = (v?: string | null): string | null => {
  const d = parseServerDate(v);
  return d ? d.toISOString() : null;
};

const toIsoDateTime = (v?: Date | null): string | null => {
  if (!v || Number.isNaN(v.getTime())) return null;
  return v.toISOString();
};

const formatDateOnly = (v?: Date | null): string | null => {
  if (!v || Number.isNaN(v.getTime())) return null;
  return format(v, "yyyy-MM-dd");
};

const toNumberOrZero = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

const formatDate = (dateString: string): string => {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTime = (dateTimeString: string): string => {
  const d = new Date(dateTimeString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isDateBeforeToday = (value?: string | null): boolean => {
  const date = parseServerDate(value);
  if (!date) return false;
  return startOfDay(date).getTime() < todayStart().getTime();
};

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

const mapFlowStatus = (backendStatus?: string | null): FlowStatus | null => {
  const s = trim(backendStatus);
  if (!s) return null;

  const u = s.toUpperCase();

  if (u === "SUBMITTED" || u === "PO SUBMITTED") return "PO Submitted";
  if (u === "WORK IN PROGRESS") return "Work in Progress";
  if (u === "ON DELIVERY") return "On Delivery";
  if (u === "FULLY RECEIVED" || u === "RECEIVED") return "Received";

  if (s === "Submitted") return "PO Submitted";
  if (s === "Work In Progress" || s === "Work in Progress")
    return "Work in Progress";
  if (s === "On Delivery") return "On Delivery";
  if (s === "Fully Received" || s === "Received") return "Received";

  return null;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "PO Submitted":
      return "#ED832D";
    case "Work in Progress":
      return "#5C8CB6";
    case "On Delivery":
      return "#008383";
    case "Received":
      return "#6AA75D";
    default:
      return "#014357";
  }
};

const getRescheduleStatusColor = (status: string) => {
  switch (status) {
    case "Pending":
      return "#ED832D";
    case "Approved":
      return "#6AA75D";
    case "Rejected":
      return "#DC2626";
    default:
      return "#014357";
  }
};

const getStatusIcon = (statusName: string) => {
  switch (statusName) {
    case "PO Submitted":
      return FileText;
    case "Work in Progress":
      return Package;
    case "On Delivery":
      return Truck;
    case "Received":
      return PackageCheck;
    default:
      return FileText;
  }
};

const normalizeRescheduleStatus = (
  raw: unknown,
): "Pending" | "Approved" | "Rejected" | string => {
  const s = trim(raw);
  if (!s) return "Pending";

  const u = s.toUpperCase();
  if (u === "PENDING") return "Pending";
  if (u === "APPROVED") return "Approved";
  if (u === "REJECTED") return "Rejected";

  return s;
};

const getReEtaRequestedAt = (row: any): Date | null => {
  const value =
    row?.RequestedAt ??
    row?.requestDate ??
    row?.RequestDate ??
    row?.CreatedAt ??
    row?.CREATED_AT ??
    row?.UpdatedAt ??
    row?.UPDATED_AT ??
    null;

  const parsed = parseServerDate(value);
  return parsed ?? null;
};

const getLatestApprovedReEta = (rows: any[]): any | null => {
  const approvedRows = rows.filter((row) => {
    const status = normalizeRescheduleStatus(
      row?.["Reschedule Status"] ??
        row?.RescheduleStatus ??
        row?.status ??
        row?.Status,
    );
    return status === "Approved";
  });

  if (!approvedRows.length) return null;

  return [...approvedRows].sort((a, b) => {
    const aTime = getReEtaRequestedAt(a)?.getTime() ?? 0;
    const bTime = getReEtaRequestedAt(b)?.getTime() ?? 0;
    return bTime - aTime;
  })[0];
};

const safeId = (v: unknown, fallback: string) => {
  const s = trim(v);
  return s || fallback;
};

const pickBase64File = (
  fileName: unknown,
  base64Data: unknown,
  contentType?: unknown,
  size?: unknown,
  fallbackName = "File",
): ReEtaFile | null => {
  const base64 = trim(base64Data);
  if (!base64) return null;

  const name = trim(fileName) || fallbackName;
  const mime = trim(contentType) || null;

  const numericSize =
    size === null || size === undefined || size === "" ? null : Number(size);

  return {
    name,
    uploadedBy: null,
    uploadedDate: null,
    url: null,
    contentType: mime,
    base64Data: base64,
    size: Number.isNaN(numericSize as number) ? null : numericSize,
  };
};

const normalizeReEtaRequest = (r: any, idx: number): NormalizedReEta => {
  const id = safeId(
    r?.POREETANUMBER ??
      r?.["POREETANUMBER"] ??
      r?.ReETARequestID ??
      r?.["ReETARequestID"] ??
      r?.id ??
      r?.ID ??
      r?.RequestID ??
      r?.RequestNo,
    `RSR-${String(idx + 1).padStart(3, "0")}`,
  );

  const status = normalizeRescheduleStatus(
    r?.["Reschedule Status"] ?? r?.RescheduleStatus ?? r?.status ?? r?.Status,
  );

  const oldETA = safeDateOnly(r?.OldETA ?? r?.oldETA);
  const newETA = safeDateOnly(r?.NewETA ?? r?.newETA);

  const requestDate = safeDateOnly(
    r?.RequestedAt ??
      r?.requestDate ??
      r?.RequestDate ??
      r?.CreatedAt ??
      r?.CREATED_AT,
  );

  const responseDate = safeDateOnly(
    r?.UpdatedAt ??
      r?.UPDATED_AT ??
      r?.ResponseAt ??
      r?.responseDate ??
      r?.ResponseDate,
  );

  const delayReasonTitle =
    trim(
      r?.DelayReasonTitle ?? r?.delayReasonTitle ?? r?.["Delay Reason Title"],
    ) || "-";

  const delayReasonDescription =
    trim(
      r?.DelayReasonDescription ??
        r?.delayReasonDescription ??
        r?.["Delay Reason Description"],
    ) || "-";

  const requestedBy =
    trim(
      r?.RequestedBy ??
        r?.requestedBy ??
        r?.CREATED_BY ??
        r?.VendorName ??
        r?.SupplierName,
    ) || "-";

  const reason =
    trim(
      r?.["Reschedule Reason"] ??
        r?.RescheduleReason ??
        r?.reason ??
        r?.Reason ??
        r?.remarks ??
        r?.Remarks ??
        r?.Note ??
        r?.note,
    ) || "-";

  const proposedETADays =
    trim(r?.ProposedETADays ?? r?.["Proposed ETA"]) || "-";

  const evidenceFile =
    pickBase64File(
      r?.EvidenceFileName,
      r?.EvidenceBase64Data,
      r?.EvidenceContentType,
      r?.EvidenceSize,
      "Evidence File",
    ) || null;

  const feedbackFile =
    pickBase64File(
      r?.FeedbackFileName,
      r?.FeedbackBase64Data,
      r?.FeedbackContentType,
      r?.FeedbackSize,
      "Feedback File",
    ) || null;

  const vendorRespFile =
    pickBase64File(
      r?.VendorRespFileName,
      r?.VendorRespBase64Data,
      r?.VendorRespContentType,
      r?.VendorRespSize,
      "Vendor Response File",
    ) || null;

  const approvalFile =
    pickBase64File(
      r?.FeedbackFileName,
      r?.ApprovalFile,
      r?.FeedbackContentType,
      r?.FeedbackSize,
      "Approval File",
    ) || (status === "Approved" ? feedbackFile : null);

  const rejectionFile =
    pickBase64File(
      r?.FeedbackFileName,
      r?.RejectionFile,
      r?.FeedbackContentType,
      r?.FeedbackSize,
      "Rejection File",
    ) || (status === "Rejected" ? feedbackFile : null);

  const confirmationFile =
    pickBase64File(
      r?.VendorRespFileName,
      r?.ConfirmationFile,
      r?.VendorRespContentType,
      r?.VendorRespSize,
      "Confirmation File",
    ) || (status === "Rejected" ? vendorRespFile : null);

  const waitingFile =
    pickBase64File(
      r?.FeedbackFileName,
      r?.WaitingFile,
      r?.FeedbackContentType,
      r?.FeedbackSize,
      "Waiting File",
    ) || (status !== "Approved" && status !== "Rejected" ? feedbackFile : null);

  const feedbackDocFile =
    pickBase64File(
      r?.FeedbackDocFileName,
      r?.FeedbackDocBase64,
      r?.FeedbackDocContentType,
      r?.FeedbackDocFileSize,
      "Feedback Document",
    ) || null;

  const evidenceDocFile =
    pickBase64File(
      r?.EvidenceDocFileName,
      r?.EvidenceDocBase64,
      r?.EvidenceDocContentType,
      r?.EvidenceDocFileSize,
      "Evidence Document",
    ) || null;

  const vendorRespDocFile =
    pickBase64File(
      r?.VendorRespDocFileName,
      r?.VendorRespDocBase64,
      r?.VendorRespDocContentType,
      r?.VendorRespDocFileSize,
      "Vendor Response Document",
    ) || null;

  return {
    id,
    requestDate,
    requestedBy,
    oldETA,
    newETA,
    proposedETADays,
    reason,
    delayReasonTitle,
    delayReasonDescription,
    status,
    responseDate,
    evidenceFile,
    approvalFile,
    rejectionFile,
    confirmationFile,
    waitingFile,
    feedbackDocFile,
    evidenceDocFile,
    vendorRespDocFile,
  };
};

const canCreateReschedule = (role: User["role"], status: string) =>
  role === "vendor" &&
  (status === "Work in Progress" || status === "On Delivery");

const extractIdPoItem = (
  detail: PoDetail | null,
  flowRows: ApiStatusFlowRow[],
): string => {
  const fromDetail = trim(
    detail?.["ID PO Item"] ??
      detail?.IDPOItem ??
      detail?.IdPoItem ??
      detail?.idPoItem ??
      detail?.POIDItem ??
      detail?.POItemID ??
      detail?.POID,
  );

  if (fromDetail) return fromDetail;

  const fromFlow = flowRows.find(
    (r) =>
      trim(r?.["ID PO Item"]) ||
      trim(r?.IDPOItem) ||
      trim(r?.IdPoItem) ||
      (trim(r?.["Purchasing Document"]) && trim(r?.Item)),
  );

  const direct = trim(
    fromFlow?.["ID PO Item"] ?? fromFlow?.IDPOItem ?? fromFlow?.IdPoItem,
  );
  if (direct) return direct;

  const purchasingDocument = trim(fromFlow?.["Purchasing Document"]);
  const item = trim(fromFlow?.Item);

  if (purchasingDocument && item) return `${purchasingDocument}-${item}`;
  return "";
};

const diffDaysFromNow = (date: Date): number => {
  const startToday = todayStart();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil(
    (target.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24),
  );
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

const buildStatusHistory = (
  rows: ApiStatusFlowRow[],
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const st = mapFlowStatus(row.Status);
    const at = toIsoString(row.StatusAt);
    if (st && at) map[st] = at;
  }
  return map;
};

const getLastValidStatus = (rows: ApiStatusFlowRow[]): FlowStatus => {
  const lastValidStatusRow = [...rows].reverse().find((r) => {
    const mappedStatus = mapFlowStatus(r.Status);
    const validStatusAt = toIsoString(r.StatusAt);
    return !!mappedStatus && !!validStatusAt;
  });

  return mapFlowStatus(lastValidStatusRow?.Status) || "PO Submitted";
};

const getInitialServerEtd = (
  detail: PoDetail | null,
  rows: ApiStatusFlowRow[],
): Date | undefined => {
  return (
    parseServerDate(detail?.CurrentETD ?? detail?.ETD) ??
    parseServerDate(
      rows.find((r) => mapFlowStatus(r.Status) === "PO Submitted")?.StatusAt ??
        undefined,
    )
  );
};

const getInitialServerEtaDays = (
  detail: PoDetail | null,
  serverEtd?: Date,
): string => {
  const currentEtaDays = trim(detail?.CurrentETADays);
  if (currentEtaDays) return currentEtaDays;

  const serverCurrentEta = parseServerDate(detail?.CurrentEta ?? detail?.ETA);
  if (serverEtd && serverCurrentEta) {
    const diff = diffDaysDateOnly(serverCurrentEta, serverEtd);
    if (diff > 0) return String(diff);
  }

  return "";
};

const normalizePoDetailEta = (detail: PoDetail | null): PoDetail | null => {
  if (!detail) return null;
  const currentEta = trim(detail.CurrentEta);
  const days = parseInt(String(detail.CurrentETADays), 10);
  if (!currentEta || Number.isNaN(days) || days <= 0) return detail;

  const calculated = addDaysDateOnly(
    parseServerDate(currentEta) ?? new Date(currentEta),
    days,
  );
  return {
    ...detail,
    CurrentEta: formatDateOnly(calculated) || currentEta,
  };
};

const resolveStatusCardData = (
  poDetail: PoDetail | null,
  latestApprovedReEtaDate?: string | null,
): StatusCardData => {
  const etd = parseServerDate(poDetail?.CurrentETD) ?? null;
  const etaDate = parseServerDate(poDetail?.CurrentEta) ?? null;
  const etaDays = trim(poDetail?.CurrentETADays);
  const remarks = trim(poDetail?.["WIP Remark"] ?? poDetail?.WIPRemark) || "-";
  const reEtaDate = parseServerDate(latestApprovedReEtaDate) ?? null;

  return {
    etd,
    etaDate,
    etaDays,
    remarks,
    reEtaDate,
  };
};

const getBase64MimeType = (base64?: string | null): string => {
  const raw = trim(base64);
  if (!raw) return "application/octet-stream";

  const match = raw.match(/^data:(.*?);base64,/i);
  if (match?.[1]) return match[1];

  if (raw.startsWith("JVBER")) return "application/pdf";
  if (raw.startsWith("/9j/")) return "image/jpeg";
  if (raw.startsWith("iVBOR")) return "image/png";
  if (raw.startsWith("UklGR")) return "image/webp";

  return "application/octet-stream";
};

const base64ToBlob = (
  base64: string,
  contentType?: string | null,
): Blob | null => {
  const raw = trim(base64);
  if (!raw) return null;

  const normalized = raw.startsWith("data:")
    ? raw
    : `data:${trim(contentType) || getBase64MimeType(raw)};base64,${raw}`;

  const parts = normalized.split(",");
  if (parts.length < 2) return null;

  const mimeMatch = parts[0].match(/data:(.*?);base64/i);
  const mime =
    mimeMatch?.[1] || trim(contentType) || "application/octet-stream";

  try {
    const byteString = atob(parts[1]);
    const byteNumbers = new Array(byteString.length);

    for (let i = 0; i < byteString.length; i++) {
      byteNumbers[i] = byteString.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: mime });
  } catch {
    return null;
  }
};

const downloadBase64File = (
  base64: string,
  fileName: string,
  contentType?: string | null,
) => {
  const blob = base64ToBlob(base64, contentType);
  if (!blob) return;

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

// ===================== Small UI Parts =====================
function ValidationNotice({
  title,
  description,
  actionLabel,
  onAction,
}: ValidationNoticeProps) {
  return (
    <div
      className="mb-4 m-[0px] flex items-start gap-3 rounded-lg p-4"
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

function RequiredDeliveryDateCard({
  deliveryDateValue,
}: RequiredDeliveryDateCardProps) {
  const deliveryDate = parseServerDate(deliveryDateValue);
  const daysLeft = getDaysUntilDelivery(deliveryDateValue);

  const isOverdue = typeof daysLeft === "number" && daysLeft < 0;
  const isUrgent =
    typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 7;

  return (
    <div
      className="mb-4 m-[0px] flex items-start gap-3 rounded-lg p-4"
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

function StatusFlowHistory({ status, statusHistory }: StatusFlowHistoryProps) {
  const n = FLOW_ORDER.length;
  const startPct = 100 / (n * 2);
  const stepPct = 100 / n;

  const baseLeft = `calc(${startPct}% )`;
  const baseRight = `calc(${startPct}% )`;

  const lastDoneIndex = useMemo(() => {
    let last = -1;
    FLOW_ORDER.forEach((st, i) => {
      if (statusHistory[st]) last = i;
    });
    return last;
  }, [statusHistory]);

  const progressWidth =
    lastDoneIndex <= 0 ? "0%" : `calc(${lastDoneIndex * stepPct}% )`;
  const progressColor = lastDoneIndex <= 0 ? "#f3f3f4" : "#014357";

  const isActiveByTimestamp = useCallback(
    (statusName: FlowStatus) => !!statusHistory[statusName],
    [statusHistory],
  );

  return (
    <Card className="p-6">
      <h2 className="mb-6" style={{ color: "#014357" }}>
        Status Flow History
      </h2>

      <div className="relative">
        <div
          className="absolute"
          style={{
            left: baseLeft,
            right: baseRight,
            top: STATUS_LINE_TOP + 2,
            height: 6,
            backgroundColor: "#E5E7EB",
            borderRadius: 999,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        <div
          className="absolute"
          style={{
            left: baseLeft,
            top: STATUS_LINE_TOP + 2,
            height: 6,
            width: progressWidth,
            backgroundColor: progressColor,
            borderRadius: 999,
            zIndex: 1,
            transition: "width 0.3s ease",
            pointerEvents: "none",
          }}
        />

        <div
          className="relative flex items-start justify-between gap-2"
          style={{ zIndex: 2 }}
        >
          {FLOW_ORDER.map((statusName) => {
            const Icon = getStatusIcon(statusName);
            const active = isActiveByTimestamp(statusName);
            const color = getStatusColor(statusName);
            const ts = statusHistory[statusName];

            return (
              <div key={statusName} className="flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className="mb-2 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: active ? color : "#E5E7EB",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <p
                    className="mb-1 px-1 text-center text-xs"
                    style={{ color: "#014357" }}
                  >
                    {statusName}
                  </p>

                  {active && ts && (
                    <p className="text-center text-xs text-gray-500">
                      {formatDateTime(ts)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <span className="sr-only">{status}</span>
      </div>
    </Card>
  );
}

function StatusRelatedInformation({
  status,
  poDetail,
  latestApprovedReEtaDate,
  onDownloadAwbFile,
  currentEtaForReschedule,
  etaDays: propEtaDays,
}: StatusRelatedInformationProps) {
  const { etd, etaDate, etaDays, remarks, reEtaDate } = useMemo(
    () => resolveStatusCardData(poDetail, latestApprovedReEtaDate),
    [poDetail, latestApprovedReEtaDate],
  );

  const workInProgressColor = getStatusColor("Work in Progress");
  const onDeliveryColor = getStatusColor("On Delivery");
  const receivedColor = getStatusColor("Received");

  const WorkInProgressIcon = getStatusIcon("Work in Progress");
  const OnDeliveryIcon = getStatusIcon("On Delivery");
  const ReceivedIcon = getStatusIcon("Received");

  const awb = trim(poDetail?.AWB) || "-";
  const actualDeliveryDate =
    parseServerDate(poDetail?.ActualDeliveryDate) ?? null;
  const receivedAt = parseServerDate(poDetail?.["GR Created Date"]) ?? null;

  const awbFileName = trim(poDetail?.AWBFileName) || "AWB Document";
  const hasAwbFile = !!trim(poDetail?.AWBBase64Data);

  const awbDocFileName = trim(poDetail?.AWBDocFileName) || "AWB Document";
  const hasAwbDocFile = !!trim(poDetail?.AWBDocBase64);
  const awbDocFile: ReEtaFile | null = hasAwbDocFile
    ? {
        name: awbDocFileName,
        uploadedBy: null,
        uploadedDate: null,
        url: null,
        contentType: trim(poDetail?.AWBDocContentType) || null,
        base64Data: trim(poDetail?.AWBDocBase64) || null,
        size:
          poDetail?.AWBDocFileSize === null ||
          poDetail?.AWBDocFileSize === undefined
            ? null
            : Number(poDetail.AWBDocFileSize),
      }
    : null;

  const onDeliveryQuantity = toNumberOrZero(
    poDetail?.["Qty Order"] ?? poDetail?.QtyOrder,
  );
  const onDeliveryLeadtimeNumber = toNumberOrZero(poDetail?.LeadtimeDelivery);
  const onDeliveryLeadtimeText =
    onDeliveryLeadtimeNumber > 0 ? `${onDeliveryLeadtimeNumber} days` : "-";

  const onDeliveryNewEta = useMemo(() => {
    if (!actualDeliveryDate || onDeliveryLeadtimeNumber <= 0) return null;
    return addDaysDateOnly(actualDeliveryDate, onDeliveryLeadtimeNumber);
  }, [actualDeliveryDate, onDeliveryLeadtimeNumber]);

  const showWorkInProgressSection =
    status === "Work in Progress" ||
    status === "On Delivery" ||
    status === "Received";

  const showOnDeliverySection =
    status === "On Delivery" || status === "Received";
  const showReceivedSection = status === "Received";

  const handleViewAwbFile = useCallback(() => {
    const base64 = trim(poDetail?.AWBBase64Data);
    if (!base64) {
      toast.error("AWB file not found.");
      return;
    }

    const blob = base64ToBlob(base64, poDetail?.AWBContentType);
    if (!blob) {
      toast.error("Failed to open AWB file.");
      return;
    }

    const blobUrl = URL.createObjectURL(blob);

    try {
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      URL.revokeObjectURL(blobUrl);
      toast.error("Failed to open file in a new tab.");
    }
  }, [poDetail]);

  const handleViewAwbDocFile = useCallback(() => {
    const base64 = trim(poDetail?.AWBDocBase64);
    if (!base64) {
      toast.error("AWB Document not found.");
      return;
    }

    const mime =
      trim(poDetail?.AWBDocContentType) || "application/octet-stream";
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime });
    const blobUrl = URL.createObjectURL(blob);

    try {
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      URL.revokeObjectURL(blobUrl);
      toast.error("Failed to open file in a new tab.");
    }
  }, [poDetail]);

  const handleDownloadAwbDocFile = useCallback(() => {
    const base64 = trim(poDetail?.AWBDocBase64);
    if (!base64) {
      toast.error("AWB Document not found.");
      return;
    }

    downloadBase64File(
      base64,
      awbDocFileName,
      trim(poDetail?.AWBDocContentType) || "application/octet-stream",
    );
  }, [poDetail, awbDocFileName]);

  return (
    <Card className="rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold" style={{ color: "#014357" }}>
        Status-Related Information
        {/*{currentEtaForReschedule && (
          <span className="ml-2 text-sm font-normal text-gray-500">
            (ETA: {formatDate(currentEtaForReschedule)} + {propEtaDays || 0} days)
          </span>
        )}*/}
      </h2>

      {showWorkInProgressSection && (
        <>
          <div className="flex items-center gap-3">
            <WorkInProgressIcon
              className="h-5 w-5"
              style={{ color: workInProgressColor }}
            />
            <h3 className="text-[20px]" style={{ color: workInProgressColor }}>
              Work in Progress
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label className="block text-sm text-gray-500">
                ETD (Estimated Date of Delivery)
              </Label>
              <p className="text-[18px] text-black">
                {etd ? format(etd, "MMM dd, yyyy") : "-"}
              </p>
            </div>

            <div>
              <Label className="block text-sm text-gray-500">ETA</Label>
              <p className="text-[18px] text-black">
                {etaDate
                  ? `${format(etaDate, "MMM dd, yyyy")}${
                      etaDays ? ` (${etaDays} days)` : ""
                    }`
                  : "-"}
              </p>
            </div>

            <div>
              <Label className="block text-sm text-gray-500">Remarks</Label>
              <p className="text-[18px] text-black">{remarks}</p>
            </div>
          </div>
        </>
      )}

      {showOnDeliverySection && (
        <>
          <hr className="my-6 border-gray-200" />

          <div className="flex items-center gap-2">
            <OnDeliveryIcon
              className="h-5 w-5"
              style={{ color: onDeliveryColor }}
            />
            <h3 className="text-[20px]" style={{ color: onDeliveryColor }}>
              On Delivery
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label className="block text-sm text-gray-500">
                Air way bill
              </Label>
              <p className="text-[18px] text-black">{awb}</p>
            </div>

            <div>
              <Label className="block text-sm text-gray-500">
                Actual Delivery Date
              </Label>
              <p className="text-[18px] text-black">
                {actualDeliveryDate
                  ? format(actualDeliveryDate, "MMM dd, yyyy")
                  : "-"}
              </p>
            </div>

            <div>
              <Label className="block text-sm text-gray-500">Quantity</Label>
              <p className="text-[18px] text-black">
                {onDeliveryQuantity || "-"}
              </p>
            </div>

            <div>
              <Label className="block text-sm text-gray-500">
                Lead Time Delivery
              </Label>
              <p className="text-[18px] text-black">{onDeliveryLeadtimeText}</p>
            </div>

            {status === "On Delivery" && awbDocFile && (
              <ReEtaDocFileCard
                file={awbDocFile}
                label="AWB Document"
                onView={handleViewAwbDocFile}
                onDownload={handleDownloadAwbDocFile}
              />
            )}

            <div>
              <Label className="block text-sm text-gray-500">ETA</Label>
              <p className="text-[18px] text-black">
                {onDeliveryNewEta
                  ? format(onDeliveryNewEta, "MMM dd, yyyy")
                  : "-"}
              </p>
            </div>
          </div>

          {hasAwbFile && (
            <Card className="mt-6 rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: "#014357" }} />
                  <div>
                    <p className="text-sm text-gray-500">AWB Document</p>
                    <p className="text-base text-black">{awbFileName}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleViewAwbFile}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View File
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDownloadAwbFile}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {showReceivedSection && (
        <>
          <hr className="my-6 border-gray-200" />

          <div className="flex items-center gap-2">
            <ReceivedIcon
              className="h-5 w-5"
              style={{ color: receivedColor }}
            />
            <h3 className="text-[20px]" style={{ color: receivedColor }}>
              Received
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label className="block text-sm text-gray-500">
                GR Created AT
              </Label>
              <p className="text-[18px] text-black">
                {receivedAt ? format(receivedAt, "MMM dd, yyyy") : "-"}
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function FileActionCard({
  file,
  label,
  iconColor = "#014357",
  onDownload,
}: FileActionCardProps) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full px-3 py-2"
      onClick={() => onDownload(file)}
      type="button"
    >
      <div className="flex w-full items-center gap-3">
        <FileText
          className="h-4 w-4 flex-shrink-0"
          style={{ color: iconColor }}
        />
        <div className="flex-1 text-left">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="mb-1 text-sm">{file.name}</p>
          <p className="text-xs text-gray-500">
            Uploaded by {file.uploadedBy || "-"}
            {file.uploadedDate ? ` on ${formatDate(file.uploadedDate)}` : ""}
          </p>
        </div>
        <Download
          className="h-4 w-4 flex-shrink-0"
          style={{ color: "#014357" }}
        />
      </div>
    </Button>
  );
}

function ReEtaDocFileCard({
  file,
  label,
  onView,
  onDownload,
}: ReEtaDocFileCardProps) {
  return (
    <div className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
      <FileText
        className="h-4 w-4 flex-shrink-0"
        style={{ color: "#014357" }}
      />
      <div className="flex-1 text-left">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mb-1 text-sm">{file.name}</p>
        {file.uploadedBy && (
          <p className="text-xs text-gray-500">
            Uploaded by {file.uploadedBy || "-"}
            {file.uploadedDate ? ` on ${formatDate(file.uploadedDate)}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onView(file)}
          type="button"
        >
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onDownload(file)}
          type="button"
        >
          <Download className="mr-1 h-3 w-3" />
          Download
        </Button>
      </div>
    </div>
  );
}

// ===================== Component =====================
export function PurchaseOrderDetail({
  user,
  orderId,
  onBack,
  onRefreshPurchaseOrders,
}: PurchaseOrderDetailProps) {
  const [statusFlowRows, setStatusFlowRows] = useState<ApiStatusFlowRow[]>([]);
  const [reEtaRequestsRaw, setReEtaRequestsRaw] = useState<any[]>([]);
  const [poDetail, setPoDetail] = useState<PoDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingPoStatus, setSubmittingPoStatus] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const [status, setStatus] = useState<FlowStatus>("PO Submitted");
  const [remarks, setRemarks] = useState("");
  const [etd, setEtd] = useState<Date | undefined>(todayStart());
  const [etaDays, setEtaDays] = useState("");
  const [awb, setAwb] = useState("");
  const [hasFilledUpdate, setHasFilledUpdate] = useState(false);

  const [actualDeliveryDate, setActualDeliveryDate] = useState<
    Date | undefined
  >(todayStart());
  const [leadtimeDelivery, setLeadtimeDelivery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [awbFile, setAwbFile] = useState<File | null>(null);
  const [awbFileInputKey, setAwbFileInputKey] = useState(0);

  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [newEtd, setNewEtd] = useState<Date | undefined>(undefined);
  const [newLeadtimeDays, setNewLeadtimeDays] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [selectedDelayReasonId, setSelectedDelayReasonId] = useState<
    string | null
  >(null);
  const [delayReasons, setDelayReasons] = useState<DelayReason[]>([]);
  const [loadingDelayReasons, setLoadingDelayReasons] = useState(false);

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] =
    useState<PendingSubmitAction>(null);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetchWithAuth(API.DETAILPO(orderId), {
          method: "GET",
          headers: buildAuthHeaders(),
          signal,
        });

        if (!res.ok) {
          let body: any;

          try {
            const text = await res.text();
            body = (() => {
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            })();
          } catch {
            body = undefined;
          }

          throw new Error(
            body?.message || body?.Message || `HTTP ${res.status}`,
          );
        }

        const json = (await res.json()) as DetailApiResponse;
        const data = (json?.Data ?? json?.data) as DetailData | undefined;
        const flow = Array.isArray(data?.StatusFlow) ? data.StatusFlow : [];
        const reqs = Array.isArray(data?.ReEtaRequests)
          ? data.ReEtaRequests
          : [];
        let detail = (data?.PoDetail ?? data?.Order ?? null) as PoDetail | null;
        detail = normalizePoDetailEta(detail);
        console.log(data);
        setStatusFlowRows(flow);
        setReEtaRequestsRaw(reqs);
        setPoDetail(detail);
        setStatus(getLastValidStatus(flow));

        const serverEtd = getInitialServerEtd(detail, flow) ?? todayStart();
        const serverActualDeliveryDate =
          parseServerDate(detail?.FinalActualDeliveryDate) ?? todayStart();
        const serverRemarks = trim(detail?.["WIP Remark"] ?? detail?.WIPRemark);
        const serverAwb = trim(detail?.AWB);
        const serverEtaDays = getInitialServerEtaDays(detail, serverEtd);

        setEtd((prev) => prev ?? serverEtd);
        setActualDeliveryDate((prev) => prev ?? serverActualDeliveryDate);
        setRemarks((prev) => prev || serverRemarks);
        setAwb((prev) => prev || serverAwb);
        setLeadtimeDelivery(
          (prev) => prev || trim(detail?.LeadtimeDelivery?.toString()) || "",
        );
      } catch (e: any) {
        if (e?.message === "Session expired") {
          return;
        }

        const isAbort = e?.name === "AbortError";

        setStatusFlowRows([]);
        setReEtaRequestsRaw([]);
        setPoDetail(null);

        setLoadError(
          isAbort
            ? "Request timeout. Please try again."
            : e?.message || "Failed to load PO detail",
        );
        toast.error(
          isAbort
            ? "Request timeout"
            : e?.message || "Failed to load PO detail",
        );
      } finally {
        setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    void fetchDetail(controller.signal).finally(() => clearTimeout(timeout));

    return () => controller.abort();
  }, [fetchDetail]);

  const statusHistory = useMemo(
    () => buildStatusHistory(statusFlowRows),
    [statusFlowRows],
  );

  const idPoItem = useMemo(
    () => extractIdPoItem(poDetail, statusFlowRows),
    [poDetail, statusFlowRows],
  );

  const latestApprovedReEta = useMemo(() => {
    return getLatestApprovedReEta(reEtaRequestsRaw);
  }, [reEtaRequestsRaw]);

  const latestApprovedReEtaDate = useMemo(() => {
    const fallbackDeliveryDate =
      poDetail?.DeliveryDate ?? poDetail?.["Delivery date"] ?? null;

    if (reEtaRequestsRaw.length === 0) return fallbackDeliveryDate;

    return (
      latestApprovedReEta?.NewETA ??
      latestApprovedReEta?.newETA ??
      fallbackDeliveryDate
    );
  }, [latestApprovedReEta, poDetail, reEtaRequestsRaw]);

  const poDeliveryDateValue = useMemo(() => {
    const approvedNewEta = latestApprovedReEtaDate;
    return (
      approvedNewEta ??
      poDetail?.DeliveryDate ??
      poDetail?.["Delivery date"] ??
      null
    );
  }, [latestApprovedReEtaDate, poDetail]);

  const deliveryDate = useMemo(
    () => parseServerDate(poDeliveryDateValue),
    [poDeliveryDateValue],
  );

  const isRequiredDeliveryDatePassed = useMemo(() => {
    return isDateBeforeToday(poDeliveryDateValue);
  }, [poDeliveryDateValue]);

  const currentEtaForReschedule = useMemo(() => {
    if (status === "PO Submitted") {
      return safeDateOnly(poDeliveryDateValue);
    }
    return safeDateOnly(poDetail?.CurrentEta ?? poDetail?.ETA);
  }, [status, poDeliveryDateValue, poDetail]);

  const currentEtdForReschedule = useMemo(() => {
    return etd ? format(etd, "yyyy-MM-dd") : null;
  }, [etd]);

  const currentLeadtimeForReschedule = useMemo(() => {
    return etaDays ? String(etaDays) : null;
  }, [etaDays]);

  const currentEtaDateForReschedule = useMemo(() => {
    if (!etd) return null;
    const days = parseInt(etaDays, 10);
    if (!etaDays || Number.isNaN(days) || days <= 0) return null;
    return addDaysDateOnly(etd, days);
  }, [etd, etaDays]);

  const newEtaDateForReschedule = useMemo(() => {
    if (!newEtd) return null;
    const days = parseInt(newLeadtimeDays, 10);
    if (!newLeadtimeDays || Number.isNaN(days) || days <= 0) return null;
    return addDaysDateOnly(newEtd, days);
  }, [newEtd, newLeadtimeDays]);

  const calculatedEtaDate = useMemo(() => {
    const days = parseInt(etaDays, 10);
    if (!etd || !etaDays || Number.isNaN(days) || days <= 0) return null;
    return addDaysDateOnly(etd, days);
  }, [etd, etaDays]);

  const isEtaBeyondDeliveryDate = useMemo(() => {
    if (status === "PO Submitted") {
      if (!calculatedEtaDate || !deliveryDate) return false;
      return (
        startOfDay(calculatedEtaDate).getTime() >
        startOfDay(deliveryDate).getTime()
      );
    }
    const currentEta = parseServerDate(currentEtaForReschedule);
    if (!currentEta || !deliveryDate) return false;
    return (
      startOfDay(currentEta).getTime() > startOfDay(deliveryDate).getTime()
    );
  }, [status, calculatedEtaDate, currentEtaForReschedule, deliveryDate]);

  const needsVendorUpdate = useMemo(() => {
    const currentEta = parseServerDate(currentEtaForReschedule);
    if (status !== "On Delivery") return false;
    if (!currentEta) return false;
    return diffDaysFromNow(currentEta) <= 2;
  }, [status, currentEtaForReschedule]);

  const rescheduleRequests = useMemo(() => {
    return reEtaRequestsRaw
      .map((r, i) => normalizeReEtaRequest(r, i))
      .sort((a, b) => (b.requestDate || "").localeCompare(a.requestDate || ""));
  }, [reEtaRequestsRaw]);

  const hasPendingReEtaApproval = useMemo(
    () => rescheduleRequests.some((request) => request.status === "Pending"),
    [rescheduleRequests],
  );

  const hasRejectedReEta = useMemo(
    () => rescheduleRequests.some((request) => request.status === "Rejected"),
    [rescheduleRequests],
  );

  const shouldShowExpiredDeliveryAlert = useMemo(() => {
    return isRequiredDeliveryDatePassed && !hasPendingReEtaApproval;
  }, [isRequiredDeliveryDatePassed, hasPendingReEtaApproval]);

  const shouldShowEtaExceededAlertInline = useMemo(() => {
    return (
      isEtaBeyondDeliveryDate &&
      !isRequiredDeliveryDatePassed &&
      !hasPendingReEtaApproval
    );
  }, [
    isEtaBeyondDeliveryDate,
    isRequiredDeliveryDatePassed,
    hasPendingReEtaApproval,
  ]);

  const shouldShowEtaExceededAlert = useMemo(() => {
    if (hasPendingReEtaApproval) return false;
    return isRequiredDeliveryDatePassed || isEtaBeyondDeliveryDate;
  }, [
    hasPendingReEtaApproval,
    isRequiredDeliveryDatePassed,
    isEtaBeyondDeliveryDate,
  ]);

  const isPoSubmittedBlockedByEta = useMemo(() => {
    if (hasPendingReEtaApproval) return false;
    return isRequiredDeliveryDatePassed || isEtaBeyondDeliveryDate;
  }, [
    hasPendingReEtaApproval,
    isRequiredDeliveryDatePassed,
    isEtaBeyondDeliveryDate,
  ]);

  const isPoSubmittedSubmitDisabled = useMemo(
    () =>
      isRequiredDeliveryDatePassed ||
      isPoSubmittedBlockedByEta ||
      hasPendingReEtaApproval,
    [
      isRequiredDeliveryDatePassed,
      isPoSubmittedBlockedByEta,
      hasPendingReEtaApproval,
    ],
  );

  const orderQuantity = useMemo(() => {
    return toNumberOrZero(poDetail?.["Qty Order"] ?? poDetail?.QtyOrder);
  }, [poDetail]);

  const calculatedLeadtimeDeliveryDate = useMemo(() => {
    const days = parseInt(leadtimeDelivery, 10);
    if (
      !actualDeliveryDate ||
      !leadtimeDelivery ||
      Number.isNaN(days) ||
      days <= 0
    )
      return null;
    return addDaysDateOnly(actualDeliveryDate, days);
  }, [actualDeliveryDate, leadtimeDelivery]);

  const enteredQuantity = useMemo(() => {
    return quantity === "" ? null : Number(quantity);
  }, [quantity]);

  const isQuantityMismatch = useMemo(() => {
    if (quantity === "") return false;
    if (enteredQuantity === null || Number.isNaN(enteredQuantity)) return false;
    return enteredQuantity !== orderQuantity;
  }, [quantity, enteredQuantity, orderQuantity]);

  const isCalculatedDeliveryDateBeyondPoDeliveryDate = useMemo(() => {
    if (!calculatedLeadtimeDeliveryDate || !deliveryDate) return false;
    return (
      startOfDay(calculatedLeadtimeDeliveryDate).getTime() >
      startOfDay(deliveryDate).getTime()
    );
  }, [calculatedLeadtimeDeliveryDate, deliveryDate]);

  const onDeliveryEtaDifference = useMemo(() => {
    const previousEta = parseServerDate(poDetail?.CurrentEta ?? poDetail?.ETA);
    if (!calculatedLeadtimeDeliveryDate || !previousEta) return null;
    return diffDaysDateOnly(calculatedLeadtimeDeliveryDate, previousEta);
  }, [calculatedLeadtimeDeliveryDate, poDetail]);

  const isWipSubmitDisabled = useMemo(() => {
    return (
      isRequiredDeliveryDatePassed ||
      submittingPoStatus ||
      isQuantityMismatch ||
      (onDeliveryEtaDifference !== null && onDeliveryEtaDifference > 0) ||
      hasPendingReEtaApproval
    );
  }, [
    isRequiredDeliveryDatePassed,
    submittingPoStatus,
    isQuantityMismatch,
    onDeliveryEtaDifference,
    hasPendingReEtaApproval,
  ]);

  const fetchDelayReasons = useCallback(async () => {
    try {
      setLoadingDelayReasons(true);
      const raw = await fetch(API.DELAY_REASONS_LIST(), {
        method: "GET",
        headers: buildAuthHeaders(),
      });

      if (!raw.ok) {
        setLoadingDelayReasons(false);
        return;
      }

      const data = await raw.json();
      const list: any[] = Array.isArray(data)
        ? data
        : (data?.Data ?? data?.data ?? data?.Items ?? data?.items ?? []);
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
  }, []);

  const submitOnDeliveryUpdate = useCallback(async (formData: FormData) => {
    const res = await fetchWithAuth(API.POSTATUS_ON_DELIVERY(), {
      method: "POST",
      headers: buildMultipartAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      let body: any;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      throw new Error(body?.message || body?.Message || `HTTP ${res.status}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    return data;
  }, []);

  const handleOpenRescheduleDialog = useCallback(async () => {
    setRescheduleDialogOpen(true);
    setNewEtd(actualDeliveryDate ?? todayStart());
    setNewLeadtimeDays(
      status === "PO Submitted" ? etaDays || "" : leadtimeDelivery || "",
    );
    setRescheduleReason("");
    setSelectedDelayReasonId(null);
    await fetchDelayReasons();
  }, [
    actualDeliveryDate,
    etaDays,
    leadtimeDelivery,
    status,
    fetchDelayReasons,
  ]);

  const handleCloseRescheduleDialog = useCallback(() => {
    setRescheduleDialogOpen(false);
    setNewEtd(undefined);
    setNewLeadtimeDays("");
    setRescheduleReason("");
    setEvidenceFile(null);
    setSelectedDelayReasonId(null);
  }, []);

  const handleSubmitAwb = useCallback(async () => {
    try {
      if (hasPendingReEtaApproval) {
        toast.error(WAITING_REETA_APPROVAL_MESSAGE);
        return;
      }

      if (isRequiredDeliveryDatePassed) {
        toast.error(ETA_DELIVERY_DATE_ERROR);
        return;
      }

      if (!idPoItem) {
        toast.error("ID PO Item not found.");
        return;
      }

      if (!awb.trim()) {
        toast.error("Please enter an AWB number.");
        return;
      }

      if (!actualDeliveryDate) {
        toast.error("Please select an actual delivery date.");
        return;
      }

      const leadtime = parseInt(leadtimeDelivery, 10);
      if (!leadtimeDelivery || Number.isNaN(leadtime) || leadtime <= 0) {
        toast.error("Please enter a valid leadtime delivery.");
        return;
      }

      const qty = parseFloat(quantity);
      if (quantity === "" || Number.isNaN(qty) || qty < 0) {
        toast.error("Please enter a valid quantity.");
        return;
      }

      if (qty !== orderQuantity) {
        toast.error("The entered quantity must match the ordered quantity.");
        return;
      }

      if (onDeliveryEtaDifference !== null && onDeliveryEtaDifference > 0) {
        toast.error(WIP_REETA_REQUIRED_ERROR);
        return;
      }

      if (!awbFile) {
        toast.error("Please upload the AWB document.");
        return;
      }

      setSubmittingPoStatus(true);

      const formData = new FormData();
      formData.append("ID_PO_Item", idPoItem);
      formData.append("AWB", awb.trim());
      formData.append(
        "ActualDeliveryDate",
        formatDateOnly(actualDeliveryDate) || "",
      );
      formData.append("LeadtimeDelivery", String(leadtime));
      formData.append("Quantity", String(qty));
      formData.append("File", awbFile);

      await submitOnDeliveryUpdate(formData);

      toast.success("Delivery information updated successfully.");
      setHasFilledUpdate(true);

      setActualDeliveryDate(todayStart());
      setLeadtimeDelivery("");
      setQuantity("");
      setAwbFile(null);
      setAwbFileInputKey((prev) => prev + 1);

      await fetchDetail();
    } catch (error: any) {
      if (error?.message !== "Session expired") {
        toast.error(error?.message || "Failed to update delivery information.");
      }
    } finally {
      setSubmittingPoStatus(false);
    }
  }, [
    hasPendingReEtaApproval,
    isRequiredDeliveryDatePassed,
    idPoItem,
    awb,
    actualDeliveryDate,
    leadtimeDelivery,
    quantity,
    orderQuantity,
    isCalculatedDeliveryDateBeyondPoDeliveryDate,
    awbFile,
    submitOnDeliveryUpdate,
    fetchDetail,
  ]);

  const handleAwbFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;

      if (!file) {
        setAwbFile(null);
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "image/png",
        "image/jpg",
        "image/jpeg",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error("Only PDF, PNG, JPG, and JPEG files are allowed.");
        e.target.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB.");
        e.target.value = "";
        return;
      }

      setAwbFile(file);
    },
    [],
  );

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

  const openConfirmationModal = useCallback((action: PendingSubmitAction) => {
    setPendingSubmitAction(action);
    setConfirmationChecked(false);
    setConfirmationModalOpen(true);
  }, []);

  const closeConfirmationModal = useCallback(() => {
    setConfirmationModalOpen(false);
    setConfirmationChecked(false);
    setPendingSubmitAction(null);
  }, []);

  const submitPoStatusUpdate = useCallback(
    async (body: Record<string, any>) => {
      const res = await fetchWithAuth(API.POSTATUS_UPSERT(), {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let body: any;
        try {
          body = await res.json();
        } catch {
          body = undefined;
        }
        throw new Error(body?.message || body?.Message || `HTTP ${res.status}`);
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }
      return data;
    },
    [],
  );

  const handleSubmitOrderInformation = useCallback(async () => {
    try {
      if (submittingPoStatus) return;

      if (!idPoItem) {
        toast.error("ID PO Item not found.");
        return;
      }

      if (!etd) {
        toast.error("Please select a valid ETD.");
        return;
      }

      const days = parseInt(etaDays, 10);
      if (!etaDays || Number.isNaN(days) || days <= 0) {
        toast.error("Please enter a valid lead time.");
        return;
      }

      if (!remarks.trim()) {
        toast.error("Please enter remarks.");
        return;
      }

      setSubmittingPoStatus(true);

      await submitPoStatusUpdate({
        IDPOItem: idPoItem,
        ETD: format(etd, "yyyy-MM-dd"),
        ETA: days,
        WIPRemark: remarks.trim(),
      });

      toast.success("Order information updated successfully.");

      setEtd(undefined);
      setEtaDays("");
      setRemarks("");

      await fetchDetail();
    } catch (error: any) {
      if (error?.message !== "Session expired") {
        toast.error(error?.message || "Failed to update order information.");
      }
    } finally {
      setSubmittingPoStatus(false);
    }
  }, [
    submittingPoStatus,
    idPoItem,
    etd,
    etaDays,
    remarks,
    submitPoStatusUpdate,
    fetchDetail,
  ]);

  const handleClickSubmitOnDelivery = useCallback(() => {
    if (submittingPoStatus || isWipSubmitDisabled) return;

    if (hasPendingReEtaApproval) {
      toast.error(WAITING_REETA_APPROVAL_MESSAGE);
      return;
    }

    if (isRequiredDeliveryDatePassed) {
      toast.error(ETA_DELIVERY_DATE_ERROR);
      return;
    }

    openConfirmationModal("on-delivery");
  }, [
    submittingPoStatus,
    isWipSubmitDisabled,
    hasPendingReEtaApproval,
    isRequiredDeliveryDatePassed,
    openConfirmationModal,
  ]);

  const submitReEtaCreate = useCallback(async (body: Record<string, any>) => {
    const res = await fetchWithAuth(API.REETA_CREATE(), {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let body: any;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      throw new Error(body?.message || body?.Message || `HTTP ${res.status}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    return data;
  }, []);

  const handleSubmitReschedule = useCallback(async () => {
    try {
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
        String(trim(poDetail?.["Purchasing Document"]) ?? ""),
      );
      formData.append("PoItemNo", String(trim(poDetail?.Item) ?? ""));
      formData.append("VendorName", String(trim(poDetail?.VendorName) ?? ""));
      formData.append("CurrentEta", format(newEtd, "yyyy-MM-dd"));
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
      handleCloseRescheduleDialog();

      setEtd(undefined);
      setEtaDays("");
      setRemarks("");
      setAwb("");
      setActualDeliveryDate(undefined);
      setLeadtimeDelivery("");
      setQuantity("");

      await fetchDetail();
    } catch (error: any) {
      if (error?.message !== "Session expired") {
        toast.error(error?.message || "Failed to submit reschedule request.");
      }
    } finally {
      setSubmittingReschedule(false);
    }
  }, [
    idPoItem,
    currentEtaForReschedule,
    newEtd,
    newLeadtimeDays,
    newEtaDateForReschedule,
    rescheduleReason,
    selectedDelayReasonId,
    evidenceFile,
    poDetail,
    handleCloseRescheduleDialog,
    fetchDetail,
  ]);

  const handleClickSubmitReschedule = useCallback(() => {
    if (submittingReschedule) return;

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

    openConfirmationModal("reschedule");
  }, [
    submittingReschedule,
    idPoItem,
    currentEtaForReschedule,
    newEtd,
    newLeadtimeDays,
    newEtaDateForReschedule,
    rescheduleReason,
    openConfirmationModal,
  ]);

  const handleConfirmedSubmit = useCallback(() => {
    if (!confirmationChecked || !pendingSubmitAction) return;

    closeConfirmationModal();

    if (pendingSubmitAction === "po-submitted") {
      void handleSubmitOrderInformation();
    } else if (pendingSubmitAction === "on-delivery") {
      void handleSubmitAwb();
    } else if (pendingSubmitAction === "reschedule") {
      void handleSubmitReschedule();
    }
  }, [
    confirmationChecked,
    pendingSubmitAction,
    closeConfirmationModal,
    handleSubmitOrderInformation,
    handleSubmitAwb,
    handleSubmitReschedule,
  ]);

  const handleDownloadFile = useCallback((file: ReEtaFile) => {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (file.base64Data) {
      downloadBase64File(
        file.base64Data,
        file.name || "document",
        file.contentType || "application/octet-stream",
      );
      return;
    }

    toast.error("File not found.");
  }, []);

  const handleViewFile = useCallback((file: ReEtaFile) => {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (file.base64Data) {
      const mime = file.contentType || "application/octet-stream";
      const byteCharacters = atob(file.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      return;
    }

    toast.error("File not found.");
  }, []);

  const handleDownloadAwbBase64File = useCallback(() => {
    const base64 = trim(poDetail?.AWBBase64Data);
    if (!base64) {
      toast.error("AWB file not found.");
      return;
    }

    const mime = trim(poDetail?.AWBContentType) || getBase64MimeType(base64);
    const extension =
      mime === "application/pdf"
        ? "pdf"
        : mime === "image/png"
          ? "png"
          : mime === "image/jpeg" || mime === "image/jpg"
            ? "jpg"
            : "bin";

    const fileName =
      trim(poDetail?.AWBFileName) ||
      `${trim(poDetail?.["Purchasing Document"]) || "AWB"}-AWB.${extension}`;

    downloadBase64File(base64, fileName, poDetail?.AWBContentType);
  }, [poDetail]);

  const handleClickSubmitInformation = useCallback(() => {
    if (submittingPoStatus) return;

    if (hasPendingReEtaApproval) {
      toast.error(WAITING_REETA_APPROVAL_MESSAGE);
      return;
    }

    if (isRequiredDeliveryDatePassed) {
      toast.error(ETA_DELIVERY_DATE_ERROR);
      return;
    }

    if (shouldShowEtaExceededAlert) {
      toast.error(ETA_DELIVERY_DATE_ERROR);
      return;
    }

    openConfirmationModal("po-submitted");
  }, [
    submittingPoStatus,
    hasPendingReEtaApproval,
    isRequiredDeliveryDatePassed,
    shouldShowEtaExceededAlert,
    openConfirmationModal,
  ]);

  const handleBack = useCallback(async () => {
    try {
      await onRefreshPurchaseOrders?.();
    } finally {
      onBack();
    }
  }, [onBack, onRefreshPurchaseOrders]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Purchase Orders
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2" style={{ color: "#014357" }}>
              Purchase Order Details
            </h1>
            <p className="text-gray-600">
              PO #{poDetail?.["Purchasing Document"] || orderId} -{" "}
              {poDetail?.Item || ""}
            </p>
            {loading && (
              <p className="mt-1 text-xs text-gray-500">Loading detail...</p>
            )}
            {loadError && (
              <p className="mt-1 text-xs text-red-600">{loadError}</p>
            )}
          </div>

          <Badge
            className="px-4 py-2 text-base"
            style={{
              backgroundColor: hasRejectedReEta
                ? "#DC2626"
                : getStatusColor(status),
              color: "white",
            }}
          >
            {hasRejectedReEta ? "Cancel" : status}
          </Badge>
        </div>
      </div>

      {user.role === "vendor" && needsVendorUpdate && !hasFilledUpdate && (
        <Alert
          className="mb-6"
          style={{
            borderColor: "#ED832D",
            backgroundColor: "rgba(237, 131, 45, 0.1)",
          }}
        >
          <AlertCircle className="h-4 w-4" style={{ color: "#ED832D" }} />
          <AlertDescription>
            This order’s ETA is in 2 days or less. Please provide an update on
            the delivery status.
          </AlertDescription>
        </Alert>
      )}

      {canCreateReschedule(user.role, status) && (
        <Button
          className="mb-6"
          style={{ backgroundColor: "#014357" }}
          onClick={handleOpenRescheduleDialog}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Create Reschedule ETA Request
        </Button>
      )}

      <div className="space-y-6">
        <StatusFlowHistory status={status} statusHistory={statusHistory} />

        {status !== "PO Submitted" && (
          <StatusRelatedInformation
            status={status}
            poDetail={poDetail}
            latestApprovedReEtaDate={latestApprovedReEtaDate}
            onDownloadAwbFile={handleDownloadAwbBase64File}
            currentEtaForReschedule={currentEtaForReschedule}
            etaDays={etaDays}
          />
        )}

        {user.role === "vendor" && !hasRejectedReEta && (
          <>
            {status === "PO Submitted" &&
              (() => {
                const currentEta = parseServerDate(currentEtaForReschedule);
                const etaExceededDays =
                  currentEta && deliveryDate
                    ? diffDaysDateOnly(currentEta, deliveryDate)
                    : null;

                return (
                  <Card className="p-6">
                    <h2 className="mb-4" style={{ color: "#014357" }}>
                      Update Order Information
                    </h2>

                    <RequiredDeliveryDateCard
                      deliveryDateValue={poDeliveryDateValue}
                    />

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="vendor-etd">
                          ETD (Estimate Time of Delivery){" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="mt-1 w-full justify-start text-left"
                              type="button"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {etd ? (
                                format(etd, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={etd}
                              onSelect={setEtd}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label htmlFor="vendor-eta-days">
                          Leadtime Delivery{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="vendor-eta-days"
                          type="number"
                          min={1}
                          value={etaDays}
                          onChange={(e) => setEtaDays(e.target.value)}
                          placeholder="Number of days"
                          className="mt-1"
                        />

                        {calculatedEtaDate && (
                          <div
                            className="mt-3 rounded-lg border border-gray-200 p-3"
                            style={{
                              backgroundColor: "rgba(106, 167, 93, 0.06)",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2
                                className="h-4 w-4"
                                style={{ color: "#6AA75D" }}
                              />
                              <div>
                                <p className="text-xs text-gray-500">
                                  Calculated ETA Date
                                </p>
                                <p style={{ color: "#014357" }}>
                                  {format(calculatedEtaDate, "PPP")}
                                </p>
                              </div>
                            </div>

                            {shouldShowEtaExceededAlertInline &&
                              etd &&
                              etaExceededDays !== null &&
                              etaExceededDays > 0 && (
                                <div className="mt-2 flex items-center gap-1.5 border-t border-gray-200 pt-2">
                                  <AlertCircle
                                    className="h-3.5 w-3.5"
                                    style={{ color: "#ED832D" }}
                                  />
                                  <p
                                    className="text-xs"
                                    style={{ color: "#ED832D" }}
                                  >
                                    This exceeds the required delivery date by{" "}
                                    {etaExceededDays} days
                                  </p>
                                </div>
                              )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="vendor-remarks">
                          Remarks <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="vendor-remarks"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Enter remarks about the order..."
                          className="mt-1"
                          rows={4}
                        />
                      </div>

                      {shouldShowExpiredDeliveryAlert && (
                        <div
                          className="flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-700">
                              ETA exceeds the delivery date. Please{" "}
                              <button
                                type="button"
                                className="btn-underlined-text inline cursor-pointer border-none bg-transparent p-0"
                                style={{ color: "#014357" }}
                                onClick={handleOpenRescheduleDialog}
                              >
                                submit a Reschedule ETA Request again
                              </button>{" "}
                              before proceeding.
                            </p>
                          </div>
                        </div>
                      )}

                      {shouldShowEtaExceededAlertInline && (
                        <div
                          className="flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-700">
                              ETA exceeds the delivery date. Please{" "}
                              <button
                                type="button"
                                className="btn-underlined-text inline cursor-pointer border-none bg-transparent p-0"
                                style={{ color: "#014357" }}
                                onClick={handleOpenRescheduleDialog}
                              >
                                submit a Reschedule ETA Request again
                              </button>{" "}
                              before proceeding.
                            </p>
                          </div>
                        </div>
                      )}

                      {hasPendingReEtaApproval && (
                        <div
                          className="flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-700">
                              {WAITING_REETA_APPROVAL_MESSAGE}
                            </p>
                          </div>
                        </div>
                      )}

                      <Button
                        type="button"
                        className="w-full"
                        style={{
                          backgroundColor:
                            isPoSubmittedSubmitDisabled || submittingPoStatus
                              ? "#94A3B8"
                              : "#014357",
                          color: "white",
                          cursor:
                            isPoSubmittedSubmitDisabled || submittingPoStatus
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            isPoSubmittedSubmitDisabled || submittingPoStatus
                              ? 0.7
                              : 1,
                        }}
                        disabled={
                          isPoSubmittedSubmitDisabled || submittingPoStatus
                        }
                        onClick={handleClickSubmitInformation}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {submittingPoStatus
                          ? "Submitting..."
                          : "Submit & Move to Work in Progress"}
                      </Button>
                    </div>
                  </Card>
                );
              })()}

            {status === "Work in Progress" &&
              (() => {
                // const previousEta =
                //   parseServerDate(poDetail?.CurrentEta ?? poDetail?.ETA) ??
                //   null;
                // const previousEtaLabel = previousEta
                //   ? format(previousEta, "MMM dd, yyyy")
                //   : "-";
                const previousEta =
                  parseServerDate(poDetail?.CurrentEta ?? poDetail?.ETA) ??
                  null;

                const previousEtaLabel = previousEta
                  ? format(previousEta, "MMM dd, yyyy")
                  : "-";
                const newCalculatedEta = calculatedLeadtimeDeliveryDate;

                const etaDifference =
                  previousEta && newCalculatedEta
                    ? diffDaysDateOnly(newCalculatedEta, previousEta)
                    : null;

                return (
                  <Card className="p-6">
                    <h2 className="mb-0" style={{ color: "#014357" }}>
                      Update Delivery Information
                    </h2>
                    <p className="m-[0px] text-sm text-gray-500">
                      Provide delivery details to mark this order as On
                      Delivery.
                    </p>

                    <div
                      className="m-[0px] mt-2 grid grid-cols-1 gap-4 rounded-lg p-4 sm:grid-cols-2"
                      style={{
                        backgroundColor: "rgba(1, 67, 87, 0.04)",
                        border: "1px solid rgba(1, 67, 87, 0.1)",
                      }}
                    >
                      <div>
                        <Label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                          Order Quantity
                        </Label>
                        <p style={{ color: "#014357" }}>
                          {orderQuantity} units
                        </p>
                      </div>

                      <div>
                        <Label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                          ETA (from previous step)
                        </Label>
                        <p style={{ color: "#014357" }}>{previousEtaLabel}</p>
                      </div>
                    </div>

                    <div className="mt-1 grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="space-y-5">
                        <div>
                          <Label htmlFor="delivery-quantity">
                            Quantity <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="delivery-quantity"
                            type="number"
                            min={0}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            onWheel={(e) =>
                              (e.target as HTMLInputElement).blur()
                            }
                            placeholder={`Must be exactly ${orderQuantity}`}
                            className="mt-1.5"
                          />
                        </div>

                        <div className="mt-4">
                          <Label htmlFor="vendor-awb">
                            AWB (Air Waybill){" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="vendor-awb"
                            type="text"
                            value={awb}
                            onChange={(e) => setAwb(e.target.value)}
                            placeholder="e.g., AWB-2026-001234567"
                            className="mt-1.5"
                          />
                        </div>

                        <div className="mt-4">
                          <Label htmlFor="awb-document">
                            AWB Document <span className="text-red-500">*</span>
                          </Label>

                          <div className="mt-1.5">
                            <label
                              htmlFor="awb-document"
                              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 transition-colors hover:border-gray-400 hover:bg-gray-50"
                            >
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-500">
                                {awbFile ? awbFile.name : "Upload file"}
                              </span>
                            </label>

                            <input
                              key={awbFileInputKey}
                              id="awb-document"
                              type="file"
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={handleAwbFileChange}
                            />
                          </div>

                          <p className="mt-1 text-xs text-gray-500">
                            Allowed file types: PDF, PNG, JPG, JPEG
                          </p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <Label htmlFor="actual-delivery-date">
                            Actual Delivery Date{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="mt-1.5 w-full justify-start text-left"
                                type="button"
                              >
                                <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                                {actualDeliveryDate ? (
                                  format(actualDeliveryDate, "PPP")
                                ) : (
                                  <span className="text-gray-400">
                                    Select date
                                  </span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={actualDeliveryDate}
                                onSelect={setActualDeliveryDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="mb-6 mt-4">
                          <Label htmlFor="leadtime-delivery">
                            Leadtime Delivery (days){" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="leadtime-delivery"
                            type="number"
                            min={1}
                            value={leadtimeDelivery}
                            onChange={(e) =>
                              setLeadtimeDelivery(e.target.value)
                            }
                            onWheel={(e) =>
                              (e.target as HTMLInputElement).blur()
                            }
                            placeholder="e.g., 5"
                            className="mt-1.5"
                          />
                        </div>

                        {newCalculatedEta && (
                          <div
                            className="flex items-center justify-between rounded-lg px-3 py-4"
                            style={{
                              backgroundColor:
                                etaDifference !== null && etaDifference > 0
                                  ? "rgba(237, 131, 45, 0.06)"
                                  : "rgba(106, 167, 93, 0.06)",
                              border: `1px solid ${
                                etaDifference !== null && etaDifference > 0
                                  ? "rgba(237, 131, 45, 0.15)"
                                  : "rgba(106, 167, 93, 0.15)"
                              }`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarDays
                                className="h-4 w-4"
                                style={{
                                  color:
                                    etaDifference !== null && etaDifference > 0
                                      ? "#ED832D"
                                      : "#6AA75D",
                                }}
                              />
                              <span className="text-sm text-gray-600">
                                New ETA
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm"
                                style={{ color: "#014357" }}
                              >
                                {format(newCalculatedEta, "MMM dd, yyyy")}
                              </span>

                              {etaDifference !== null &&
                                etaDifference !== 0 && (
                                  <Badge
                                    className="px-1.5 py-0.5 text-xs"
                                    style={{
                                      backgroundColor:
                                        etaDifference > 0
                                          ? "rgba(237, 131, 45, 0.12)"
                                          : "rgba(106, 167, 93, 0.12)",
                                      color:
                                        etaDifference > 0
                                          ? "#ED832D"
                                          : "#6AA75D",
                                      border: "none",
                                    }}
                                  >
                                    {etaDifference > 0
                                      ? `+${etaDifference}d vs previous`
                                      : `${Math.abs(etaDifference)}d earlier`}
                                  </Badge>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      {shouldShowExpiredDeliveryAlert && (
                        <div
                          className="mb-4 flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-700">
                              ETA exceeds the delivery date. Please{" "}
                              <button
                                className="btn-underlined-text inline cursor-pointer border-none bg-transparent p-0 underline"
                                style={{ color: "#014357" }}
                                onClick={handleOpenRescheduleDialog}
                                type="button"
                              >
                                submit a Reschedule ETA Request again
                              </button>{" "}
                              before proceeding.
                            </p>
                          </div>
                        </div>
                      )}

                      {!shouldShowExpiredDeliveryAlert &&
                        !hasPendingReEtaApproval &&
                        onDeliveryEtaDifference !== null &&
                        onDeliveryEtaDifference > 0 && (
                          <div
                            className="mb-4 flex items-start gap-3 rounded-lg p-3"
                            style={{
                              backgroundColor: "rgba(220, 38, 38, 0.06)",
                              border: "1px solid rgba(220, 38, 38, 0.15)",
                            }}
                          >
                            <AlertCircle
                              className="mt-0.5 h-4 w-4 shrink-0"
                              style={{ color: "#DC2626" }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-700">
                                New ETA exceeds the ETA from previous step
                                {onDeliveryEtaDifference > 0
                                  ? ` by ${onDeliveryEtaDifference} days`
                                  : ""}
                                . Please{" "}
                                <button
                                  className="btn-underlined-text inline cursor-pointer border-none bg-transparent p-0 underline"
                                  style={{ color: "#014357" }}
                                  onClick={handleOpenRescheduleDialog}
                                  type="button"
                                >
                                  submit a Re-ETA request again
                                </button>{" "}
                                before updating the delivery status.
                              </p>
                            </div>
                          </div>
                        )}

                      {isQuantityMismatch && (
                        <div
                          className="mb-4 flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <p className="text-sm text-gray-700">
                            Quantity must be exactly{" "}
                            <span style={{ color: "#014357" }}>
                              {orderQuantity} units
                            </span>{" "}
                            to match the order quantity.
                          </p>
                        </div>
                      )}

                      {hasPendingReEtaApproval && (
                        <div
                          className="mb-4 flex items-start gap-3 rounded-lg p-3"
                          style={{
                            backgroundColor: "rgba(220, 38, 38, 0.06)",
                            border: "1px solid rgba(220, 38, 38, 0.15)",
                          }}
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: "#DC2626" }}
                          />
                          <p className="text-sm text-gray-700">
                            {WAITING_REETA_APPROVAL_MESSAGE}
                          </p>
                        </div>
                      )}

                      <Button
                        className="w-full text-white"
                        style={{
                          backgroundColor: isWipSubmitDisabled
                            ? "#9CA3AF"
                            : "#014357",
                        }}
                        disabled={isWipSubmitDisabled}
                        onClick={handleClickSubmitOnDelivery}
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        {submittingPoStatus
                          ? "Submitting..."
                          : "Submit & Mark On Delivery"}
                      </Button>
                    </div>
                  </Card>
                );
              })()}
          </>
        )}

        {rescheduleRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-5 font-medium" style={{ color: "#014357" }}>
              Re-schedule ETA History
            </h2>

            <div className="space-y-4">
              {rescheduleRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <p style={{ color: "#014357" }}>{request.id}</p>
                        <Badge
                          style={{
                            backgroundColor: getRescheduleStatusColor(
                              request.status,
                            ),
                            color: "white",
                          }}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        Requested by: {request.requestedBy}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {request.requestDate
                        ? formatDate(request.requestDate)
                        : "-"}
                    </p>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-4 border-b border-gray-200 pb-3 md:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs text-gray-500">
                        Old ETA
                      </Label>
                      <p className="text-sm text-gray-900">
                        {request.oldETA ? formatDate(request.oldETA) : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-gray-500">
                        New ETA
                      </Label>
                      <p className="text-sm text-gray-900">
                        {request.newETA ? formatDate(request.newETA) : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-gray-500">
                        Proposed ETA Days
                      </Label>
                      <p className="text-sm text-gray-900">
                        {request.proposedETADays}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label className="mb-1 block text-xs text-gray-500">
                      Reason
                    </Label>
                    <p className="text-sm text-gray-700">
                      {request.delayReasonTitle} :{" "}
                      {request.delayReasonDescription}
                      <br />
                      <span>
                        <strong>Reschedule Reason:</strong> {request.reason}
                      </span>
                    </p>
                  </div>

                  {(request.feedbackDocFile ||
                    request.evidenceDocFile ||
                    request.vendorRespDocFile) && (
                    <div className="mb-3 space-y-2 border-t border-gray-200 pt-3">
                      {request.feedbackDocFile && (
                        <ReEtaDocFileCard
                          file={request.feedbackDocFile}
                          label="Feedback Document"
                          onView={handleViewFile}
                          onDownload={handleDownloadFile}
                        />
                      )}
                      {request.evidenceDocFile && (
                        <ReEtaDocFileCard
                          file={request.evidenceDocFile}
                          label="Evidence Document"
                          onView={handleViewFile}
                          onDownload={handleDownloadFile}
                        />
                      )}
                      {request.vendorRespDocFile && (
                        <ReEtaDocFileCard
                          file={request.vendorRespDocFile}
                          label="Vendor Response Document"
                          onView={handleViewFile}
                          onDownload={handleDownloadFile}
                        />
                      )}
                    </div>
                  )}

                  {request.evidenceFile && (
                    <div className="mb-3 border-t border-gray-200 pt-3">
                      <FileActionCard
                        file={request.evidenceFile}
                        label="Evidence File"
                        onDownload={handleDownloadFile}
                      />
                    </div>
                  )}

                  {request.status === "Pending" && request.waitingFile && (
                    <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3">
                      <FileActionCard
                        file={request.waitingFile}
                        label="Waiting File"
                        onDownload={handleDownloadFile}
                      />
                    </div>
                  )}

                  {request.status === "Approved" && request.approvalFile && (
                    <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 md:grid-cols-2">
                      <FileActionCard
                        file={request.approvalFile}
                        label="Approval File"
                        onDownload={handleDownloadFile}
                      />
                      <div />
                    </div>
                  )}

                  {request.status === "Rejected" && request.rejectionFile && (
                    <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 md:grid-cols-2">
                      <FileActionCard
                        file={request.rejectionFile}
                        label="Rejection File"
                        iconColor="#DC2626"
                        onDownload={handleDownloadFile}
                      />

                      {request.confirmationFile ? (
                        <FileActionCard
                          file={request.confirmationFile}
                          label="Confirmation File"
                          onDownload={handleDownloadFile}
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

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
              Review the current schedule and submit a request with New ETD and
              New Lead Time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Label className="mb-2 block text-sm text-gray-600">
                Current ETA
              </Label>
              <p className="text-lg" style={{ color: "#014357" }}>
                {currentEtaForReschedule
                  ? formatDate(currentEtaForReschedule)
                  : "Not set"}
              </p>
            </div>

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

            {newLeadtimeDays && (
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
            )}

            <div>
              <Label htmlFor="delayReasonCategory">
                Category Reason <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedDelayReasonId ?? ""}
                onValueChange={(value) =>
                  setSelectedDelayReasonId(value || null)
                }
                disabled={loadingDelayReasons}
              >
                <SelectTrigger id="delayReasonCategory" className="mt-1">
                  <SelectValue
                    placeholder={
                      loadingDelayReasons ? "Loading..." : "Select category"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {delayReasons.map((reason) => (
                    <SelectItem key={reason.id} value={String(reason.id)}>
                      {reason.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rescheduleReason">
                Reason for Rescheduling <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rescheduleReason"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Provide a detailed reason for the reschedule request...."
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
                    <Upload className="h-5 w-10" style={{ color: "#6B7280" }} />
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
                <div className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <FileText
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: "#014357" }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-xs text-gray-500">Evidence File</p>
                    <p className="mb-1 text-sm">{evidenceFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(evidenceFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        const blobUrl = URL.createObjectURL(evidenceFile);
                        window.open(blobUrl, "_blank", "noopener,noreferrer");
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                      }}
                      disabled={submittingReschedule}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Review
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                      onClick={() => setEvidenceFile(null)}
                      disabled={submittingReschedule}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Remove
                    </Button>
                  </div>
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
              onClick={handleClickSubmitReschedule}
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
              disabled={!confirmationChecked}
              style={{
                backgroundColor: confirmationChecked ? "#014357" : "#94A3B8",
              }}
              className="text-white hover:opacity-90"
            >
              Saya Setuju &amp; Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
