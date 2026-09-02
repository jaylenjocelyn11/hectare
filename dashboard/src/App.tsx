import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { DashboardLayout } from "./pages/DashboardLayout";
import { GroupsPage } from "./pages/GroupsPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProceduresPage } from "./pages/ProceduresPage";
import { RecipesPage } from "./pages/RecipesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemperaturesPage } from "./pages/TemperaturesPage";
import { apexOrigin, tenantSlugFromHost } from "./lib/dashboards";

const dashboardPages = (
  <>
    <Route index element={<OverviewPage />} />
    <Route path="temperatures" element={<TemperaturesPage />} />
    <Route path="procedures" element={<ProceduresPage />} />
    <Route path="recipes" element={<RecipesPage />} />
    <Route path="inventory" element={<InventoryPage />} />
    <Route path="groups" element={<GroupsPage />} />
    <Route path="horaire" element={<SchedulePage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </>
);

export default function App() {
  const tenant = tenantSlugFromHost();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {tenant ? (
              <>
                <Route path="/admin" element={<Navigate to={`${apexOrigin()}/admin`} replace />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  {dashboardPages}
                </Route>
              </>
            ) : (
              <>
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <HomeRedirect />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:orgSlug"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  {dashboardPages}
                </Route>
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
