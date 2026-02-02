import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

// Pages
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TenantsPage from "@/pages/TenantsPage";
import OrganizationsPage from "@/pages/OrganizationsPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import EquipmentsPage from "@/pages/EquipmentsPage";
import SensorsPage from "@/pages/SensorsPage";
import UsersPage from "@/pages/UsersPage";
import AlertsPage from "@/pages/AlertsPage";
import WebhooksPage from "@/pages/WebhooksPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AuditLogsPage from "@/pages/AuditLogsPage";
import PlansPage from "@/pages/PlansPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes with layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/tenants"
                element={(
                  <PermissionRoute permission="admin.tenants.read">
                    <TenantsPage />
                  </PermissionRoute>
                )}
              />
              <Route
                path="/organizations"
            element={(
              <PermissionRoute permission="tenant.organizations.read">
                <OrganizationsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/workspaces"
            element={(
              <PermissionRoute permission="tenant.workspaces.read">
                <WorkspacesPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/equipments"
            element={(
              <PermissionRoute permission="tenant.equipments.read">
                <EquipmentsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/sensors"
            element={(
              <PermissionRoute permission="tenant.sensors.read">
                <SensorsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/users"
            element={(
              <PermissionRoute permission="tenant.users.read">
                <UsersPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/alerts"
            element={(
              <PermissionRoute permission="tenant.alerts.read">
                <AlertsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/webhooks"
            element={(
              <PermissionRoute permission="tenant.webhooks.read">
                <WebhooksPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/analytics"
            element={(
              <PermissionRoute permission="analytics.read">
                <AnalyticsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/audit-logs"
            element={(
              <PermissionRoute permission="admin.audit.read">
                <AuditLogsPage />
              </PermissionRoute>
            )}
          />
          <Route
            path="/plans"
            element={(
              <PermissionRoute permission="admin.plans.read">
                <PlansPage />
              </PermissionRoute>
            )}
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/settings"
            element={(
              <PermissionRoute permission="admin.settings.read">
                <SettingsPage />
              </PermissionRoute>
            )}
          />
            </Route>
            
            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
