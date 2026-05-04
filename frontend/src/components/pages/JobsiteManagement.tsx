import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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
} from "../ui/alert-dialog";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../../config";
import {
  getAccessToken,
  redirectToLoginExpired,
} from "../../utils/authSession";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Jobsite {
  ID: number;
  Code: string;
  Name: string;
  CREATED_AT: string;
  CREATED_BY: string;
  UPDATED_AT: string | null;
  UPDATED_BY: string | null;
}

interface JobsiteCreatePayload {
  Code: string;
  Name: string;
}

interface JobsiteUpdatePayload {
  Code: string;
  Name: string;
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────
const buildAuthHeaders = (): HeadersInit => {
  const local = localStorage.getItem("accessToken");
  const sessionToken = getAccessToken();
  const token = local || sessionToken;

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
    return json.message || json.msg || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function JobsiteManagement() {
  // ── list & filter ──────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jobsites, setJobsites] = useState<Jobsite[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ── add dialog ─────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // ── edit dialog ────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJobsite, setEditingJobsite] = useState<Jobsite | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // ── fetch ──────────────────────────────────
  const fetchJobsites = async (
    page: number = currentPage,
    pageSize: number = itemsPerPage,
    keyword: string = searchQuery,
  ) => {
    setIsLoading(true);

    try {
      const url = new URL(API.JOBSITE_LIST());
      url.searchParams.set("pageNumber", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      if (keyword.trim()) {
        url.searchParams.set("search", keyword.trim());
      }

      const res = await fetchWithAuth(url.toString(), {
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();

      // Handle wrapped or direct JobsitePagedResult response
      const result = json.Data ?? json.data ?? json;

      const list: Jobsite[] = Array.isArray(result)
        ? result
        : (result.Items ?? result.items ?? []);
      const total =
        result.TotalRows ?? result.totalRows ?? result.total_rows ?? 0;

      setJobsites(list);
      setTotalRows(typeof total === "number" ? total : 0);
    } catch (err: any) {
      console.error("[fetchJobsites]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to load jobsites: ${err.message || err}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchJobsites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── add ────────────────────────────────────
  const resetAddForm = () => {
    setAddCode("");
    setAddName("");
  };

  const handleAddDialogChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) resetAddForm();
  };

  const createJobsite = async () => {
    if (!addCode.trim()) {
      toast.error("Code is required.");
      return;
    }
    if (!addName.trim()) {
      toast.error("Name is required.");
      return;
    }

    setIsSubmittingAdd(true);

    try {
      const payload: JobsiteCreatePayload = {
        Code: addCode.trim(),
        Name: addName.trim(),
      };

      const res = await fetchWithAuth(API.JOBSITE_CREATE(), {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await fetchJobsites();
      toast.success("Jobsite created successfully.");
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (err: any) {
      console.error("[createJobsite]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to create jobsite: ${err.message || err}`);
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // ── edit ───────────────────────────────────
  const openEditDialog = (jobsite: Jobsite) => {
    setEditingJobsite(jobsite);
    setEditCode(jobsite.Code);
    setEditName(jobsite.Name);
    setIsEditDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditingJobsite(null);
    setEditCode("");
    setEditName("");
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) resetEditForm();
  };

  const updateJobsite = async () => {
    if (!editingJobsite) return;

    if (!editCode.trim()) {
      toast.error("Code is required.");
      return;
    }
    if (!editName.trim()) {
      toast.error("Name is required.");
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const payload: JobsiteUpdatePayload = {
        Code: editCode.trim(),
        Name: editName.trim(),
      };

      const res = await fetchWithAuth(API.JOBSITE_UPDATE(editingJobsite.ID), {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await fetchJobsites();
      toast.success("Jobsite updated successfully.");
      setIsEditDialogOpen(false);
      resetEditForm();
    } catch (err: any) {
      console.error("[updateJobsite]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to update jobsite: ${err.message || err}`);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ── delete ─────────────────────────────────
  const deleteJobsite = async (id: number) => {
    try {
      const res = await fetchWithAuth(API.JOBSITE_DELETE(id), {
        method: "DELETE",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await fetchJobsites(currentPage, itemsPerPage, searchQuery);
      toast.success("Jobsite deleted successfully.");
    } catch (err: any) {
      console.error("[deleteJobsite]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to delete jobsite: ${err.message || err}`);
      }
    }
  };

  // ── server-side pagination ─────────────────
  const totalPages = Math.ceil(totalRows / itemsPerPage) || 1;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    void fetchJobsites(1, itemsPerPage, value);
  };

  const handleItemsPerPageChange = (value: string) => {
    const n = Number(value);
    setItemsPerPage(n);
    setCurrentPage(1);
    void fetchJobsites(1, n, searchQuery);
  };

  useEffect(() => {
    void fetchJobsites(currentPage, itemsPerPage, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  // ── render ─────────────────────────────────
  return (
    <div className="p-8">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1
          className="mb-2 text-2xl font-semibold"
          style={{ color: "#014357" }}
        >
          Jobsite Management
        </h1>
        <p className="text-gray-600">
          Manage master data for jobsites used in purchase order system.
        </p>
      </div>

      {/* ── Summary card ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "rgba(1, 67, 87, 0.1)" }}
            >
              <MapPin className="h-4 w-4" style={{ color: "#014357" }} />
            </div>
            <div className="text-gray-600 text-sm">Total Jobsites</div>
          </div>
          <div className="text-3xl font-semibold" style={{ color: "#014357" }}>
            {isLoading ? "..." : totalRows}
          </div>
        </Card>
      </div>

      {/* ── Toolbar: search + add button ── */}
      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="relative w-96 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by code or name..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* ── Add Dialog ── */}
        <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogChange}>
          <Button
            style={{ backgroundColor: "#014357" }}
            className="text-white hover:opacity-90 shrink-0"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Jobsite
          </Button>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Jobsite</DialogTitle>
              <DialogDescription>
                Create a new jobsite entry. Code and Name are required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Code */}
              <div className="space-y-1.5">
                <Label htmlFor="add-code">
                  Code{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  className="mt-3"
                  id="add-code"
                  placeholder="Enter jobsite code"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  maxLength={50}
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="add-name">
                  Name{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  className="mt-3"
                  id="add-name"
                  placeholder="Enter jobsite name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  maxLength={255}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => handleAddDialogChange(false)}
                disabled={isSubmittingAdd}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: "#014357" }}
                className="text-white hover:opacity-90"
                onClick={createJobsite}
                disabled={isSubmittingAdd || !addCode.trim() || !addName.trim()}
              >
                {isSubmittingAdd ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Edit Dialog (rendered outside table to avoid nesting issues) ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Jobsite</DialogTitle>
            <DialogDescription>
              Update the jobsite information below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-code">
                Code{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-code"
                placeholder="Enter jobsite code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                maxLength={50}
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">
                Name{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Enter jobsite name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={255}
              />
            </div>

            {/* Read-only meta info */}
            {editingJobsite && (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Created by:</span>{" "}
                  {editingJobsite.CREATED_BY || "—"} &nbsp;·&nbsp;{" "}
                  {formatDate(editingJobsite.CREATED_AT)}
                </div>
                {editingJobsite.UPDATED_BY && (
                  <div>
                    <span className="font-medium">Last updated by:</span>{" "}
                    {editingJobsite.UPDATED_BY} &nbsp;·&nbsp;{" "}
                    {formatDate(editingJobsite.UPDATED_AT)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => handleEditDialogChange(false)}
              disabled={isSubmittingEdit}
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#014357" }}
              className="text-white hover:opacity-90"
              onClick={updateJobsite}
              disabled={
                isSubmittingEdit || !editCode.trim() || !editName.trim()
              }
            >
              {isSubmittingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Table ── */}
      <Card className="mt-2">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="h-10">
                <TableHead className="px-4 py-3">Code</TableHead>
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3 ">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : jobsites.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-gray-300" />
                      <span>
                        {searchQuery
                          ? "No jobsites match your search."
                          : 'No jobsites found. Click "Add Jobsite" to create one.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                jobsites.map((jobsite) => (
                  <TableRow key={jobsite.ID} className="h-12">
                    {/* Code */}
                    <TableCell className="px-4 py-2 align-middle font-medium">
                      {jobsite.Code}
                    </TableCell>

                    {/* Name */}
                    <TableCell className="px-4 py-2 align-middle text-gray-600 max-w-xs">
                      {jobsite.Name ? (
                        <span className="block truncate" title={jobsite.Name}>
                          {jobsite.Name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-2 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit button */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 p-0 border-[1px]"
                          style={{ borderColor: "#014357", color: "#014357" }}
                          onClick={() => openEditDialog(jobsite)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Delete button with confirmation */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 p-0 border-[1px]"
                              style={{
                                borderColor: "#dc2626",
                                color: "#dc2626",
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Jobsite
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this jobsite?
                                <br />
                                <span className="font-semibold text-gray-800">
                                  {jobsite.Code} - {jobsite.Name}
                                </span>
                                <br />
                                <span className="text-xs text-gray-500 mt-1 block">
                                  This action cannot be undone.
                                </span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteJobsite(jobsite.ID)}
                                style={{ backgroundColor: "#dc2626" }}
                                className="text-white hover:opacity-90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination footer ── */}
        {jobsites.length > 0 && (
          <div className="flex flex-wrap items-center justify-between px-4 py-4 border-t gap-4">
            {/* Rows per page */}
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
                </SelectContent>
              </Select>
            </div>

            {/* Page links */}
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    size="default"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
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
                          size="icon"
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                          style={
                            currentPage === pageNumber
                              ? {
                                  backgroundColor: "#014357",
                                  color: "#fff",
                                  borderColor: "#014357",
                                }
                              : undefined
                          }
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
                    return (
                      <PaginationEllipsis key={`ellipsis-${pageNumber}`} />
                    );
                  }

                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    size="default"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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

            {/* Result count */}
            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, totalRows)} of {totalRows}{" "}
              result
              {totalRows !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
