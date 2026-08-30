import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./pages/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProceduresPage } from "./pages/ProceduresPage";
import { TemperaturesPage } from "./pages/TemperaturesPage";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="temperatures" element={<TemperaturesPage />} />
            <Route path="procedures" element={<ProceduresPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
