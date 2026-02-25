// src/components/pages/PurchaseOrderDetail.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  Package,
  Truck,
  PackageCheck,
  PackageOpen,
  FileText,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User } from './Login';
import { Alert, AlertDescription } from '../ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format } from 'date-fns';

import { API } from '../../config';
import { getAccessToken } from '../../utils/authSession';

// ===================== Auth =====================
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

// ===================== Types =====================
interface PurchaseOrderDetailProps {
  user: User;
  orderId: string; // should be PO.ID (backend id)
  onBack: () => void;
}

type FlowStatus =
  | 'PO Submitted'
  | 'Work in Progress'
  | 'On Delivery'
  | 'Partially Received'
  | 'Fully Received';

type ApiStatusFlowRow = {
  Status?: string | null;
  StatusAt?: string | null;
  ['Purchasing Document']?: string | null;
  Item?: string | null;
};

type ReEtaFile = {
  name: string;
  uploadedBy?: string | null;
  uploadedDate?: string | null;
  url?: string | null;
};

// ✅ Antisipasi request.Files / files / FILES (future-ready)
type ApiReEtaFiles = {
  approvalFile?: any | null;
  rejectionFile?: any | null;
  confirmationFile?: any | null;

  // flat variant (future)
  name?: string | null;
  uploadedBy?: string | null;
  uploadedDate?: string | null;
  url?: string | null;

  // casing variant
  Name?: string | null;
  UploadedBy?: string | null;
  UploadedDate?: string | null;
  Url?: string | null;

  // alternate field
  confirmationFileName?: string | null;
  ConfirmationFileName?: string | null;
};

type NormalizedReEta = {
  id: string;
  requestDate: string | null;
  requestedBy: string;
  oldETA: string | null;
  newETA: string | null;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  responseDate: string | null;
  approvalFile?: ReEtaFile | null;
  rejectionFile?: ReEtaFile | null;
  confirmationFile?: ReEtaFile | null;
};

type DetailApiResponse = {
  Data?: {
    StatusFlow?: ApiStatusFlowRow[];
    ReEtaRequests?: any[];
    Order?: any;
  };
  data?: {
    StatusFlow?: ApiStatusFlowRow[];
    ReEtaRequests?: any[];
    Order?: any;
  };
  message?: string;
  Message?: string;
};

// ===================== Constants =====================
const FLOW_ORDER: FlowStatus[] = [
  'PO Submitted',
  'Work in Progress',
  'On Delivery',
  'Partially Received',
  'Fully Received',
];

// ===== Status Flow line constants (MOVE OUTSIDE COMPONENT) =====
const STATUS_LINE_TOP = 24; // center of w-12 (48px)
const STATUS_LINE_HEIGHT = 4;

// ===================== Helpers =====================
const trim = (v: any) => (v === null || v === undefined ? '' : String(v)).trim();

const mapFlowStatus = (backendStatus?: string | null): FlowStatus | null => {
  const s = trim(backendStatus);
  if (!s) return null;

  const u = s.toUpperCase();
  if (u === 'SUBMITTED' || u === 'PO SUBMITTED') return 'PO Submitted';
  if (u === 'WORK IN PROGRESS') return 'Work in Progress';
  if (u === 'ON DELIVERY') return 'On Delivery';
  if (u === 'PARTIALLY RECEIVED') return 'Partially Received';
  if (u === 'FULLY RECEIVED') return 'Fully Received';

  if (s === 'Submitted') return 'PO Submitted';
  if (s === 'Work In Progress' || s === 'Work in Progress') return 'Work in Progress';
  if (s === 'On Delivery') return 'On Delivery';
  if (s === 'Partially Received') return 'Partially Received';
  if (s === 'Fully Received') return 'Fully Received';
  return null;
};

