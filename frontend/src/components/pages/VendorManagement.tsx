import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getAccessToken, redirectToLoginExpired } from '../../utils/authSession';

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

const getAuthToken = (): string => {
  const localToken = localStorage.getItem('accessToken');
  const sessionToken = getAccessToken();
  return localToken || sessionToken || '';
};

const buildAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init);

  if (response.status === 401) {
    redirectToLoginExpired();
    throw new Error('Session expired');
  }

  return response;
};

const parseErrorResponse = async (response: Response): Promise<string> => {
  const text = await response.text();

  try {
    const json = text ? JSON.parse(text) : {};
    return json.message || json.msg || json.Message || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
};

const isValidVendorId = (value: string): boolean =>
  typeof value === 'string' && value.trim() !== '';

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes' ||
      normalized === 'y'
    );
  }

  return false;
};

const normalizeVendor = (raw: any): Vendor => {
  console.log('RAW IsAccess:', raw?.IsAccess, 'RAW hasAccess:', raw?.hasAccess, 'RAW row:', raw);

  const id = String(raw?.VendorID ?? raw?.Id ?? raw?.id ?? '').trim();

  return {
    id,
    name: String(raw?.VendorName ?? raw?.Name ?? raw?.name ?? '').trim(),
    userName: String(
      raw?.UserName ??
        raw?.CompleteName ??
        raw?.userName ??
        raw?.completeName ??
        '',
    ).trim(),
    email: String(raw?.Email ?? raw?.email ?? '').trim(),
    hasAccess: parseBoolean(raw?.IsAccess ?? raw?.hasAccess),
    score:
      Number(
        raw?.Score ??
          raw?.PerformanceScore ??
          raw?.performanceScore ??
          0,
      ) || 0,
  };
};

const extractVendorRows = (json: any): any[] => {
  const rows =
    json?.data?.rows ??
    json?.Data?.rows ??
    json?.data ??
    json?.Data ??
    json?.vendors ??
    json;

  if (Array.isArray(rows)) {
    return rows;
  }

  if (Array.isArray(rows?.vendors)) {
    return rows.vendors;
  }

  return [];
};

const extractSummary = (json: any): VendorSummary | null => {
  const summaryRaw =
    json?.data?.summary ??
    json?.Data?.summary ??
    json?.summary ??
    null;

  return summaryRaw && typeof summaryRaw === 'object'
    ? (summaryRaw as VendorSummary)
    : null;
};

const getPaginationItems = (currentPage: number, totalPages: number) => {
  const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const shouldShow =
      page === 1 ||
      page === totalPages ||
      (page >= currentPage - 1 && page <= currentPage + 1);

    if (shouldShow) {
      items.push(page);
      continue;
    }

    if (page === currentPage - 2) {
      items.push('ellipsis-left');
      continue;
    }

    if (page === currentPage + 2) {
      items.push('ellipsis-right');
    }
  }

  return items;
};

