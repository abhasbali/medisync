import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmergencyPage } from "@/pages/EmergencyPage";
import { ResourceSharingPage } from "@/pages/ResourceSharingPage";
import { HospitalAdminPage } from "@/pages/HospitalAdminPage";
import { EmptyState } from "@/components/common";

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="emergency" element={<EmergencyPage />} />
              <Route path="sharing" element={<ResourceSharingPage />} />
              <Route path="admin" element={<HospitalAdminPage />} />
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
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
