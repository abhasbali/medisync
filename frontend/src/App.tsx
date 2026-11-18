import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AlertsProvider } from "@/contexts/AlertsContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmergencyPage } from "@/pages/EmergencyPage";
import { ResourceSharingPage } from "@/pages/ResourceSharingPage";
import { HospitalAdminPage } from "@/pages/HospitalAdminPage";
import { LoginPage } from "@/pages/LoginPage";
import { UsersPage } from "@/pages/UsersPage";
import { AccountPage } from "@/pages/AccountPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { AuditPage } from "@/pages/AuditPage";
import { MyHospitalPage } from "@/pages/MyHospitalPage";
import { EmptyState } from "@/components/common";
import type { Role } from "@/types/api";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // WebSocket events drive freshness; this interval is only a safety net.
        staleTime: 5_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

const queryClient = createQueryClient();

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist."
      className="py-24"
    />
  );
}

/** Redirects to /login when signed out; opens the realtime connection only for signed-in users. */
function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <RealtimeProvider>
      <AlertsProvider>
        <Outlet />
      </AlertsProvider>
    </RealtimeProvider>
  );
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return (
      <EmptyState title="Access denied" description="Your role does not allow access to this page." className="py-24" />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="emergency" element={<EmergencyPage />} />
                <Route path="sharing" element={<ResourceSharingPage />} />
                <Route
                  path="admin"
                  element={
                    <RequireRole roles={["ADMIN", "HOSPITAL_STAFF"]}>
                      <HospitalAdminPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="users"
                  element={
                    <RequireRole roles={["ADMIN"]}>
                      <UsersPage />
                    </RequireRole>
                  }
                />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route
                  path="audit"
                  element={
                    <RequireRole roles={["ADMIN"]}>
                      <AuditPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="my-hospital"
                  element={
                    <RequireRole roles={["HOSPITAL_STAFF"]}>
                      <MyHospitalPage />
                    </RequireRole>
                  }
                />
                <Route path="account" element={<AccountPage />} />
                <Route
                  path="*"
                  element={
                    <div className="text-center">
                      <NotFound />
                      <Link className="text-sm font-medium text-teal-700 underline" to="/">
                        Back to dashboard
                      </Link>
                    </div>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