export function VendorManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [summary, setSummary] = useState<VendorSummary | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [accessLoadingId, setAccessLoadingId] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetchWithAuth(API.LISTVENDOR(), {
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      const json = await response.json();
      console.log('Fetched vendors:', json);

      const rawList = extractVendorRows(json);
      const normalizedVendors = rawList.map((item) => {
        const mapped = normalizeVendor(item);
        console.log('Mapped vendor:', mapped, 'Raw vendor:', item);
        return mapped;
      });

      setVendors(normalizedVendors);
      setSummary(extractSummary(json));
    } catch (error: any) {
      if (error?.message !== 'Session expired') {
        console.error(error);
        toast.error(`Failed to load vendors: ${error.message || error}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const totalVendors = useMemo(() => {
    return summary?.TotalVendors ?? summary?.totalVendors ?? vendors.length;
  }, [summary, vendors]);

  const vendorsWithAccess = useMemo(() => {
    return (
      summary?.VendorsWithAccess ??
      summary?.vendorsWithAccess ??
      vendors.filter((vendor) => vendor.hasAccess).length
    );
  }, [summary, vendors]);

  const vendorsWithoutAccess = useMemo(() => {
    return (
      summary?.VendorsWithoutAccess ??
      summary?.vendorsWithoutAccess ??
      vendors.filter((vendor) => !vendor.hasAccess).length
    );
  }, [summary, vendors]);

  const averageScore = useMemo(() => {
    return (
      summary?.AverageScore ??
      summary?.averageScore ??
      (vendors.length > 0
        ? Math.round(
            vendors.reduce((sum, vendor) => sum + (vendor.score || 0), 0) /
              vendors.length,
          )
        : 0)
    );
  }, [summary, vendors]);

  const filteredVendors = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return vendors;
    }

    return vendors.filter((vendor) =>
      [vendor.name, vendor.userName, vendor.email]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [vendors, searchQuery]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredVendors.length / itemsPerPage));
  }, [filteredVendors.length, itemsPerPage]);

  const safeCurrentPage = useMemo(() => {
    return Math.min(currentPage, totalPages);
  }, [currentPage, totalPages]);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedVendors = useMemo(() => {
    return filteredVendors.slice(startIndex, endIndex);
  }, [filteredVendors, startIndex, endIndex]);

  const paginationItems = useMemo(() => {
    return getPaginationItems(safeCurrentPage, totalPages);
  }, [safeCurrentPage, totalPages]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleItemsPerPageChange = useCallback((value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  }, []);

  const toggleAccess = useCallback(
    async (vendor: Vendor) => {
      const normalizedVendorId = String(vendor.id ?? '').trim();

      if (!isValidVendorId(normalizedVendorId)) {
        console.error('Invalid vendorId:', normalizedVendorId, 'Vendor:', vendor);
        toast.error(`Invalid vendor id: ${normalizedVendorId || '(empty)'}`);
        return;
      }

      const newAccessState = !vendor.hasAccess;
      const requestUrl = API.ACCESSVENDOR(normalizedVendorId);

      setAccessLoadingId(normalizedVendorId);

      try {
        console.log('CLICKED VENDOR:', vendor);
        console.log('ACCESS URL:', requestUrl);
        console.log('vendorId:', normalizedVendorId);
        console.log('vendor.hasAccess:', vendor.hasAccess);
        console.log('newAccessState:', newAccessState);
        console.log('payload:', { IsAccess: newAccessState });

        const response = await fetchWithAuth(requestUrl, {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            IsAccess: newAccessState,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseErrorResponse(response));
        }

        const json = await response.json();
        const message =
          json?.message ||
          json?.msg ||
          json?.Message ||
          `Access ${newAccessState ? 'granted' : 'revoked'} for ${vendor.name}`;

        toast.success(message);
        await fetchVendors();
      } catch (error: any) {
        if (error?.message !== 'Session expired') {
          console.error(error);
          toast.error(
            `Failed to update access for ${vendor.name}: ${
              error.message || error
            }`,
          );
        }
      } finally {
        setAccessLoadingId(null);
      }
    },
    [fetchVendors],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2" style={{ color: '#014357' }}>
          Vendor Management
        </h1>
        <p className="text-gray-600">Manage and track all vendor relationships</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

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
            <div className="text-gray-600 text-sm">Vendor with Access</div>
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
            <div className="text-gray-600 text-sm">Vendor without Access</div>
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
                <TableRow key={`${vendor.id}-${vendor.email}`}>
                  <TableCell>{vendor.name || '-'}</TableCell>
                  <TableCell>{vendor.userName || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {vendor.email || '-'}
                  </TableCell>

                  <TableCell>
                    {vendor.hasAccess ? (
                      <div className="flex items-center gap-1.5">
                        <Award className="h-4 w-4" style={{ color: '#6AA75D' }} />
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
                            {vendor.hasAccess ? 'Revoke Access' : 'Grant Access'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {vendor.hasAccess ? (
                              <>
                                Are you sure you want to revoke access for{' '}
                                <strong>{vendor.name}</strong>? They will no longer
                                be able to access the procurement system.
                              </>
                            ) : (
                              <>
                                Are you sure you want to grant access to{' '}
                                <strong>{vendor.name}</strong>? They will be able
                                to access the procurement system and view relevant
                                information.
                              </>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => toggleAccess(vendor)}
                            style={
                              vendor.hasAccess
                                ? { backgroundColor: '#dc2626' }
                                : { backgroundColor: '#008383' }
                            }
                            disabled={accessLoadingId === vendor.id}
                          >
                            {vendor.hasAccess ? 'Revoke Access' : 'Grant Access'}
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

              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    Loading vendors...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filteredVendors.length > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t gap-4 flex-wrap">
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
                      safeCurrentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {paginationItems.map((item) => {
                  if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                    return <PaginationEllipsis key={item} />;
                  }

                  return (
                    <PaginationItem key={item}>
                      <PaginationLink
                        onClick={() => setCurrentPage(item)}
                        isActive={safeCurrentPage === item}
                        className="cursor-pointer"
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className={
                      safeCurrentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {filteredVendors.length === 0 ? 0 : startIndex + 1} to{' '}
              {Math.min(endIndex, filteredVendors.length)} of{' '}
              {filteredVendors.length} results
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}