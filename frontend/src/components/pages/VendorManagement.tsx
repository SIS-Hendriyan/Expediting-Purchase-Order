import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '../ui/pagination';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  UserCheck,
  UserX,
  Star,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { API } from '../../config';
import { getAccessToken } from '../../utils/authSession';

interface Vendor {
  id: string;
  name: string;
  userName: string;
  email: string;
  hasAccess: boolean;
  score: number;
}

interface VendorSummary {
  totalVendors?: number;
  vendorsWithAccess?: number;
  vendorsWithoutAccess?: number;
  averageScore?: number;

  TotalVendors?: number;
  VendorsWithAccess?: number;
  VendorsWithoutAccess?: number;
  AverageScore?: number;

  [key: string]: any;
}

// =============== Shared helpers ===============
const buildAuthHeaders = (): HeadersInit => {
  const local = localStorage.getItem('accessToken');
  const sessionToken = getAccessToken();
  const token = local || sessionToken;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseErrorResponse = async (res: Response): Promise<string> => {
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : {};
    return json.message || json.msg || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
};

export function VendorManagement() {
  // =============== state ===============
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [summary, setSummary] = useState<VendorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessLoadingId, setAccessLoadingId] = useState<string | null>(null);

  // =============== fetch vendors ===============
  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API.LISTVENDOR(), {
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();
      console.log('Fetched vendors:', json);

      // rows vendor
      const rows =
        json.data?.rows ??
        json.Data?.rows ??
        json.data ??
        json.Data ??
        json.vendors ??
        json;

      const list: any[] = Array.isArray(rows)
        ? rows
        : Array.isArray(rows?.vendors)
        ? rows.vendors
        : [];

      const normalized: Vendor[] = list.map((v: any) => ({
        id: String(v.VendorID ?? v.Id ?? v.id ?? ''),
        name: v.VendorName ?? v.Name ?? v.name ?? '',
        userName:
          v.UserName ??
          v.CompleteName ??
          v.userName ??
          v.completeName ??
          '',
        email: v.Email ?? v.email ?? '',
        hasAccess: Boolean(v.IsAccess ?? v.hasAccess ?? false),
        score:
          Number(
            v.Score ??
              v.PerformanceScore ??
              v.performanceScore ??
              0,
          ) || 0,
      }));

      setVendors(normalized);

      // summary/header
      const summaryRaw =
        json.data?.summary ??
        json.Data?.summary ??
        json.summary ??
        null;

      if (summaryRaw && typeof summaryRaw === 'object') {
        setSummary(summaryRaw as VendorSummary);
      } else {
        setSummary(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to load vendors: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============== stats (cards) ===============
  const totalVendors =
    summary?.TotalVendors ??
    summary?.totalVendors ??
    vendors.length;

  const vendorsWithAccess =
    summary?.VendorsWithAccess ??
    summary?.vendorsWithAccess ??
    vendors.filter((v) => v.hasAccess).length;

  const vendorsWithoutAccess =
    summary?.VendorsWithoutAccess ??
    summary?.vendorsWithoutAccess ??
    vendors.filter((v) => !v.hasAccess).length;

  const averageScore =
    summary?.AverageScore ??
    summary?.averageScore ??
    (vendors.length > 0
      ? Math.round(
          vendors.reduce((sum, v) => sum + (v.score || 0), 0) /
            vendors.length,
        )
      : 0);

  // =============== filter & pagination ===============
  const filteredVendors = vendors.filter((vendor) =>
    [vendor.name, vendor.userName, vendor.email]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // =============== toggle access (API + refresh) ===============
  const toggleAccess = async (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) {
      toast.error('Vendor not found');
      return;
    }

    const newAccessState = !vendor.hasAccess;
    setAccessLoadingId(vendorId);

    try {
      const res = await fetch(API.ACCESSVENDOR(vendorId), {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          IsAccess: newAccessState,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();
      const msg =
        json.message ||
        json.msg ||
        `Access ${newAccessState ? 'granted' : 'revoked'} for ${vendor.name}`;

      toast.success(msg);

      // refresh list + summary
      await fetchVendors();
    } catch (err: any) {
      console.error(err);
      toast.error(
        `Failed to update access for ${vendor.name}: ${
          err.message || err
        }`,
      );
    } finally {
      setAccessLoadingId(null);
    }
  };

  // =============== render ===============
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2" style={{ color: '#014357' }}>
          Vendor Management
        </h1>
        <p className="text-gray-600">
          Manage and track all vendor relationships
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(1, 67, 87, 0.1)' }}
            >
              <Users className="h-4 w-4" style={{ color: '#014357' }} />
            </div>
            <div className="text-gray-600 text-sm">Total Vendors</div>
          </div>
          <div className="text-3xl" style={{ color: '#014357' }}>
            {isLoading ? '...' : totalVendors}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(0, 131, 131, 0.1)' }}
            >
              <UserCheck className="h-4 w-4" style={{ color: '#008383' }} />
            </div>
            <div className="text-gray-600 text-sm">
              Vendor with Access
            </div>
          </div>
          <div className="text-3xl" style={{ color: '#008383' }}>
            {vendorsWithAccess}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(237, 131, 45, 0.1)' }}
            >
              <UserX className="h-4 w-4" style={{ color: '#ED832D' }} />
            </div>
            <div className="text-gray-600 text-sm">
              Vendor without Access
            </div>
          </div>
          <div className="text-3xl" style={{ color: '#ED832D' }}>
            {vendorsWithoutAccess}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(106, 167, 93, 0.1)' }}
            >
              <Star className="h-4 w-4" style={{ color: '#6AA75D' }} />
            </div>
            <div className="text-gray-600 text-sm">Average Score</div>
          </div>
          <div className="text-3xl" style={{ color: '#6AA75D' }}>
            {averageScore}%
          </div>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>User Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Access Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>{vendor.name}</TableCell>
                  <TableCell>{vendor.userName}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {vendor.email}
                  </TableCell>
                  <TableCell>
                    {vendor.hasAccess ? (
                      <div className="flex items-center gap-1.5">
                        <Award
                          className="h-4 w-4"
                          style={{ color: '#6AA75D' }}
                        />
                        <span>{vendor.score}%</span>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vendor.hasAccess ? 'default' : 'secondary'}
                      className="px-3 py-1 min-w-[100px] justify-center"
                      style={
                        vendor.hasAccess
                          ? { backgroundColor: '#008383' }
                          : { backgroundColor: '#ED832D' }
                      }
                    >
                      {vendor.hasAccess ? 'Has Access' : 'No Access'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[100px]"
                          style={
                            vendor.hasAccess
                              ? { borderColor: '#dc2626', color: '#dc2626' }
                              : { borderColor: '#008383', color: '#008383' }
                          }
                          disabled={accessLoadingId === vendor.id}
                        >
                          {vendor.hasAccess ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Revoke
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              Grant
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {vendor.hasAccess
                              ? 'Revoke Access'
                              : 'Grant Access'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {vendor.hasAccess ? (
                              <>
                                Are you sure you want to revoke access for{' '}
                                <strong>{vendor.name}</strong>? They will no
                                longer be able to access the procurement
                                system.
                              </>
                            ) : (
                              <>
                                Are you sure you want to grant access to{' '}
                                <strong>{vendor.name}</strong>? They will be
                                able to access the procurement system and view
                                relevant information.
                              </>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => toggleAccess(vendor.id)}
                            style={
                              vendor.hasAccess
                                ? { backgroundColor: '#dc2626' }
                                : { backgroundColor: '#008383' }
                            }
                            disabled={accessLoadingId === vendor.id}
                          >
                            {vendor.hasAccess
                              ? 'Revoke Access'
                              : 'Grant Access'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && paginatedVendors.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    No vendors found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredVendors.length > 0 && (
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
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className={
                      currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
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
                  } else if (
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
                      setCurrentPage((prev) =>
                        Math.min(totalPages, prev + 1),
                      )
                    }
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {startIndex + 1} to{' '}
              {Math.min(endIndex, filteredVendors.length)} of{' '}
              {filteredVendors.length} results
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
