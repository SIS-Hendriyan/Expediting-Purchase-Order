import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Package,
  PackageCheck,
  PackageOpen,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

import { API } from '../../config';
import { getAccessToken } from '../../utils/authSession';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { Card } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Textarea } from '../ui/textarea';
import type { User } from './Login';

// ===================== Types =====================
interface PurchaseOrderDetailProps {
  user: User;
  orderId: string;
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
  ['ID PO Item']?: string | null;
  IDPOItem?: string | null;
  IdPoItem?: string | null;
};

type ReEtaFile = {
  name: string;
  uploadedBy?: string | null;
  uploadedDate?: string | null;
  url?: string | null;
};

type ApiReEtaFiles = {
  approvalFile?: any | null;
  rejectionFile?: any | null;
  confirmationFile?: any | null;
  name?: string | null;
  uploadedBy?: string | null;
  uploadedDate?: string | null;
  url?: string | null;
  Name?: string | null;
  UploadedBy?: string | null;
  UploadedDate?: string | null;
  Url?: string | null;
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

type PoDetail = {
  POID?: string | null;
  ['ID PO Item']?: string | null;
  IDPOItem?: string | null;
  IdPoItem?: string | null;
  idPoItem?: string | null;
  POIDItem?: string | null;
  POItemID?: string | null;

  ['Purchasing Document']?: string | null;
  ['Purchase Requisition']?: string | null;
  Item?: string | null;
  Material?: string | null;
  ['Document Date']?: string | null;
  ['Delivery date']?: string | null;
  ['Purchasing Doc. Type']?: string | null;
  ['Purchasing Group']?: string | null;
  MaterialDescription?: string | null;
  VendorName?: string | null;
  ['Quantity Received']?: string | number | null;
  StillToBeDeliveredQty?: string | number | null;
  Plant?: string | null;
  ['Storage location']?: string | null;
  ['Changed On']?: string | null;
  ['Created By']?: string | null;
  ['GR Created Date']?: string | null;

  CurrentETD?: string | null;
  CurrentETADays?: string | number | null;
  CurrentEta?: string | null;

  ETD?: string | null;
  ETA?: string | null;
  ['WIP Remark']?: string | null;
  WIPRemark?: string | null;
  AWB?: string | null;
  ['Delivery Update']?: string | null;
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
};


// ===================== Constants =====================
const FLOW_ORDER: FlowStatus[] = [
  'PO Submitted',
  'Work in Progress',
  'On Delivery',
  'Partially Received',
  'Fully Received',
];

const STATUS_LINE_TOP = 24;

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

// ===================== Helpers =====================
const trim = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

const parseServerDate = (value?: string | number | null): Date | undefined => {
  const s = trim(value);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const safeDateOnly = (v: unknown): string | null => {
  const d = parseServerDate(v as any);
  if (!d) return null;
  return d.toISOString().split('T')[0];
};

const toIsoString = (v?: string | null): string | null => {
  const d = parseServerDate(v);
  return d ? d.toISOString() : null;
};

const toIsoDateTime = (v?: Date | null): string | null => {
  if (!v || Number.isNaN(v.getTime())) return null;
  return v.toISOString();
};

const formatDate = (dateString: string): string => {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
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

const normalizeRescheduleStatus = (raw: unknown): 'Pending' | 'Approved' | 'Rejected' | string => {
  const s = trim(raw);
  if (!s) return 'Pending';

  const u = s.toUpperCase();
  if (u === 'PENDING') return 'Pending';
  if (u === 'APPROVED') return 'Approved';
  if (u === 'REJECTED') return 'Rejected';

  return s;
};

const safeId = (v: unknown, fallback: string) => {
  const s = trim(v);
  return s || fallback;
};

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
  const newETA = safeDateOnly(
    r?.NewETA ?? r?.newETA ?? r?.NewEta ?? r?.NewEtaDate ?? r?.NewReEtaDate ?? r?.ReEtaDate,
  );

  const requestDate = safeDateOnly(
    r?.RequestedAt ?? r?.requestDate ?? r?.RequestDate ?? r?.CreatedAt ?? r?.CREATED_AT,
  );

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

const extractIdPoItem = (detail: PoDetail | null, flowRows: ApiStatusFlowRow[]): string => {
  const fromDetail = trim(
    detail?.['ID PO Item'] ??
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
      trim(r?.['ID PO Item']) ||
      trim(r?.IDPOItem) ||
      trim(r?.IdPoItem) ||
      (trim(r?.['Purchasing Document']) && trim(r?.Item)),
  );

  const direct = trim(fromFlow?.['ID PO Item'] ?? fromFlow?.IDPOItem ?? fromFlow?.IdPoItem);
  if (direct) return direct;

  const purchasingDocument = trim(fromFlow?.['Purchasing Document']);
  const item = trim(fromFlow?.Item);

  if (purchasingDocument && item) return `${purchasingDocument}-${item}`;
  return '';
};

const diffDaysFromNow = (date: Date): number => {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
};

const buildStatusHistory = (rows: ApiStatusFlowRow[]): Record<string, string> => {
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

  return mapFlowStatus(lastValidStatusRow?.Status) || 'PO Submitted';
};

const getInitialServerEtd = (detail: PoDetail | null, rows: ApiStatusFlowRow[]): Date | undefined => {
  return (
    parseServerDate(detail?.CurrentETD ?? detail?.ETD) ??
    parseServerDate(rows.find((r) => mapFlowStatus(r.Status) === 'PO Submitted')?.StatusAt ?? undefined)
  );
};

const getInitialServerEtaDays = (detail: PoDetail | null, serverEtd?: Date): string => {
  const currentEtaDays = trim(detail?.CurrentETADays);
  if (currentEtaDays) return currentEtaDays;

  const serverCurrentEta = parseServerDate(detail?.CurrentEta ?? detail?.ETA);
  if (serverEtd && serverCurrentEta) {
    const diffMs = serverCurrentEta.getTime() - serverEtd.getTime();
    const diff = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diff > 0) return String(diff);
  }

  return '';
};

const resolveStatusCardData = (poDetail: PoDetail | null): StatusCardData => {
  const etd = parseServerDate(poDetail?.CurrentETD) ?? null;
  const etaDate = parseServerDate(poDetail?.CurrentEta) ?? null;
  const etaDays = trim(poDetail?.CurrentETADays);
  const remarks = trim(poDetail?.['WIP Remark'] ?? poDetail?.WIPRemark) || '-';

  return {
    etd,
    etaDate,
    etaDays,
    remarks,
  };
};

// ===================== UI =====================
type StatusFlowHistoryProps = {
  status: FlowStatus;
  statusHistory: Record<string, string>;
};

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

  const progressWidth = lastDoneIndex <= 0 ? '0%' : `calc(${lastDoneIndex * stepPct}% )`;
  const progressColor = lastDoneIndex <= 0 ? '#f3f3f4' : '#014357';

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

        <div className="relative flex items-start justify-between gap-2" style={{ zIndex: 2 }}>
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
                      backgroundColor: active ? color : '#E5E7EB',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <p className="mb-1 px-1 text-center text-xs" style={{ color: '#014357' }}>
                    {statusName}
                  </p>

                  {active && ts && <p className="text-center text-xs text-gray-500">{formatDateTime(ts)}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <span className="sr-only">{status}</span>
      </div>
    </Card>
  );
}type StatusRelatedInformationProps = {
  status: FlowStatus;
  poDetail: PoDetail | null;
};

function StatusRelatedInformation({
  status,
  poDetail,
}: StatusRelatedInformationProps) {
  const { etd, etaDate, etaDays, remarks } = useMemo(
    () => resolveStatusCardData(poDetail),
    [poDetail],
  );

  const topStatus: FlowStatus =
    status === 'On Delivery' ? 'Work in Progress' : status;

  const topStatusColor = getStatusColor(topStatus);
  const onDeliveryColor = getStatusColor('On Delivery');

  const TopIcon = getStatusIcon(topStatus);
  const OnDeliveryIcon = getStatusIcon('On Delivery');

  const awb = trim(poDetail?.AWB) || '-';

  return (
    <Card className="rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold" style={{ color: '#014357' }}>
        Status-Related Information
      </h2>

      <div className=" flex items-center gap-3">
        <TopIcon className="h-5 w-5" style={{ color: topStatusColor }} />
        <h3 className="text-[20px] " style={{ color: topStatusColor }}>
          {topStatus}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label className="block text-sm text-gray-500">
            ETD (Estimated Date of Delivery)
          </Label>
          <p className="text-[18px]  text-black">
            {etd ? format(etd, 'MMM dd, yyyy') : '-'}
          </p>
        </div>

        <div>
          <Label className="block text-sm text-gray-500">ETA</Label>
          <p className="text-[18px]  text-black">
            {etaDate
              ? `${format(etaDate, 'MMM dd, yyyy')}${etaDays ? ` (${etaDays} days)` : ''}`
              : '-'}
          </p>
        </div>

        <div className="md:col-span-2">
          <Label className="block text-sm text-gray-500">Remarks</Label>
          <p className="text-[18px]  text-black">
            {remarks}
          </p>
        </div>
      </div>

      {status === 'On Delivery' && (
        <>
          <hr className="my-6 border-gray-200" />

          <div className="flex items-center gap-2">
            <OnDeliveryIcon className="h-5 w-5" style={{ color: onDeliveryColor }} />
            <h3 className="text-[20px] " style={{ color: onDeliveryColor }}>
              On Delivery
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label className="block text-sm text-gray-500">
                AWB (Air Waybill)
              </Label>
              <p className="text-[18px]  text-black">
                {awb}
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
// ===================== Component =====================
export function PurchaseOrderDetail({ user, orderId, onBack }: PurchaseOrderDetailProps) {
  const [statusFlowRows, setStatusFlowRows] = useState<ApiStatusFlowRow[]>([]);
  const [reEtaRequestsRaw, setReEtaRequestsRaw] = useState<any[]>([]);
  const [poDetail, setPoDetail] = useState<PoDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingPoStatus, setSubmittingPoStatus] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const [status, setStatus] = useState<FlowStatus>('PO Submitted');
  const [remarks, setRemarks] = useState('');
  const [etd, setEtd] = useState<Date | undefined>(undefined);
  const [etaDays, setEtaDays] = useState('');
  const [awb, setAwb] = useState('');
  const [hasFilledUpdate, setHasFilledUpdate] = useState(false);

  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [newETADays, setNewETADays] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(API.DETAILPO(orderId), {
          method: 'GET',
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

          throw new Error(body?.message || body?.Message || `HTTP ${res.status}`);
        }

        const json = (await res.json()) as DetailApiResponse;
        const data = (json?.Data ?? json?.data) as DetailData | undefined;

        const flow = Array.isArray(data?.StatusFlow) ? data.StatusFlow : [];
        const reqs = Array.isArray(data?.ReEtaRequests) ? data.ReEtaRequests : [];
        const detail = (data?.PoDetail ?? data?.Order ?? null) as PoDetail | null;
        console.log(data);
        setStatusFlowRows(flow);
        setReEtaRequestsRaw(reqs);
        setPoDetail(detail);
        setStatus(getLastValidStatus(flow));

        const serverEtd = getInitialServerEtd(detail, flow);
        const serverRemarks = trim(detail?.['WIP Remark'] ?? detail?.WIPRemark);
        const serverAwb = trim(detail?.AWB);
        const serverEtaDays = getInitialServerEtaDays(detail, serverEtd);

        setEtd((prev) => prev ?? serverEtd);
        setRemarks((prev) => prev || serverRemarks);
        setAwb((prev) => prev || serverAwb);
        setEtaDays((prev) => prev || serverEtaDays);
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError';

        setStatusFlowRows([]);
        setReEtaRequestsRaw([]);
        setPoDetail(null);

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

  const statusHistory = useMemo(() => buildStatusHistory(statusFlowRows), [statusFlowRows]);

  const idPoItem = useMemo(() => extractIdPoItem(poDetail, statusFlowRows), [poDetail, statusFlowRows]);

  const calculatedEtaDate = useMemo(() => {
    const days = parseInt(etaDays, 10);
    if (!etd || !etaDays || Number.isNaN(days) || days <= 0) return null;
    return new Date(etd.getTime() + days * 24 * 60 * 60 * 1000);
  }, [etd, etaDays]);

  const currentEtaFromPoDetail = useMemo(() => {
    return safeDateOnly(poDetail?.CurrentEta ?? poDetail?.ETA);
  }, [poDetail]);

  const etaDate = useMemo(() => {
    return calculatedEtaDate ? format(calculatedEtaDate, 'yyyy-MM-dd') : '';
  }, [calculatedEtaDate]);

  const effectiveCurrentEta = useMemo(() => {
    return currentEtaFromPoDetail || etaDate || null;
  }, [currentEtaFromPoDetail, etaDate]);

  const needsVendorUpdate = useMemo(() => {
    const currentEta = parseServerDate(effectiveCurrentEta);
    if (status !== 'On Delivery') return false;
    if (!currentEta) return false;
    return diffDaysFromNow(currentEta) <= 2;
  }, [status, effectiveCurrentEta]);

  const rescheduleRequests = useMemo(() => {
    return reEtaRequestsRaw
      .map((r, i) => normalizeReEtaRequest(r, i))
      .sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }, [reEtaRequestsRaw]);

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

    const days = parseInt(newETADays, 10);
    if (Number.isNaN(days) || days <= 0) return null;

    const next = new Date(etd.getTime() + days * 24 * 60 * 60 * 1000);
    return Number.isNaN(next.getTime()) ? null : next.toISOString().split('T')[0];
  }, [etd, newETADays]);

  const submitPoStatusUpdate = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(API.POSTATUS_UPSERT(), {
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
      throw new Error(data?.message || data?.Message || data?.title || 'Failed to update PO status');
    }

    return data;
  }, []);

  const submitReEtaCreate = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(API.REETA_CREATE(), {
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
      throw new Error(data?.message || data?.Message || data?.title || 'Failed to create reschedule ETA request');
    }

    return data;
  }, []);

  const handleSubmitOrderInformation = useCallback(async () => {
    try {
      if (!idPoItem) {
        toast.error('ID PO Item not found');
        return;
      }

      if (!etd) {
        toast.error('Please select an ETD date');
        return;
      }

      const days = parseInt(etaDays, 10);
      if (!etaDays || Number.isNaN(days) || days <= 0) {
        toast.error('Please enter a valid ETA in days');
        return;
      }

      if (!remarks.trim()) {
        toast.error('Please enter remarks');
        return;
      }

      setSubmittingPoStatus(true);

      await submitPoStatusUpdate({
        IDPOItem: idPoItem,
        ETD: toIsoDateTime(etd),
        ETA: days,
        WIPRemark: remarks.trim(),
      });

      toast.success('Order information updated successfully');
      setHasFilledUpdate(true);
      await fetchDetail();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update order information');
    } finally {
      setSubmittingPoStatus(false);
    }
  }, [idPoItem, etd, etaDays, remarks, submitPoStatusUpdate, fetchDetail]);

  const handleSubmitAwb = useCallback(async () => {
    try {
      if (!idPoItem) {
        toast.error('ID PO Item not found');
        return;
      }

      if (!awb.trim()) {
        toast.error('Please enter AWB number');
        return;
      }

      setSubmittingPoStatus(true);

      await submitPoStatusUpdate({
        IDPOItem: idPoItem,
        AWB: awb.trim(),
      });

      toast.success('AWB information updated successfully');
      setHasFilledUpdate(true);
      await fetchDetail();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update AWB information');
    } finally {
      setSubmittingPoStatus(false);
    }
  }, [idPoItem, awb, submitPoStatusUpdate, fetchDetail]);

  const handleSubmitReschedule = useCallback(async () => {
    try {
      if (!idPoItem) {
        toast.error('ID PO Item not found');
        return;
      }

      if (!effectiveCurrentEta) {
        toast.error('Current ETA is not set');
        return;
      }

      const newDays = parseInt(newETADays, 10);
      const curDays = parseInt(etaDays, 10);

      if (!newETADays || Number.isNaN(newDays) || newDays <= 0) {
        toast.error('Please enter a valid new ETA in days');
        return;
      }

      if (!Number.isNaN(curDays) && curDays > 0 && newDays <= curDays) {
        toast.error('New ETA days must be greater than current ETA days');
        return;
      }

      if (!rescheduleReason.trim()) {
        toast.error('Please provide a reason for rescheduling');
        return;
      }

      setSubmittingReschedule(true);

      await submitReEtaCreate({
        CurrentEta: effectiveCurrentEta,
        IdPoItem: idPoItem,
        ProposedETADays: newDays,
        Reason: rescheduleReason.trim(),
      });

      toast.success('Reschedule request submitted successfully');
      handleCloseRescheduleDialog();
      await fetchDetail();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit reschedule request');
    } finally {
      setSubmittingReschedule(false);
    }
  }, [
    idPoItem,
    effectiveCurrentEta,
    newETADays,
    etaDays,
    rescheduleReason,
    submitReEtaCreate,
    handleCloseRescheduleDialog,
    fetchDetail,
  ]);

  const handleDownloadFile = useCallback((file: ReEtaFile) => {
    if (file.url) {
      window.open(file.url, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.success(`Downloading ${file.name}...`);
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Purchase Orders
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2" style={{ color: '#014357' }}>
              Purchase Order Details
            </h1>
            <p className="text-gray-600">PO #{poDetail?.['Purchasing Document'] || orderId}</p>
            {loading && <p className="mt-1 text-xs text-gray-500">Loading detail...</p>}
            {loadError && <p className="mt-1 text-xs text-red-600">{loadError}</p>}
          </div>

          <Badge
            className="px-4 py-2 text-base"
            style={{ backgroundColor: getStatusColor(status), color: 'white' }}
          >
            {status}
          </Badge>
        </div>
      </div>

      {user.role === 'vendor' && needsVendorUpdate && !hasFilledUpdate && (
        <Alert
          className="mb-6"
          style={{ borderColor: '#ED832D', backgroundColor: 'rgba(237, 131, 45, 0.1)' }}
        >
          <AlertCircle className="h-4 w-4" style={{ color: '#ED832D' }} />
          <AlertDescription>
            This order&apos;s ETA is in 2 days or less. Please provide an update on the delivery status.
          </AlertDescription>
        </Alert>
      )}

      {canCreateReschedule(user.role, status) && (
        <Button className="mb-6" style={{ backgroundColor: '#014357' }} onClick={handleOpenRescheduleDialog}>
          <Calendar className="mr-2 h-4 w-4" />
          Create Reschedule ETA Request
        </Button>
      )}

      <div className="space-y-6">
        <StatusFlowHistory status={status} statusHistory={statusHistory} />

       {status !== 'PO Submitted' && (
  <StatusRelatedInformation status={status} poDetail={poDetail} />
)}

        {user.role === 'vendor' && (
          <>
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
                        <Button variant="outline" className="mt-1 w-full justify-start text-left" type="button">
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
                      min={1}
                      value={etaDays}
                      onChange={(e) => setEtaDays(e.target.value)}
                      placeholder="Number of days"
                      className="mt-1"
                    />

                    {calculatedEtaDate && (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm text-gray-600">ETA Date:</p>
                        <p className="text-lg" style={{ color: '#014357' }}>
                          {format(calculatedEtaDate, 'PPP')}
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
                    disabled={submittingPoStatus}
                    onClick={handleSubmitOrderInformation}
                  >
                    {submittingPoStatus ? 'Submitting...' : 'Submit Information'}
                  </Button>
                </div>
              </Card>
            )}

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
                    disabled={submittingPoStatus}
                    onClick={handleSubmitAwb}
                  >
                    {submittingPoStatus ? 'Submitting...' : 'Submit AWB'}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {rescheduleRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-5 font-medium" style={{ color: '#014357' }}>
              Re-schedule ETA History
            </h2>

            <div className="space-y-4">
              {rescheduleRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <p style={{ color: '#014357' }}>{request.id}</p>
                        <Badge
                          style={{
                            backgroundColor: getRescheduleStatusColor(request.status),
                            color: 'white',
                          }}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">Requested by: {request.requestedBy}</p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {request.requestDate ? formatDate(request.requestDate) : '-'}
                    </p>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-4 border-b border-gray-200 pb-3">
                    <div>
                      <Label className="mb-1 block text-xs text-gray-500">Old ETA</Label>
                      <p className="text-sm text-gray-900">{request.oldETA ? formatDate(request.oldETA) : '-'}</p>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-gray-500">New ETA</Label>
                      <p className="text-sm text-gray-900">{request.newETA ? formatDate(request.newETA) : '-'}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label className="mb-1 block text-xs text-gray-500">Reason</Label>
                    <p className="text-sm text-gray-700">{request.reason}</p>
                  </div>

                  {request.status === 'Approved' && request.approvalFile && (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
                      <Button
                        variant="outline"
                        className="h-auto w-full px-3 py-2"
                        onClick={() => handleDownloadFile(request.approvalFile!)}
                      >
                        <div className="flex w-full items-center gap-3">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                          <div className="flex-1 text-left">
                            <p className="mb-1 text-sm">{request.approvalFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.approvalFile.uploadedBy || '-'}
                              {request.approvalFile.uploadedDate
                                ? ` on ${formatDate(request.approvalFile.uploadedDate)}`
                                : ''}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>
                      <div />
                    </div>
                  )}

                  {request.status === 'Rejected' && request.rejectionFile && (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
                      <Button
                        variant="outline"
                        className="h-auto w-full px-3 py-2"
                        onClick={() => handleDownloadFile(request.rejectionFile!)}
                      >
                        <div className="flex w-full items-center gap-3">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#DC2626' }} />
                          <div className="flex-1 text-left">
                            <p className="mb-1 text-sm">{request.rejectionFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.rejectionFile.uploadedBy || '-'}
                              {request.rejectionFile.uploadedDate
                                ? ` on ${formatDate(request.rejectionFile.uploadedDate)}`
                                : ''}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>

                      {request.confirmationFile ? (
                        <Button
                          variant="outline"
                          className="h-auto w-full px-3 py-2"
                          onClick={() => handleDownloadFile(request.confirmationFile!)}
                        >
                          <div className="flex w-full items-center gap-3">
                            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                            <div className="flex-1 text-left">
                              <p className="mb-1 text-sm">{request.confirmationFile.name}</p>
                              <p className="text-xs text-gray-500">
                                Uploaded by {request.confirmationFile.uploadedBy || '-'}
                                {request.confirmationFile.uploadedDate
                                  ? ` on ${formatDate(request.confirmationFile.uploadedDate)}`
                                  : ''}
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

      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: '#014357' }}>Create Reschedule ETA Request</DialogTitle>
            <DialogDescription>
              Submit a request to reschedule the ETA for this purchase order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Label className="mb-2 block text-sm text-gray-600">Current ETA</Label>
              <p className="text-lg" style={{ color: '#014357' }}>
                {effectiveCurrentEta ? formatDate(effectiveCurrentEta) : 'Not set'}
                {etaDays ? ` (${etaDays} days from ETD)` : ''}
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
                <p className="mt-2 text-sm text-gray-600">
                  <Calendar className="mr-1 inline h-4 w-4" />
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
            <Button variant="outline" onClick={handleCloseRescheduleDialog} disabled={submittingReschedule}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReschedule}
              style={{ backgroundColor: '#014357' }}
              className="text-white hover:opacity-90"
              disabled={submittingReschedule}
            >
              {submittingReschedule ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}