const toIsoString = (v?: string | null): string | null => {
  const s = trim(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatDateTime = (dateTimeString: string): string => {
  const d = new Date(dateTimeString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateString: string): string => {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PO Submitted':
      return '#ED832D';
    case 'Work in Progress':
      return '#5C8CB6';
    case 'On Delivery':
      return '#008383';
    case 'Partially Received':
      return '#F59E0B';
    case 'Fully Received':
      return '#6AA75D';
    default:
      return '#014357';
  }
};

const getRescheduleStatusColor = (status: string) => {
  switch (status) {
    case 'Pending':
      return '#ED832D';
    case 'Approved':
      return '#6AA75D';
    case 'Rejected':
      return '#DC2626';
    default:
      return '#014357';
  }
};

const getStatusIcon = (statusName: string) => {
  switch (statusName) {
    case 'PO Submitted':
      return FileText;
    case 'Work in Progress':
      return Package;
    case 'On Delivery':
      return Truck;
    case 'Partially Received':
      return PackageOpen;
    case 'Fully Received':
      return PackageCheck;
    default:
      return FileText;
  }
};

const safeDateOnly = (v: any): string | null => {
  const s = trim(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const safeId = (v: any, fallback: string) => {
  const s = trim(v);
  return s || fallback;
};

const normalizeRescheduleStatus = (raw: any): 'Pending' | 'Approved' | 'Rejected' | string => {
  const s = trim(raw);
  if (!s) return 'Pending';
  const u = s.toUpperCase();
  if (u === 'PENDING') return 'Pending';
  if (u === 'APPROVED') return 'Approved';
  if (u === 'REJECTED') return 'Rejected';
  return s;
};

// ✅ robust file picker for r.approvalFile OR r.Files.approvalFile OR r.Files.name etc.
const pickFile = (x: any, fallbackName: string): ReEtaFile | null => {
  if (!x) return null;

  if (typeof x === 'object') {
    const name = trim(x?.name ?? x?.Name ?? x?.fileName ?? x?.FileName) || fallbackName;
    const uploadedBy = trim(x?.uploadedBy ?? x?.UploadedBy) || null;
    const uploadedDate = safeDateOnly(x?.uploadedDate ?? x?.UploadedDate) || null;
    const url = trim(x?.url ?? x?.Url) || null;

    if (!name && !uploadedBy && !uploadedDate && !url) return null;
    return { name, uploadedBy, uploadedDate, url };
  }

  const s = trim(x);
  return s ? { name: s, uploadedBy: null, uploadedDate: null, url: null } : null;
};

// ✨ Normalize backend ReEtaRequests (tahan banting + future Files)
const normalizeReEtaRequest = (r: any, idx: number): NormalizedReEta => {
  const id = safeId(
    r?.POREETANUMBER ??
      r?.['POREETANUMBER'] ??
      r?.id ??
      r?.ID ??
      r?.RequestID ??
      r?.RequestNo,
    `RSR-${String(idx + 1).padStart(3, '0')}`,
  );

  const status = normalizeRescheduleStatus(
    r?.['Reschedule Status'] ?? r?.RescheduleStatus ?? r?.status ?? r?.Status,
  );

  const oldETA = safeDateOnly(r?.OldETA ?? r?.oldETA ?? r?.OldEta ?? r?.OldEtaDate ?? r?.OldReEtaDate);
  const newETA = safeDateOnly(r?.NewETA ?? r?.newETA ?? r?.NewEta ?? r?.NewEtaDate ?? r?.NewReEtaDate ?? r?.ReEtaDate);

  const requestDate = safeDateOnly(r?.RequestedAt ?? r?.requestDate ?? r?.RequestDate ?? r?.CreatedAt ?? r?.CREATED_AT);
  const responseDate = safeDateOnly(
    r?.ResponseAt ?? r?.responseDate ?? r?.ResponseDate ?? r?.ApprovedAt ?? r?.RejectedAt ?? r?.FEEDBACK_AT,
  );

  const requestedBy = trim(r?.RequestedBy ?? r?.requestedBy ?? r?.VendorName ?? r?.SupplierName) || '-';
  const reason =
    trim(
      r?.['Reschedule Reason'] ??
        r?.RescheduleReason ??
        r?.reason ??
        r?.Reason ??
        r?.remarks ??
        r?.Remarks ??
        r?.Note ??
        r?.note,
    ) || '-';

  const files = (r?.Files ?? r?.files ?? r?.FILES) as ApiReEtaFiles | undefined;

  const approvalFile =
    pickFile(r?.approvalFile, 'Approval File') ||
    pickFile((files as any)?.approvalFile ?? (files as any)?.ApprovalFile, 'Approval File') ||
    null;

  const rejectionFile =
    pickFile(r?.rejectionFile, 'Rejection File') ||
    pickFile((files as any)?.rejectionFile ?? (files as any)?.RejectionFile, 'Rejection File') ||
    null;

  const confirmationFile =
    pickFile(r?.confirmationFile, 'Confirmation File') ||
    pickFile((files as any)?.confirmationFile ?? (files as any)?.ConfirmationFile, 'Confirmation File') ||
    pickFile((files as any)?.confirmationFileName ?? (files as any)?.ConfirmationFileName, 'Confirmation File') ||
    null;

  const flatMaybe = pickFile(
    files && (files?.name ?? files?.Name ?? (files as any)?.fileName ?? (files as any)?.FileName) ? files : null,
    'File',
  );

  const finalApprovalFile = approvalFile ?? (status === 'Approved' ? flatMaybe : null);
  const finalRejectionFile = rejectionFile ?? (status === 'Rejected' ? flatMaybe : null);

  return {
    id,
    requestDate,
    requestedBy,
    oldETA,
    newETA,
    reason,
    status,
    responseDate,
    approvalFile: finalApprovalFile,
    rejectionFile: finalRejectionFile,
    confirmationFile,
  };
};

const canCreateReschedule = (role: User['role'], status: string) =>
  role === 'vendor' && (status === 'Work in Progress' || status === 'On Delivery');

// ===================== Extracted UI: Status Flow History =====================
type StatusFlowHistoryProps = {
  status: FlowStatus;
  statusHistory: Record<string, string>;
  isStatusActive: (s: string) => boolean;
  progressPct: number; // boleh tetap, tapi tidak dipakai lagi
};
function StatusFlowHistory({
  status,
  statusHistory,
  isStatusActive, // akan kita override pemakaiannya di bawah
}: StatusFlowHistoryProps) {
  const n = FLOW_ORDER.length;

  // center node pertama & terakhir
  const startPct = 100 / (n * 2); // n=5 => 10%
  const stepPct = 100 / n;        // n=5 => 20%

  const baseLeft = `calc(${startPct}% )`;
  const baseRight = `calc(${startPct}% )`;

  // ✅ progress index = step terakhir yang punya timestamp (StatusAt tidak null)
  const lastDoneIndex = useMemo(() => {
    let last = -1;
    FLOW_ORDER.forEach((st, i) => {
      if (statusHistory[st]) last = i;
    });
    return last;
  }, [statusHistory]);

  // ✅ progress width berdasarkan lastDoneIndex
  const progressWidth = lastDoneIndex <= 0 ? '0%' : `calc(${lastDoneIndex * stepPct}% )`;

  // ✅ jika tidak ada progress (StatusAt null semua / cuma step 0), pakai abu #f3f3f4
  const progressColor = lastDoneIndex <= 0 ? '#f3f3f4' : '#014357';

  // ✅ active step kalau punya timestamp
  const isActiveByTimestamp = useCallback(
    (statusName: FlowStatus) => !!statusHistory[statusName],
    [statusHistory],
  );

  return (
    <Card className="p-6">
      <h2 className="mb-6" style={{ color: '#014357' }}>
        Status Flow History
      </h2>

      <div className="relative">
        {/* Base line */}
        <div
          className="absolute"
          style={{
            left: baseLeft,
            right: baseRight,
            top: STATUS_LINE_TOP + 2,
            height: 6,
            backgroundColor: '#E5E7EB',
            borderRadius: 999,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Progress line */}
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
            transition: 'width 0.3s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Nodes */}
        <div className="flex items-start justify-between gap-2 relative" style={{ zIndex: 2 }}>
          {FLOW_ORDER.map((statusName) => {
            const Icon = getStatusIcon(statusName);

            // ✅ pakai timestamp sebagai acuan active
            const active = isActiveByTimestamp(statusName);

            const color = getStatusColor(statusName);
            const ts = statusHistory[statusName];

            return (
              <div key={statusName} className="flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                    style={{
                      backgroundColor: active ? color : '#E5E7EB',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <p className="text-xs text-center mb-1 px-1" style={{ color: '#014357' }}>
                    {statusName}
                  </p>

                  {active && ts && <p className="text-xs text-gray-500 text-center">{formatDateTime(ts)}</p>}
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
// ===================== Component =====================
export function PurchaseOrderDetail({ user, orderId, onBack }: PurchaseOrderDetailProps) {
  // ===== Server data =====
  const [statusFlowRows, setStatusFlowRows] = useState<ApiStatusFlowRow[]>([]);
  const [reEtaRequestsRaw, setReEtaRequestsRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ===== Local (template) =====
  const [status, setStatus] = useState<FlowStatus>('PO Submitted');
  const [remarks, setRemarks] = useState('');
  const [etd, setEtd] = useState<Date | undefined>(undefined);
  const [etaDays, setEtaDays] = useState('');
  const [awb, setAwb] = useState('');
  const [hasFilledUpdate, setHasFilledUpdate] = useState(false);

  // reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [newETADays, setNewETADays] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // ===== Fetch detail =====
  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);

      const url = API.DETAILPO(orderId);
      console.debug('[PO-DETAIL] request:', { url, orderId, hasAuth: !!getAuthToken() });

      try {
        const res = await fetch(url, { method: 'GET', headers: buildAuthHeaders(), signal });
        if (!res.ok) {
          let body: any = undefined;
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
            /* ignore */
          }
          console.error('[PO-DETAIL] HTTP error', res.status, body);
          throw new Error(body?.message || body?.Message || `HTTP ${res.status}`);
        }

        const json = (await res.json()) as DetailApiResponse;
        const data = (json?.Data ?? json?.data) as DetailApiResponse['Data'] | undefined;

        const flow = (data?.StatusFlow ?? []) as ApiStatusFlowRow[];
        console.log(flow);
        const reqs = (data?.ReEtaRequests ?? []) as any[];

        setStatusFlowRows(Array.isArray(flow) ? flow : []);
        setReEtaRequestsRaw(Array.isArray(reqs) ? reqs : []);

        // derive current status from flow
        const last = [...(Array.isArray(flow) ? flow : [])]
          .map((r) => mapFlowStatus(r.Status))
          .filter(Boolean)
          .pop() as FlowStatus | undefined;

        if (last) setStatus(last);
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError';
        console.error('[PO-DETAIL] fetch failed', e);
        setStatusFlowRows([]);
        setReEtaRequestsRaw([]);
        setLoadError(isAbort ? 'Request timeout. Please try again.' : e?.message || 'Failed to load PO detail');
        toast.error(isAbort ? 'Request timeout' : e?.message || 'Failed to load PO detail');
      } finally {
        setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    fetchDetail(controller.signal).finally(() => clearTimeout(timeout));
    return () => controller.abort();
  }, [fetchDetail]);

  // ===== Status history timestamps (from API flow) =====
  const statusHistory = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of statusFlowRows) {
      const st = mapFlowStatus(r.Status);
      const at = toIsoString(r.StatusAt);
      if (st && at) map[st] = at;
    }
    return map;
  }, [statusFlowRows]);
const progressPct = useMemo(() => {
  const currentIndex = FLOW_ORDER.indexOf(status);
  if (currentIndex <= 0) return 0;
  return (currentIndex / (FLOW_ORDER.length - 1)) * 100;
}, [status]);
  const isStatusActive = useCallback(
    (statusName: string) => {
      const currentIndex = FLOW_ORDER.indexOf(status);
      
      const checkIndex = FLOW_ORDER.indexOf(statusName as FlowStatus);
      return checkIndex !== -1 && checkIndex <= currentIndex;
    },
    [status],
  );

  const calculateEtaDate = useCallback(() => {
    if (!etd || !etaDays) return '';
    try {
      const etdDate = new Date(etd);
      const days = parseInt(etaDays);
      if (Number.isNaN(days)) return '';
      etdDate.setDate(etdDate.getDate() + days);
      return format(etdDate, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }, [etd, etaDays]);

  const etaDate = calculateEtaDate();

  const needsVendorUpdate = useCallback(() => {
    if (status !== 'On Delivery') return false;
    if (!etaDate) return false;

    const today = new Date();
    const eta = new Date(etaDate);
    const diffTime = eta.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 2;
  }, [status, etaDate]);

  // ===== Re-schedule data =====
  const rescheduleRequests = useMemo(() => {
    const list = reEtaRequestsRaw.map((r, i) => normalizeReEtaRequest(r, i));
    return list.sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }, [reEtaRequestsRaw]);

  // ===== Reschedule dialog helpers =====
  const handleOpenRescheduleDialog = useCallback(() => {
    setRescheduleDialogOpen(true);
    setNewETADays('');
    setRescheduleReason('');
  }, []);

  const handleCloseRescheduleDialog = useCallback(() => {
    setRescheduleDialogOpen(false);
    setNewETADays('');
    setRescheduleReason('');
  }, []);

  const calculateNewETADate = useCallback((): string | null => {
    if (!etd || !newETADays) return null;
    try {
      const etdDate = new Date(etd);
      const days = parseInt(newETADays);
      if (Number.isNaN(days)) return null;
      etdDate.setDate(etdDate.getDate() + days);
      return etdDate.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }, [etd, newETADays]);

  const handleSubmitReschedule = useCallback(() => {
    if (!etd) return toast.error('ETD must be set before creating a reschedule request');
    if (!etaDays) return toast.error('Current ETA must be set before creating a reschedule request');

    const newDays = parseInt(newETADays);
    const curDays = parseInt(etaDays);

    if (!newETADays || Number.isNaN(newDays) || newDays <= 0)
      return toast.error('Please enter a valid new ETA in days');
    if (!Number.isNaN(curDays) && newDays <= curDays)
      return toast.error('New ETA days must be greater than current ETA days');
    if (!rescheduleReason.trim()) return toast.error('Please provide a reason for rescheduling');

    // TODO: call API create reschedule request
    toast.success('Reschedule request submitted successfully');
    handleCloseRescheduleDialog();
  }, [etd, etaDays, newETADays, rescheduleReason, handleCloseRescheduleDialog]);

  const handleDownloadFile = useCallback((file: ReEtaFile) => {
    // TODO: implement actual download via file.url or API
    toast.success(`Downloading ${file.name}...`);
  }, []);

  // ===================== UI (STYLE TETAP) =====================
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Orders
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2" style={{ color: '#014357' }}>
              Purchase Order Details
            </h1>
            <p className="text-gray-600">PO #{orderId}</p>
            {loading && <p className="text-xs text-gray-500 mt-1">Loading detail...</p>}
            {loadError && <p className="text-xs text-red-600 mt-1">{loadError}</p>}
          </div>

          <Badge className="px-4 py-2 text-base" style={{ backgroundColor: getStatusColor(status), color: 'white' }}>
            {status}
          </Badge>
        </div>
      </div>

      {/* Alert for vendor update needed */}
      {user.role === 'vendor' && needsVendorUpdate() && !hasFilledUpdate && (
        <Alert className="mb-6" style={{ borderColor: '#ED832D', backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
          <AlertCircle className="h-4 w-4" style={{ color: '#ED832D' }} />
          <AlertDescription>
            This order&apos;s ETA is in 2 days or less. Please provide an update on the delivery status.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Action - Create Reschedule ETA Request - Only for Vendors */}
      {canCreateReschedule(user.role, status) && (
        <Button className="mb-6" style={{ backgroundColor: '#014357' }} onClick={handleOpenRescheduleDialog}>
          <Calendar className="h-4 w-4 mr-2" />
          Create Reschedule ETA Request
        </Button>
      )}

      <div className="space-y-6">
        {/* Status Flow History (REFRACTORED) */}
       <StatusFlowHistory
  status={status}
  statusHistory={statusHistory}
  isStatusActive={isStatusActive}
  progressPct={progressPct}
/>

        {/* Vendor Input Card (keep template style) */}
        {user.role === 'vendor' && (
          <>
            {/* PO Submitted -> fill ETD/ETA/Remarks */}
            {status === 'PO Submitted' && (
              <Card className="p-6">
                <h2 className="mb-4" style={{ color: '#014357' }}>
                  Update Order Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vendor-etd">
                      ETD (Estimated Date of Delivery) <span className="text-red-500">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left mt-1">
                          <Calendar className="mr-2 h-4 w-4" />
                          {etd ? format(etd, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent mode="single" selected={etd} onSelect={setEtd} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="vendor-eta-days">
                      ETA (in days from ETD) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vendor-eta-days"
                      type="number"
                      value={etaDays}
                      onChange={(e) => setEtaDays(e.target.value)}
                      placeholder="Number of days"
                      className="mt-1"
                    />

                    {etd && etaDays && parseInt(etaDays) > 0 && (
                      <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-sm text-gray-600">ETA Date:</p>
                        <p className="text-lg" style={{ color: '#014357' }}>
                          {format(new Date(etd.getTime() + parseInt(etaDays) * 24 * 60 * 60 * 1000), 'PPP')}
                        </p>
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

                  <Button
                    className="w-full"
                    style={{ backgroundColor: '#014357' }}
                    onClick={() => {
                      if (!etd) return toast.error('Please select an ETD date');
                      if (!etaDays || parseInt(etaDays) <= 0) return toast.error('Please enter a valid ETA in days');
                      if (!remarks.trim()) return toast.error('Please enter remarks');

                      // TODO: call API update to set ETD/ETA/Remarks
                      toast.success('Order information updated successfully');
                      setHasFilledUpdate(true);
                    }}
                  >
                    Submit Information
                  </Button>
                </div>
              </Card>
            )}

            {/* Work in Progress -> fill AWB */}
            {status === 'Work in Progress' && (
              <Card className="p-6">
                <h2 className="mb-4" style={{ color: '#014357' }}>
                  Update Delivery Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vendor-awb">
                      AWB (Air Waybill) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vendor-awb"
                      type="text"
                      value={awb}
                      onChange={(e) => setAwb(e.target.value)}
                      placeholder="Enter AWB number (e.g., AWB-2024-001234567)"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    className="w-full"
                    style={{ backgroundColor: '#014357' }}
                    onClick={() => {
                      if (!awb.trim()) return toast.error('Please enter AWB number');

                      // TODO: call API update AWB / status
                      toast.success('AWB information updated successfully');
                      setHasFilledUpdate(true);
                    }}
                  >
                    Submit AWB
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Re-schedule ETA History (template design) */}
        {rescheduleRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-5 font-medium" style={{ color: '#014357' }}>
              Re-schedule ETA History
            </h2>

            <div className="space-y-4">
              {rescheduleRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p style={{ color: '#014357' }}>{request.id}</p>
                        <Badge style={{ backgroundColor: getRescheduleStatusColor(request.status), color: 'white' }}>
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">Requested by: {request.requestedBy}</p>
                    </div>
                    <p className="text-sm text-gray-500">{request.requestDate ? formatDate(request.requestDate) : '-'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b border-gray-200">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Old ETA</Label>
                      <p className="text-sm text-gray-900">{request.oldETA ? formatDate(request.oldETA) : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">New ETA</Label>
                      <p className="text-sm text-gray-900">{request.newETA ? formatDate(request.newETA) : '-'}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label className="text-xs text-gray-500 block mb-1">Reason</Label>
                    <p className="text-sm text-gray-700">{request.reason}</p>
                  </div>

                  {/* Files Section - Side by Side */}
                  {request.status === 'Approved' && request.approvalFile && (
                    <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="w-full h-auto py-2 px-3"
                        onClick={() => handleDownloadFile(request.approvalFile!)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                          <div className="flex-1 text-left">
                            <p className="text-sm mb-1">{request.approvalFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.approvalFile.uploadedBy || '-'}
                              {request.approvalFile.uploadedDate ? ` on ${formatDate(request.approvalFile.uploadedDate)}` : ''}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>
                      <div />
                    </div>
                  )}

                  {request.status === 'Rejected' && request.rejectionFile && (
                    <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="w-full h-auto py-2 px-3"
                        onClick={() => handleDownloadFile(request.rejectionFile!)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#DC2626' }} />
                          <div className="flex-1 text-left">
                            <p className="text-sm mb-1">{request.rejectionFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.rejectionFile.uploadedBy || '-'}
                              {request.rejectionFile.uploadedDate ? ` on ${formatDate(request.rejectionFile.uploadedDate)}` : ''}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>

                      {request.confirmationFile ? (
                        <Button
                          variant="outline"
                          className="w-full h-auto py-2 px-3"
                          onClick={() => handleDownloadFile(request.confirmationFile!)}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                            <div className="flex-1 text-left">
                              <p className="text-sm mb-1">{request.confirmationFile.name}</p>
                              <p className="text-xs text-gray-500">
                                Uploaded by {request.confirmationFile.uploadedBy || '-'}
                                {request.confirmationFile.uploadedDate ? ` on ${formatDate(request.confirmationFile.uploadedDate)}` : ''}
                              </p>
                            </div>
                            <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                          </div>
                        </Button>
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

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: '#014357' }}>Create Reschedule ETA Request</DialogTitle>
            <DialogDescription>Submit a request to reschedule the ETA for this purchase order.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <Label className="text-sm text-gray-600 mb-2 block">Current ETA</Label>
              <p className="text-lg" style={{ color: '#014357' }}>
                {etaDate ? formatDate(etaDate) : 'Not set'} ({etaDays} days from ETD)
              </p>
            </div>

            <div>
              <Label htmlFor="newETADays">
                New ETA (in days from ETD) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newETADays"
                type="number"
                value={newETADays}
                onChange={(e) => setNewETADays(e.target.value)}
                placeholder="Number of days"
                className="mt-1"
              />
              {calculateNewETADate() && (
                <p className="text-sm text-gray-600 mt-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  New ETA Date: {formatDate(calculateNewETADate()!)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="rescheduleReason">
                Reason for Rescheduling <span className="text-red-500">*</span>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseRescheduleDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReschedule}
              style={{ backgroundColor: '#014357' }}
              className="text-white hover:opacity-90"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}