import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext.js";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { RecordsListPage } from "./pages/RecordsListPage.js";
import { RecordFormPage } from "./pages/RecordFormPage.js";
import { ImportPage } from "./pages/ImportPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { MonthlyReportPage } from "./pages/MonthlyReportPage.js";
import { YearlyReportPage } from "./pages/YearlyReportPage.js";
import { BudgetPage } from "./pages/BudgetPage.js";
import { CashflowPage } from "./pages/CashflowPage.js";
import { PlansPage } from "./pages/PlansPage.js";
import { AccountsOverviewPage } from "./pages/AccountsOverviewPage.js";
import { StatementsPage } from "./pages/StatementsPage.js";
import { QueryPage } from "./pages/QueryPage.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="records" element={<RecordsListPage />} />
              <Route path="records/new" element={<RecordFormPage />} />
              <Route path="records/:id" element={<RecordFormPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="reports/monthly" element={<MonthlyReportPage />} />
              <Route path="reports/yearly" element={<YearlyReportPage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="cashflow" element={<CashflowPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="accounts" element={<AccountsOverviewPage />} />
              <Route path="statements" element={<StatementsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/query" element={<QueryPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
