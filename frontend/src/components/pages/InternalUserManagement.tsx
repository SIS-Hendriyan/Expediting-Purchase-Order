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
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Trash2,
  UserCheck,
  Pencil,
  CheckCircle2,
  Users,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { API } from "../../config";
import {
  getAccessToken,
  redirectToLoginExpired,
} from "../../utils/authSession";

type RoleType = "Admin" | "Purchaser" | "User" | string;

interface InternalUser {
  id: number | string;
  nrp: string;
  name: string;
  email: string;
  role: RoleType;
  department: string;
  jobsite: string;
  isActive: boolean;
}

interface UserSummary {
  totalUsers?: number;
  totalAdmin?: number;
  totalPurchaser?: number;
  totalUser?: number;
  TotalUsers?: number;
  TotalAdmin?: number;
  TotalPurchaser?: number;
  TotalUser?: number;
  [key: string]: any;
}

interface VerifiedUser {
  nrp: string;
  name: string;
  email: string;
}

// ================= Shared helpers =================
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

interface EmployeeRow {
  NRP: string;
  Department: string;
}

interface JobsiteOption {
  ID: number;
  Code: string;
  Name: string;
}

export function InternalUserManagement() {
  // ====== list & filter state ======
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ====== department dropdown data ======
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);

  // ====== jobsite dropdown data ======
  const [jobsiteOptions, setJobsiteOptions] = useState<JobsiteOption[]>([]);

  // ====== summary state ======
  const [summary, setSummary] = useState<UserSummary | null>(null);

  // ====== edit user state ======
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNRP, setEditNRP] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<RoleType>("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJobsite, setEditJobsite] = useState("");

  // ====== add user state ======
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserNRP, setNewUserNRP] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [newUserRole, setNewUserRole] = useState<RoleType>("");
  const [newUserDepartment, setNewUserDepartment] = useState("");
  const [newUserJobsite, setNewUserJobsite] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  const isVerified = Boolean(verifiedUser);

  // =============== Fetch users ===============
  const fetchUsers = async () => {
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(API.LISTUSER(), {
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const json = await res.json();

      const rows =
        json.data?.rows ??
        json.Data?.rows ??
        json.data ??
        json.Data ??
        json.users ??
        json;

      const list: any[] = Array.isArray(rows)
        ? rows
        : Array.isArray(rows?.users)
          ? rows.users
          : [];

      const normalized: InternalUser[] = list.map((u: any) => ({
        id: u.ID_User ?? u.id,
        nrp: u.NRP ?? u.nrp ?? "",
        name: u.Name ?? u.Nama ?? u.name ?? "",
        email: u.Email ?? u.email ?? "",
        role: u.Role ?? u.role ?? "User",
        department: u.Department ?? u.department ?? "",
        jobsite: u.Jobsite ?? u.jobsite ?? "",
        isActive: u.IsActive ?? u.isActive ?? true,
      }));

      setUsers(normalized);

      const rowsHeader =
        json.data?.summary ?? json.Data?.summary ?? json.summary ?? null;
      setSummary(
        rowsHeader && typeof rowsHeader === "object"
          ? (rowsHeader as UserSummary)
          : null,
      );
    } catch (err: any) {
      console.error(err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to load users: ${err.message || err}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobsiteOptions = async () => {
    try {
      const res = await fetchWithAuth(API.JOBSITE_LIST(), {
        headers: buildAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      const raw = json.Data ?? json.data ?? json;
      const list: JobsiteOption[] = Array.isArray(raw)
        ? raw
        : (raw.Items ?? raw.items ?? []);
      setJobsiteOptions(list);
    } catch {
      // silent – dropdown will remain empty
    }
  };

  const fetchDepartmentOptions = async () => {
    try {
      const res = await fetchWithAuth(API.EMPLOYEE_LIST(), {
        headers: buildAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      const raw = json.Data ?? json.data ?? json;
      const list: EmployeeRow[] = Array.isArray(raw) ? raw : [];
      const uniqueDepts = Array.from(
        new Set(list.map((e) => e.Department).filter(Boolean)),
      ).sort();
      setDepartmentOptions(uniqueDepts);
    } catch {
      // silent – dropdown will remain empty
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchJobsiteOptions();
    void fetchDepartmentOptions();
  }, []);

  // =============== helpers ===============
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "#014357";
      case "Purchaser":
        return "#ED832D";
      case "User":
        return "#008383";
      default:
        return "#008383";
    }
  };

  const getRoleCount = (role: string) =>
    users.filter((u) => u.role === role).length;

  const totalUsersValue =
    summary?.TotalUsers ?? summary?.totalUsers ?? users.length;
  const totalAdminValue =
    summary?.TotalAdmin ?? summary?.totalAdmin ?? getRoleCount("Admin");
  const totalPurchaserValue =
    summary?.TotalPurchaser ??
    summary?.totalPurchaser ??
    getRoleCount("Purchaser");
  const totalUserRoleValue =
    summary?.TotalUser ?? summary?.totalUser ?? getRoleCount("User");

  // =============== delete user ===============
  const deleteUser = async (userId: number | string) => {
    try {
      const res = await fetchWithAuth(API.DELETEUSER(userId), {
        method: "DELETE",
        headers: buildAuthHeaders(),
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted successfully");
    } catch (err: any) {
      console.error(err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to delete user: ${err.message || err}`);
      }
    }
  };

  // =============== edit user dialog ===============
  const openEditDialog = (user: InternalUser) => {
    setEditingUser(user);
    setEditNRP(user.nrp);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditDepartment(user.department);
    setEditJobsite(user.jobsite);

    setIsEditDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditingUser(null);
    setEditNRP("");
    setEditName("");
    setEditEmail("");
    setEditRole("");
    setEditDepartment("");
    setEditJobsite("");
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) resetEditForm();
  };

  const updateUser = async () => {
    if (!editingUser) return;

    if (!editNRP || !editName || !editEmail) {
      toast.error("NRP, Full Name, and Email are required.");
      return;
    }

    try {
      const payload = {
        NRP: editNRP,
        Name: editName,
        Nama: editName,
        Email: editEmail,
        Role: editRole,
        Department: editDepartment,
        Jobsite: editJobsite,
      };

      const res = await fetchWithAuth(API.UPDATEUSER(editingUser.id), {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await res.json();
      await fetchUsers();

      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      resetEditForm();
    } catch (err: any) {
      console.error(err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to update user: ${err.message || err}`);
      }
    }
  };

  // =============== verify NRP (SSO) ===============
  const verifyNRP = async () => {
    const nrp = newUserNRP.trim();

    if (!nrp) {
      toast.error("Please enter NRP first");
      return;
    }

    try {
      setIsVerifying(true);

      const res = await fetchWithAuth(API.SSO_GETUSER(nrp), {
        method: "GET",
        headers: buildAuthHeaders(),
      });

      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        setVerifiedUser(null);
        toast.error(msg || "SSO lookup failed");
        return;
      }

      const json = await res.json();
      const payload = json.Data ?? json.data ?? json;

      const fullName =
        payload?.Name ?? payload?.FullName ?? payload?.name ?? "";
      const email =
        payload?.Email ?? payload?.UserEmail ?? payload?.email ?? "";

      if (!fullName && !email) {
        setVerifiedUser(null);
        toast.error("User not found in SSO");
        return;
      }

      setNewUserName(fullName);
      setNewUserEmail(email);
      setVerifiedUser({ nrp, name: fullName, email });

      toast.success(`NRP verified: ${fullName}`);
    } catch (err: any) {
      console.error("[verifyNRP] error:", err);
      setVerifiedUser(null);
      if (err?.message !== "Session expired") {
        toast.error("Failed to verify NRP");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // =============== add new user ===============
  const addNewUser = async () => {
    const nrp = (verifiedUser?.nrp || newUserNRP).trim();
    const name = (verifiedUser?.name || newUserName).trim();
    const email = (verifiedUser?.email || newUserEmail).trim();

    if (!nrp || !name || !email) {
      toast.error("NRP, Full Name, and Email are required.");
      return;
    }

    if (!newUserRole || !newUserDepartment || !newUserJobsite) {
      toast.error("Role, Department, and Jobsite are required.");
      return;
    }

    try {
      const payload = {
        NRP: nrp,
        Email: email,
        Name: name,
        Nama: name,
        Role: newUserRole,
        Department: newUserDepartment,
        Jobsite: newUserJobsite,
        IsActive: false,
        Password: "",
      };

      const res = await fetchWithAuth(API.CREATEUSER(), {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      await res.json();
      await fetchUsers();

      toast.success(`${name} has been added successfully!`);
      resetAddUserForm();
      setIsAddDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      if (err?.message !== "Session expired") {
        toast.error(`Failed to add user: ${err.message || err}`);
      }
    }
  };

  const resetAddUserForm = () => {
    setNewUserNRP("");
    setVerifiedUser(null);
    setNewUserRole("");
    setNewUserDepartment("");
    setNewUserJobsite("");
    setNewUserName("");
    setNewUserEmail("");
  };

  const handleAddDialogChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) resetAddUserForm();
  };

  // =============== filter & pagination ===============
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();

    return users.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.nrp.includes(searchQuery) ||
        u.department.toLowerCase().includes(q) ||
        u.jobsite.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

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

  // =============== render ===============
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1
          className="mb-2 text-2xl font-semibold"
          style={{ color: "#014357" }}
        >
          Internal User Management
        </h1>
        <p className="text-gray-600">
          Manage internal users, roles, and permissions
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 gap-4">
        <div className="relative w-96 max-w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogChange}>
          <DialogTrigger asChild>
            <Button
              style={{ backgroundColor: "#014357" }}
              className="text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" /> Add New User
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Masukkan NRP lalu klik Verify. Nama &amp; Email akan terisi
                otomatis dan terkunci. Setelah verifikasi, pilih Role,
                Department, dan Jobsite.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label className="mb-2">Employee NRP</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter NRP"
                    value={newUserNRP}
                    onChange={(e) => setNewUserNRP(e.target.value)}
                    disabled={isVerified || isVerifying}
                  />
                  {!isVerified ? (
                    <Button
                      onClick={verifyNRP}
                      style={{ backgroundColor: "#014357" }}
                      className="text-white whitespace-nowrap"
                      disabled={!newUserNRP || isVerifying}
                    >
                      {isVerifying ? "Verifying…" : "Verify"}
                    </Button>
                  ) : (
                    <Button
                      onClick={resetAddUserForm}
                      variant="outline"
                      className="whitespace-nowrap"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {isVerified && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 -mt-2 mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-green-700">
                      NRP verified successfully
                    </span>
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2">Full Name</Label>
                <Input
                  value={newUserName}
                  onChange={() => {}}
                  className="bg-gray-50 opacity-80 cursor-not-allowed"
                  placeholder="(Locked) Filled by SSO"
                  readOnly
                  disabled
                />
              </div>

              <div>
                <Label className="mb-2">Email</Label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={() => {}}
                  className="bg-gray-50 opacity-80 cursor-not-allowed"
                  placeholder="(Locked) Filled by SSO"
                  readOnly
                  disabled
                />
              </div>

              <div>
                <Label className="mb-2">Role</Label>
                <Select
                  value={newUserRole}
                  onValueChange={(val) => {
                    setNewUserRole(val);
                  }}
                  disabled={!isVerified}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Purchaser">Purchaser</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

<div>
                <Label className="mb-2">Department</Label>
                <Select
                  value={newUserDepartment}
                  onValueChange={setNewUserDepartment}
                  disabled={!isVerified}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2">Jobsite</Label>
                <Select
                  value={newUserJobsite}
                  onValueChange={setNewUserJobsite}
                  disabled={!isVerified}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select jobsite" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobsiteOptions.map((j) => (
                      <SelectItem key={j.ID} value={j.Name}>
                        {j.Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                style={{ backgroundColor: "#014357" }}
                className="w-full text-white"
                onClick={addNewUser}
                disabled={
                  !isVerified ||
                  !newUserRole ||
                  !newUserDepartment ||
                  !newUserJobsite
                }
              >
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "rgba(1, 67, 87, 0.1)" }}
            >
              <Users className="h-4 w-4" style={{ color: "#014357" }} />
            </div>
            <div className="text-gray-600 text-sm">Total Users</div>
          </div>
          <div className="text-3xl" style={{ color: "#014357" }}>
            {isLoading ? "..." : totalUsersValue}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "rgba(0, 131, 131, 0.1)" }}
            >
              <ShieldCheck className="h-4 w-4" style={{ color: "#008383" }} />
            </div>
            <div className="text-gray-600 text-sm">Admins</div>
          </div>
          <div className="text-3xl" style={{ color: "#008383" }}>
            {totalAdminValue}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "rgba(237, 131, 45, 0.1)" }}
            >
              <UserCheck className="h-4 w-4" style={{ color: "#ED832D" }} />
            </div>
            <div className="text-gray-600 text-sm">Purchasers</div>
          </div>
          <div className="text-3xl" style={{ color: "#ED832D" }}>
            {totalPurchaserValue}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "rgba(106, 167, 93, 0.1)" }}
            >
              <UserIcon className="h-4 w-4" style={{ color: "#6AA75D" }} />
            </div>
            <div className="text-gray-600 text-sm">Users</div>
          </div>
          <div className="text-3xl" style={{ color: "#6AA75D" }}>
            {totalUserRoleValue}
          </div>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update internal user information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="mb-2">Full Name</Label>
              <Input
                value={editName}
                onChange={() => {}}
                placeholder="Full name"
                className="bg-gray-50 opacity-80 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>

            <div>
              <Label className="mb-2">NRP</Label>
              <Input
                value={editNRP}
                onChange={() => {}}
                placeholder="Employee NRP"
                className="bg-gray-50 opacity-80 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>

            <div>
              <Label className="mb-2">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={() => {}}
                placeholder="Email address"
                className="bg-gray-50 opacity-80 cursor-not-allowed"
                readOnly
                disabled
              />
            </div>

            <div>
              <Label className="mb-2">Role</Label>
              <Select
                value={editRole}
                onValueChange={(val) => setEditRole(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Purchaser">Purchaser</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2">Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2">Jobsite</Label>
              <Select value={editJobsite} onValueChange={setEditJobsite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select jobsite" />
                </SelectTrigger>
                <SelectContent>
                  {jobsiteOptions.map((j) => (
                    <SelectItem key={j.ID} value={j.Name}>
                      {j.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              style={{ backgroundColor: "#014357" }}
              className="w-full text-white"
              onClick={updateUser}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="mt-2">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="h-10">
                <TableHead className="px-4 py-3">NRP</TableHead>
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3">Email</TableHead>
                <TableHead className="px-4 py-3">Role</TableHead>
                <TableHead className="px-4 py-3">Department</TableHead>
                <TableHead className="px-4 py-3">Jobsite</TableHead>
                <TableHead className="px-4 py-3">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} className="h-12">
                  <TableCell className="px-4 py-2 align-middle">
                    {user.nrp}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-400" />
                      <span>{user.name}</span>
                      {!user.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-2 align-middle text-xs text-gray-600">
                    {user.email}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-middle">
                    <Badge
                      style={{ backgroundColor: getRoleBadgeColor(user.role) }}
                      className="text-white px-3 py-1 min-w-[80px] justify-center text-xs"
                    >
                      {user.role}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4 py-2 align-middle">
                    {user.department}
                  </TableCell>
                  <TableCell className="px-4 py-2 align-middle">
                    {user.jobsite}
                  </TableCell>

                  <TableCell className="px-4 py-2 align-middle text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 p-0 border-[1px]"
                        style={{ borderColor: "#014357", color: "#014357" }}
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 p-0 border-[1px]"
                            style={{ borderColor: "#dc2626", color: "#dc2626" }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure want to delete this user? <br />
                              <span className="font-semibold">{user.name}</span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser(user.id)}
                              style={{ backgroundColor: "#dc2626" }}
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && paginatedUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {filteredUsers.length > 0 && (
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

            <div className="text-sm text-gray-600 whitespace-nowrap">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredUsers.length)} of{" "}
              {filteredUsers.length} results
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
