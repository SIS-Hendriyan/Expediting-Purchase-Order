import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { VendorManagement } from "./components/pages/VendorManagement";
import { InternalUserManagement } from "./components/pages/InternalUserManagement";
import { DelayReasonManagement } from "./components/pages/DelayReasonManagement";
import { JobsiteManagement } from "./components/pages/JobsiteManagement";
import { PurchaseOrder } from "./components/pages/PurchaseOrder";
import { PurchaseOrderDetail } from "./components/pages/PurchaseOrderDetail";
import { RescheduleETA } from "./components/pages/RescheduleETA";
import { Dashboard } from "./components/pages/Dashboard";
import Login, { type User } from "./components/pages/Login";
import {
  getAuthSession,
  isVendorSession,
  isInternalSession,
  clearAuthSession,
} from "./utils/authSession";
import { OTP } from "./components/pages/OTP";

import {
  Users,
  Package,
  Calendar,
  BarChart3,
  ChevronDown,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Database,
} from "lucide-react";

import { Button } from "./components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { Toaster } from "./components/ui/sonner";

import logoImage from "./assets/5634ad8959216fdb7980de73de586bfe04c49599.png";
import collapsedIcon from "./assets/cbde77824bc437d545969c4a519b54885b6dad7d.png";

type Page =
  | "vendor-management"
  | "internal-user-management"
  | "delay-reason"
  | "jobsite"
  | "purchase-order"
  | "purchase-order-detail"
  | "reschedule-eta"
  | "dashboard"
  | "otp";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vendorOtpPending, setVendorOtpPending] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  const [userManagementExpanded, setUserManagementExpanded] = useState(false);
  const [masterDataExpanded, setMasterDataExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const derivePageFromPath = (path: string): Page => {
    if (path.startsWith("/vendor-management")) return "vendor-management";
    if (path.startsWith("/internal-user-management"))
      return "internal-user-management";
    if (path.startsWith("/delay-reason")) return "delay-reason";
    if (path.startsWith("/jobsite")) return "jobsite";
    if (path.startsWith("/purchase-order-detail"))
      return "purchase-order-detail";
    if (path.startsWith("/purchase-order")) return "purchase-order";
    if (path.startsWith("/reschedule-eta")) return "reschedule-eta";
    if (path.startsWith("/otp")) return "otp";
    return "dashboard";
  };

  const clearClientAuthData = () => {
    try {
      clearAuthSession();

      sessionStorage.removeItem("vendorSession");
      sessionStorage.removeItem("internalSession");
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("token");

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("token");
    } catch (e) {
      console.error("Failed to clear auth data:", e);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);

    if (user.role === "vendor") {
      setVendorOtpPending(true);
      navigate("/otp", { replace: true });
      return;
    }

    setVendorOtpPending(false);
    navigate("/dashboard", { replace: true });
  };

  const handleOtpVerified = (user: User) => {
    setCurrentUser(user);
    setVendorOtpPending(false);
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = () => {
    setProfilePopoverOpen(false);
    setCurrentUser(null);
    setVendorOtpPending(false);

    clearClientAuthData();

    navigate("/login", { replace: true });
  };

  useEffect(() => {
    try {
      const session = getAuthSession();

      if (!session) {
        setIsRestoring(false);
        return;
      }

      if (isVendorSession(session)) {
        const restoredUser: User = {
          email: session.email || "",
          name: session.completeName || "",
          role: "vendor",
          company: session.vendorName || undefined,
          type: "VENDOR",
          vendorCode: session.vendorCode || undefined,
        };

        setCurrentUser(restoredUser);
        setVendorOtpPending(false);
        setIsRestoring(false);
        return;
      }

      if (isInternalSession(session)) {
        const mappedRole: User["role"] =
          String(session.role || "").toLowerCase() === "admin"
            ? "admin"
            : "user";

        const restoredUser: User = {
          email: session.email || "",
          name: session.name || "",
          role: mappedRole,
          company: session.jobsite || undefined,
          type: "INTERNAL",
        };
        console.log("[restoreSession] raw session:", session);

        setCurrentUser(restoredUser);
        setVendorOtpPending(false);
        setIsRestoring(false);
        return;
      }

      setIsRestoring(false);
    } catch (e) {
      console.error("[restoreSession] failed:", e);
      setIsRestoring(false);
    }
  }, []);

  if (isRestoring) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (vendorOtpPending) {
    if (location.pathname !== "/otp") {
      return <Navigate to="/otp" replace />;
    }

    return <OTP user={currentUser} onVerified={handleOtpVerified} />;
  }

  const currentPage = derivePageFromPath(location.pathname);

  const renderPage = () => {
    switch (currentPage) {
      case "vendor-management":
        return <VendorManagement />;
      case "internal-user-management":
        return <InternalUserManagement />;
      case "delay-reason":
        return <DelayReasonManagement />;
      case "jobsite":
        return <JobsiteManagement />;
      case "purchase-order":
        return (
          <PurchaseOrder
            user={currentUser}
            onPageChange={(page) => navigate(`/${page}`)}
          />
        );
      case "purchase-order-detail":
        return <PurchaseOrderDetail user={currentUser} />;
      case "reschedule-eta":
        return <RescheduleETA user={currentUser} />;
      case "dashboard":
      default:
        return (
          <Dashboard
            user={currentUser}
            onPageChange={(page) => navigate(`/${page}`)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <TooltipProvider delayDuration={0}>
        <div
          className={`${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${
            sidebarCollapsed ? "w-20" : "w-64"
          } transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {sidebarCollapsed ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <img
                    src={collapsedIcon}
                    alt="AlamTri Icon"
                    className="h-8 w-8 object-contain"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarCollapsed(false)}
                    className="p-1 h-auto hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              ) : (
                <>
                  <img
                    src={logoImage}
                    alt="AlamTri Logo"
                    className="h-12 object-contain"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSidebarCollapsed(true)}
                      className="hidden lg:flex p-1 h-auto hover:bg-gray-100 rounded"
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="lg:hidden p-1 h-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/dashboard")}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? "justify-center" : "gap-3"
                  } px-4 py-3 rounded-lg transition-colors ${
                    currentPage === "dashboard"
                      ? "text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  style={
                    currentPage === "dashboard"
                      ? { backgroundColor: "#014357" }
                      : {}
                  }
                >
                  <BarChart3 className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-left">Analytical Dashboard</span>
                  )}
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right">
                  <p>Analytical Dashboard</p>
                </TooltipContent>
              )}
            </Tooltip>

            {currentUser.role !== "vendor" && (
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (!sidebarCollapsed) {
                          setMasterDataExpanded((v) => !v);
                        } else {
                          navigate("/delay-reason");
                        }
                      }}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? "justify-center" : "justify-between"
                      } gap-3 px-4 py-3 rounded-lg transition-colors ${
                        currentPage === "delay-reason" ||
                        currentPage === "jobsite"
                          ? "text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "delay-reason" ||
                        currentPage === "jobsite"
                          ? { backgroundColor: "#014357" }
                          : {}
                      }
                    >
                      <div
                        className={`flex items-center ${
                          sidebarCollapsed ? "" : "gap-3"
                        }`}
                      >
                        <Database className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <span className="text-left">Master Data</span>
                        )}
                      </div>
                      {!sidebarCollapsed && (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            masterDataExpanded ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right">
                      <p>Master Data</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                {masterDataExpanded && !sidebarCollapsed && (
                  <div className="text-left flex-1 ml-4 mt-1 space-y-1">
                    <button
                      onClick={() => navigate("/delay-reason")}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === "delay-reason"
                          ? "text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "delay-reason"
                          ? { backgroundColor: "#008383" }
                          : {}
                      }
                    >
                      Delay Reason
                    </button>
                    <button
                      onClick={() => navigate("/jobsite")}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === "jobsite"
                          ? "text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "jobsite"
                          ? { backgroundColor: "#008383" }
                          : {}
                      }
                    >
                      Jobsite
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentUser.role === "admin" && (
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (!sidebarCollapsed) {
                          setUserManagementExpanded((v) => !v);
                        } else {
                          navigate("/vendor-management");
                        }
                      }}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? "justify-center" : "justify-between"
                      } gap-3 px-4 py-3 rounded-lg transition-colors ${
                        currentPage === "vendor-management" ||
                        currentPage === "internal-user-management"
                          ? "text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "vendor-management" ||
                        currentPage === "internal-user-management"
                          ? { backgroundColor: "#014357" }
                          : {}
                      }
                    >
                      <div
                        className={`flex items-center ${
                          sidebarCollapsed ? "" : "gap-3"
                        }`}
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <span className="text-left">User Management</span>
                        )}
                      </div>
                      {!sidebarCollapsed && (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            userManagementExpanded ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right">
                      <p>User Management</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                {userManagementExpanded && !sidebarCollapsed && (
                  <div className="text-left flex-1 ml-4 mt-1 space-y-1">
                    <button
                      onClick={() => navigate("/vendor-management")}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === "vendor-management"
                          ? "text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "vendor-management"
                          ? { backgroundColor: "#008383" }
                          : {}
                      }
                    >
                      Vendor Management
                    </button>
                    <button
                      onClick={() => navigate("/internal-user-management")}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                        currentPage === "internal-user-management"
                          ? "text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      style={
                        currentPage === "internal-user-management"
                          ? { backgroundColor: "#008383" }
                          : {}
                      }
                    >
                      Internal User Management
                    </button>
                  </div>
                )}
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/purchase-order")}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? "justify-center" : "gap-3"
                  } px-4 py-3 rounded-lg transition-colors ${
                    currentPage === "purchase-order"
                      ? "text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  style={
                    currentPage === "purchase-order"
                      ? { backgroundColor: "#014357" }
                      : {}
                  }
                >
                  <Package className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-left">Purchase Order</span>
                  )}
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right">
                  <p>Purchase Order</p>
                </TooltipContent>
              )}
            </Tooltip>

            {(currentUser.role === "admin" ||
              currentUser.role === "vendor") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/reschedule-eta")}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? "justify-center" : "gap-3"
                    } px-4 py-3 rounded-lg transition-colors ${
                      currentPage === "reschedule-eta"
                        ? "text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    style={
                      currentPage === "reschedule-eta"
                        ? { backgroundColor: "#014357" }
                        : {}
                    }
                  >
                    <Calendar className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="text-left">Reschedule ETA Request</span>
                    )}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right">
                    <p>Reschedule ETA Request</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <Popover
              open={profilePopoverOpen}
              onOpenChange={setProfilePopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? "justify-center" : "gap-3"
                  } px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: "#014357" }}
                  >
                    {(currentUser.name || currentUser.email || "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm truncate">
                        {currentUser.name || "-"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {currentUser.company || "-"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {currentUser.email}
                      </p>
                    </div>
                  )}
                </button>
              </PopoverTrigger>

              <PopoverContent
                side={sidebarCollapsed ? "right" : "top"}
                align="start"
                className={`${sidebarCollapsed ? "w-auto" : "w-56"} p-0`}
                sideOffset={8}
              >
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </TooltipProvider>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="min-w-0">
                <h1
                  className="text-base sm:text-xl truncate"
                  style={{ color: "#014357" }}
                >
                  Procurement System
                </h1>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Welcome back,</p>
                <p style={{ color: "#014357" }}>
                  {currentUser.name || currentUser.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">{renderPage()}</main>
      </div>

      <Toaster />
    </div>
  );
}
