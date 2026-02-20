// src/components/pages/PurchaseOrderDetail.tsx
import { useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ArrowLeft, Calendar, AlertCircle, Package, Truck, PackageCheck, PackageOpen, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from './Login';
import { Alert, AlertDescription } from '../ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format } from 'date-fns';

interface PurchaseOrderDetailProps {
  user: User;
  orderId: string;
  onBack: () => void;
}

// mock status history
const statusHistory: Record<string, string> = {
  'PO Submitted': '2024-01-15 09:30',
  'Work in Progress': '2024-01-16 14:15',
  'On Delivery': '2024-01-18 10:45',
  'Partially Received': '2024-01-20 16:20',
  'Fully Received': '2024-01-22 11:00'
};

const STATUSES = ['PO Submitted', 'Work in Progress', 'On Delivery', 'Partially Received', 'Fully Received'] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PO Submitted': return '#ED832D';
    case 'Work in Progress': return '#5C8CB6';
    case 'On Delivery': return '#008383';
    case 'Partially Received': return '#F59E0B';
    case 'Fully Received': return '#6AA75D';
    default: return '#014357';
  }
};

const getStatusIcon = (statusName: string) => {
  switch (statusName) {
    case 'PO Submitted': return FileText;
    case 'Work in Progress': return Package;
    case 'On Delivery': return Truck;
    case 'Partially Received': return PackageOpen;
    case 'Fully Received': return PackageCheck;
    default: return FileText;
  }
};

const formatDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

