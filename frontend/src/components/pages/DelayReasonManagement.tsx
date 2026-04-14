import { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
  ClipboardList,
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
interface DelayReason {
  ID: number;
  TITLE: string;
  DESCRIBE: string;
  CREATED_AT: string;
  CREATED_BY: string;
  UPDATED_AT: string | null;
  UPDATED_BY: string | null;
}

interface DelayReasonPayload {
  Title: string;
  Describe?: string;
}

// ─────────────────────────────────────────────
// Shared helpers  (mirrors InternalUserManagement)
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
export function DelayReasonManagement() {
  // ── list & filter ──────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [reasons, setReasons] = useState<DelayReason[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── add dialog ─────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescribe, setAddDescribe] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // ── edit dialog ────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<DelayReason | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescribe, setEditDescribe] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // ── fetch ──────────────────────────────────
  const fetchReasons = async () => {
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(API.DELAY_REASONS_LIST(), {
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();

      // Handle wrapped response: response.Data, response.data, or bare array
      const raw =
        json.Data ??
        json.data ??
        json.Items ??
        json.items ??
        json.Results ??
        json.results ??
        json;

      const list: DelayReason[] = Array.isArray(raw) ? raw : [];

      setReasons(list);
    } catch (err: any) {
      console.error("[fetchReasons]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to load delay reasons: ${err.message || err}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchReasons();
  }, []);

  // ── add ────────────────────────────────────
  const resetAddForm = () => {
    setAddTitle("");
    setAddDescribe("");
  };

  const handleAddDialogChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) resetAddForm();
  };

  const createReason = async () => {
    if (!addTitle.trim()) {
      toast.error("Title is required.");
      return;
    }

    setIsSubmittingAdd(true);

    try {
      const payload: DelayReasonPayload = {
        Title: addTitle.trim(),
        Describe: addDescribe.trim() || undefined,
      };

      const res = await fetchWithAuth(API.DELAY_REASONS_CREATE(), {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await fetchReasons();
      toast.success("Delay reason created successfully.");
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (err: any) {
      console.error("[createReason]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to create delay reason: ${err.message || err}`);
      }
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // ── edit ───────────────────────────────────
  const openEditDialog = (reason: DelayReason) => {
    setEditingReason(reason);
    setEditTitle(reason.TITLE);
    setEditDescribe(reason.DESCRIBE ?? "");
    setIsEditDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditingReason(null);
    setEditTitle("");
    setEditDescribe("");
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) resetEditForm();
  };

  const updateReason = async () => {
    if (!editingReason) return;

    if (!editTitle.trim()) {
      toast.error("Title is required.");
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const payload: DelayReasonPayload = {
        Title: editTitle.trim(),
        Describe: editDescribe.trim() || undefined,
      };

      const res = await fetchWithAuth(
        API.DELAY_REASONS_UPDATE(editingReason.ID),
        {
          method: "PUT",
          headers: buildAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await fetchReasons();
      toast.success("Delay reason updated successfully.");
      setIsEditDialogOpen(false);
      resetEditForm();
    } catch (err: any) {
      console.error("[updateReason]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to update delay reason: ${err.message || err}`);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ── delete ─────────────────────────────────
  const deleteReason = async (id: number) => {
    try {
      const res = await fetchWithAuth(API.DELAY_REASONS_DELETE(id), {
        method: "DELETE",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      setReasons((prev) => prev.filter((r) => r.ID !== id));
      toast.success("Delay reason deleted successfully.");
    } catch (err: any) {
      console.error("[deleteReason]", err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to delete delay reason: ${err.message || err}`);
      }
    }
  };

  // ── filter & pagination ────────────────────
  const filteredReasons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return reasons;

    return reasons.filter(
      (r) =>
        r.TITLE?.toLowerCase().includes(q) ||
        r.DESCRIBE?.toLowerCase().includes(q) ||
        r.CREATED_BY?.toLowerCase().includes(q),
    );
  }, [reasons, searchQuery]);

  const totalPages = Math.ceil(filteredReasons.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReasons = filteredReasons.slice(startIndex, endIndex);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ── render ─────────────────────────────────
  return (
    <div className="p-8">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1
          className="mb-2 text-2xl font-semibold"
          style={{ color: "#014357" }}
        >
          Delay Reason Management
        </h1>
        <p className="text-gray-600">
          Manage master data for delay reasons used in re-ETA requests.
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
              <ClipboardList className="h-4 w-4" style={{ color: "#014357" }} />
            </div>
            <div className="text-gray-600 text-sm">Total Delay Reasons</div>
          </div>
          <div className="text-3xl font-semibold" style={{ color: "#014357" }}>
            {isLoading ? "..." : reasons.length}
          </div>
        </Card>
      </div>

      {/* ── Toolbar: search + add button ── */}
      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="relative w-96 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by title or description..."
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
            Add Delay Reason
          </Button>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Delay Reason</DialogTitle>
              <DialogDescription>
                Create a new delay reason entry. Title is required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="add-title">
                  Title{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="add-title"
                  placeholder="Enter delay reason title"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  maxLength={255}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="add-describe">
                  Description{" "}
                  <span className="text-gray-400 text-xs font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="add-describe"
                  placeholder="Enter a description..."
                  value={addDescribe}
                  onChange={(e) => setAddDescribe(e.target.value)}
                  rows={4}
                  className="resize-none"
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
                onClick={createReason}
                disabled={isSubmittingAdd || !addTitle.trim()}
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
            <DialogTitle>Edit Delay Reason</DialogTitle>
            <DialogDescription>
              Update the delay reason information below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">
                Title{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-title"
                placeholder="Enter delay reason title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={255}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-describe">
                Description{" "}
                <span className="text-gray-400 text-xs font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="edit-describe"
                placeholder="Enter a description..."
                value={editDescribe}
                onChange={(e) => setEditDescribe(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Read-only meta info */}
            {editingReason && (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Created by:</span>{" "}
                  {editingReason.CREATED_BY || "—"} &nbsp;·&nbsp;{" "}
                  {formatDate(editingReason.CREATED_AT)}
                </div>
                {editingReason.UPDATED_BY && (
                  <div>
                    <span className="font-medium">Last updated by:</span>{" "}
                    {editingReason.UPDATED_BY} &nbsp;·&nbsp;{" "}
                    {formatDate(editingReason.UPDATED_AT)}
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
              onClick={updateReason}
              disabled={isSubmittingEdit || !editTitle.trim()}
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
                <TableHead className="px-4 py-3">Title</TableHead>
                <TableHead className="px-4 py-3">Description</TableHead>
                <TableHead className="px-4 py-3">Created By</TableHead>
                <TableHead className="px-4 py-3">Created At</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedReasons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-gray-300" />
                      <span>
                        {searchQuery
                          ? "No delay reasons match your search."
                          : 'No delay reasons found. Click "Add Delay Reason" to create one.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReasons.map((reason, index) => (
                  <TableRow key={reason.ID} className="h-12">
                    {/* Title */}
                    <TableCell className="px-4 py-2 align-middle font-medium">
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-white text-xs px-2 py-0.5 shrink-0"
                          style={{ backgroundColor: "#014357" }}
                        >
                          #{reason.ID}
                        </Badge>
                        <span>{reason.TITLE}</span>
                      </div>
                    </TableCell>

                    {/* Description */}
                    <TableCell className="px-4 py-2 align-middle text-gray-600 max-w-xs">
                      {reason.DESCRIBE ? (
                        <span
                          className="block truncate"
                          title={reason.DESCRIBE}
                        >
                          {reason.DESCRIBE}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Created By */}
                    <TableCell className="px-4 py-2 align-middle text-gray-600">
                      {reason.CREATED_BY || "—"}
                    </TableCell>

                    {/* Created At */}
                    <TableCell className="px-4 py-2 align-middle text-gray-600">
                      {formatDate(reason.CREATED_AT)}
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
                          onClick={() => openEditDialog(reason)}
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
                                Delete Delay Reason
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this delay
                                reason?
                                <br />
                                <span className="font-semibold text-gray-800">
                                  {reason.TITLE}
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
                                onClick={() => deleteReason(reason.ID)}
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
        {filteredReasons.length > 0 && (
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
              Showing {startIndex + 1}–
              {Math.min(endIndex, filteredReasons.length)} of{" "}
              {filteredReasons.length} result
              {filteredReasons.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