export function PurchaseOrderDetail({ user, orderId, onBack }: PurchaseOrderDetailProps) {
  // UI state
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('PO Submitted');

  // Vendor input
  const [remarks, setRemarks] = useState('');
  const [etd, setEtd] = useState<Date | undefined>(undefined);
  const [etaDays, setEtaDays] = useState('');
  const [awb, setAwb] = useState('');

  const [hasFilledUpdate] = useState(false); // placeholder for real data
  const [vendorUpdateRemarks] = useState(''); // placeholder
  const [vendorUpdateDate] = useState('2024-01-28 15:30'); // placeholder

  // Reschedule dialog
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [newETADays, setNewETADays] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // mock reschedule
  const rescheduleRequests = useMemo(() => ([
    {
      id: 'RSR-001',
      requestDate: '2024-01-20',
      requestedBy: 'PT Global Supply',
      oldETA: '2024-02-05',
      newETA: '2024-02-15',
      reason: 'Delay in raw material shipment from overseas supplier. Expected to receive materials by end of next week.',
      status: 'Approved',
      responseDate: '2024-01-21',
      approvalFile: {
        name: 'Approval_Letter_RSR-001.pdf',
        uploadedBy: 'Admin',
        uploadedDate: '2024-01-21'
      }
    },
    {
      id: 'RSR-003',
      requestDate: '2024-01-28',
      requestedBy: 'PT Global Supply',
      oldETA: '2024-02-20',
      newETA: '2024-02-28',
      reason: 'Unexpected machinery breakdown requiring replacement parts.',
      status: 'Rejected',
      responseDate: '2024-01-29',
      rejectionFile: {
        name: 'Rejection_Letter_RSR-003.pdf',
        uploadedBy: 'Admin',
        uploadedDate: '2024-01-29'
      },
      confirmationFile: {
        name: 'Vendor_Confirmation_RSR-003.pdf',
        uploadedBy: 'PT Global Supply',
        uploadedDate: '2024-01-30'
      }
    }
  ]), []);

  // mock order data
  const orderData = useMemo(() => ({
    purchaseRequisition: '10007891',
    itemOfRequisition: '00010',
    purchasingDocument: orderId,
    item: '00010',
    documentDate: '2024-01-15',
    deliveryDate: '2024-02-01',
    purchasingDocType: 'Standard PO',
    purchasingGroup: 'Mining Equipment',
    shortText: 'Hydraulic Excavator Parts',
    material: 'MAT-001234',
    nameOfSupplier: 'PT Global Supply',
    quantityReceived: '50',
    stillToBeDelivered: '150',
    plant: 'ADMO Mining',
    storageLocation: 'Warehouse A',
    order: 'ORD-2024-001',
    changedOn: '2024-01-16',
    grCreatedDate: '',
    remarks: 'Urgent delivery required',
    reEtaDate: '2024-02-05',
  }), [orderId]);

  const currentIndex = useMemo(() => STATUSES.indexOf(status), [status]);

  const isStatusActive = useMemo(() => {
    return (statusName: (typeof STATUSES)[number]) => STATUSES.indexOf(statusName) <= currentIndex;
  }, [currentIndex]);

  const etaDate = useMemo(() => {
    if (!etd || !etaDays) return '';
    const days = parseInt(etaDays);
    if (Number.isNaN(days) || days <= 0) return '';
    const d = new Date(etd);
    d.setDate(d.getDate() + days);
    return format(d, 'yyyy-MM-dd');
  }, [etd, etaDays]);

  const needsVendorUpdate = useMemo(() => {
    if (status !== 'On Delivery') return false;
    if (!etaDate) return false;

    const today = new Date();
    const eta = new Date(etaDate);
    const diffDays = Math.ceil((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  }, [status, etaDate]);

  const calculateNewETADate = useMemo(() => {
    if (!etd || !newETADays) return null;
    const days = parseInt(newETADays);
    if (Number.isNaN(days) || days <= 0) return null;
    const d = new Date(etd);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }, [etd, newETADays]);

  const handleDownloadFile = (fileName: string) => {
    toast.success(`Downloading ${fileName}...`);
  };

  const handleOpenRescheduleDialog = () => {
    setRescheduleDialogOpen(true);
    setNewETADays('');
    setRescheduleReason('');
  };

  const handleCloseRescheduleDialog = () => {
    setRescheduleDialogOpen(false);
    setNewETADays('');
    setRescheduleReason('');
  };

  const handleSubmitReschedule = () => {
    if (!etd) {
      toast.error('ETD must be set before creating a reschedule request');
      return;
    }
    if (!etaDays) {
      toast.error('Current ETA must be set before creating a reschedule request');
      return;
    }
    if (!newETADays || parseInt(newETADays) <= 0) {
      toast.error('Please enter a valid new ETA in days');
      return;
    }
    if (parseInt(newETADays) <= parseInt(etaDays)) {
      toast.error('New ETA days must be greater than current ETA days');
      return;
    }
    if (!rescheduleReason.trim()) {
      toast.error('Please provide a reason for rescheduling');
      return;
    }

    toast.success('Reschedule request submitted successfully');
    handleCloseRescheduleDialog();
  };

  const getRescheduleStatusColor = (st: string) => {
    switch (st) {
      case 'Pending': return '#ED832D';
      case 'Approved': return '#6AA75D';
      case 'Rejected': return '#DC2626';
      default: return '#014357';
    }
  };

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
            <h1 className="mb-2" style={{ color: '#014357' }}>Purchase Order Details</h1>
            <p className="text-gray-600">PO #{orderData.purchasingDocument}-{orderData.itemOfRequisition}</p>
          </div>
          <Badge className="px-4 py-2 text-base" style={{ backgroundColor: getStatusColor(status), color: 'white' }}>
            {status}
          </Badge>
        </div>
      </div>

      {/* Alert for vendor update needed */}
      {user.role === 'vendor' && needsVendorUpdate && !hasFilledUpdate && (
        <Alert className="mb-6" style={{ borderColor: '#ED832D', backgroundColor: 'rgba(237, 131, 45, 0.1)' }}>
          <AlertCircle className="h-4 w-4" style={{ color: '#ED832D' }} />
          <AlertDescription>
            This order's ETA is in 2 days or less. Please provide an update on the delivery status.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Action */}
      {user.role === 'vendor' && (status === 'Work in Progress' || status === 'On Delivery') && (
        <Button className="mb-6" style={{ backgroundColor: '#014357' }} onClick={handleOpenRescheduleDialog}>
          <Calendar className="h-4 w-4 mr-2" />
          Create Reschedule ETA Request
        </Button>
      )}

      <div className="space-y-6">
        {/* Status Flow History */}
        <Card className="p-6">
          <h2 className="mb-6" style={{ color: '#014357' }}>Status Flow History</h2>

          <div className="relative">
            <div className="flex items-start justify-between gap-2">
              {STATUSES.map((statusName, index) => {
                const Icon = getStatusIcon(statusName);
                const active = isStatusActive(statusName);
                const color = getStatusColor(statusName);

                return (
                  <div key={statusName} className="flex-1 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-2 relative z-10"
                        style={{ backgroundColor: active ? color : '#E5E7EB', transition: 'all 0.3s ease' }}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>

                      <p className="text-xs text-center mb-1 px-1" style={{ color: '#014357' }}>
                        {statusName}
                      </p>

                      {active && statusHistory[statusName] && (
                        <p className="text-xs text-gray-500 text-center">
                          {formatDateTime(statusHistory[statusName])}
                        </p>
                      )}
                    </div>

                    {index < STATUSES.length - 1 && (
                      <div
                        className="absolute top-6 left-1/2 w-full h-1"
                        style={{
                          backgroundColor: isStatusActive(STATUSES[index + 1]) ? '#014357' : '#E5E7EB',
                          transition: 'all 0.3s ease'
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Status-Related Information */}
        {status !== 'PO Submitted' && (
          <Card className="p-6">
            <h2 className="mb-6" style={{ color: '#014357' }}>Status-Related Information</h2>

            <div className="space-y-6">
              {/* Work in Progress */}
              {isStatusActive('Work in Progress') && (
                <div className={isStatusActive('On Delivery') ? 'pb-6 border-b border-gray-200' : ''}>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5" style={{ color: '#5C8CB6' }} />
                    <h3 style={{ color: '#014357' }}>Work in Progress</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500 text-sm mb-1 block">ETD (Estimated Date of Delivery)</Label>
                      <p className="text-gray-900">
                        {etd ? format(etd, 'MMM dd, yyyy') : 'Jan 25, 2024'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-gray-500 text-sm mb-1 block">ETA</Label>
                      <p className="text-gray-900">
                        {etaDate ? format(new Date(etaDate), 'MMM dd, yyyy') : 'Feb 04, 2024'} ({etaDays || '10'} days)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="text-gray-500 text-sm mb-1 block">Remarks</Label>
                    <p className="text-gray-900">{remarks || 'Order confirmed and processing has begun.'}</p>
                  </div>
                </div>
              )}

              {/* On Delivery */}
              {isStatusActive('On Delivery') && (
                <div className={isStatusActive('Partially Received') ? 'pb-6 border-b border-gray-200' : ''}>
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="h-5 w-5" style={{ color: '#008383' }} />
                    <h3 style={{ color: '#014357' }}>On Delivery</h3>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-sm mb-1 block">AWB (Air Waybill)</Label>
                    <p className="text-gray-900 tracking-wide">{awb || 'AWB-2024-001234567'}</p>
                  </div>
                </div>
              )}

              {/* Partially Received */}
              {isStatusActive('Partially Received') && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <PackageOpen className="h-5 w-5" style={{ color: '#F59E0B' }} />
                    <h3 style={{ color: '#014357' }}>Partially Received</h3>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-sm mb-1 block">Still to be Delivered</Label>
                    <p className="text-gray-900">{orderData.stillToBeDelivered} units</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Vendor Input */}
        {user.role === 'vendor' && (
          <>
            {status === 'PO Submitted' && (
              <Card className="p-6">
                <h2 className="mb-4" style={{ color: '#014357' }}>Update Order Information</h2>

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

                      toast.success('Order information updated successfully');
                      setStatus('Work in Progress');
                    }}
                  >
                    Submit Information
                  </Button>
                </div>
              </Card>
            )}

            {status === 'Work in Progress' && (
              <Card className="p-6">
                <h2 className="mb-4" style={{ color: '#014357' }}>Update Delivery Information</h2>
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
                      toast.success('AWB information updated successfully');
                      setStatus('On Delivery');
                    }}
                  >
                    Submit AWB
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Re-schedule ETA History */}
        {rescheduleRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4" style={{ color: '#014357' }}>Re-schedule ETA History</h2>

            <div className="space-y-4">
              {rescheduleRequests.map((request: any) => (
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
                    <p className="text-sm text-gray-500">{formatDate(request.requestDate)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b border-gray-200">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">Old ETA</Label>
                      <p className="text-sm text-gray-900">{formatDate(request.oldETA)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">New ETA</Label>
                      <p className="text-sm text-gray-900">{formatDate(request.newETA)}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label className="text-xs text-gray-500 block mb-1">Reason</Label>
                    <p className="text-sm text-gray-700">{request.reason}</p>
                  </div>

                  {request.status === 'Approved' && request.approvalFile && (
                    <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                      <Button variant="outline" className="w-full h-auto py-2 px-3" onClick={() => handleDownloadFile(request.approvalFile.name)}>
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                          <div className="flex-1 text-left">
                            <p className="text-sm mb-1">{request.approvalFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.approvalFile.uploadedBy} on {formatDate(request.approvalFile.uploadedDate)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>
                    </div>
                  )}

                  {request.status === 'Rejected' && request.rejectionFile && (
                    <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                      <Button variant="outline" className="w-full h-auto py-2 px-3" onClick={() => handleDownloadFile(request.rejectionFile.name)}>
                        <div className="flex items-center gap-3 w-full">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#DC2626' }} />
                          <div className="flex-1 text-left">
                            <p className="text-sm mb-1">{request.rejectionFile.name}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {request.rejectionFile.uploadedBy} on {formatDate(request.rejectionFile.uploadedDate)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                        </div>
                      </Button>

                      {request.confirmationFile && (
                        <Button variant="outline" className="w-full h-auto py-2 px-3" onClick={() => handleDownloadFile(request.confirmationFile.name)}>
                          <div className="flex items-center gap-3 w-full">
                            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                            <div className="flex-1 text-left">
                              <p className="text-sm mb-1">{request.confirmationFile.name}</p>
                              <p className="text-xs text-gray-500">
                                Uploaded by {request.confirmationFile.uploadedBy} on {formatDate(request.confirmationFile.uploadedDate)}
                              </p>
                            </div>
                            <Download className="h-4 w-4 flex-shrink-0" style={{ color: '#014357' }} />
                          </div>
                        </Button>
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
            <DialogDescription>
              Submit a request to reschedule the ETA for this purchase order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <Label className="text-sm text-gray-600 mb-2 block">Current ETA</Label>
              <p className="text-lg" style={{ color: '#014357' }}>
                {etaDate ? formatDate(etaDate) : 'Not set'} ({etaDays || '-'} days from ETD)
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

              {calculateNewETADate && (
                <p className="text-sm text-gray-600 mt-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  New ETA Date: {formatDate(calculateNewETADate)}
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
            <Button onClick={handleSubmitReschedule} style={{ backgroundColor: '#014357' }} className="text-white hover:opacity-90">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}