import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import EditWorkOrderPage from "./pages/EditWorkOrder/EditWorkOrderPage";
import FilteredAssetPage from "./pages/ListAsset/FilteredAssetPage";
import EditAssetPage from "./pages/EditAsset/EditAssetPage";
import PrivateRoute from "./components/PrivateRoute";
import NotFound from "./pages/NotFound";
import FilteredWorkOrderPage from "./pages/ListWorkOrders/FilteredWorkOrderPage";
import TemplateListPage from "./pages/ListTemplates/TemplateListPage";
import TemplateEditPage from "./pages/EditTemplates/TemplateEditPage";
import TemplateCreatePage from "./pages/AddTemplate/TemplateCreatePage";
import ContractTable from "./pages/Contracts/ContractTable";
import ContractDetailPage from "./pages/Contracts/ContractDetailPage";
import SidebarLayout from "./components/SidebarLayout";

export default function App() {
  return (
    <>
      <ToastContainer />
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignInPage />} />

          {/* Authenticated routes wrapped in SidebarLayout */}
          <Route
            path="/dashboard"
            element={
              <SidebarLayout>
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              </SidebarLayout>
            }
          />
          <Route
            path="/assets"
            element={
              <SidebarLayout>
                <FilteredAssetPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/assets/edit/:id"
            element={
              <SidebarLayout>
                <EditAssetPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/workorders"
            element={
              <SidebarLayout>
                <FilteredWorkOrderPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/workorders/edit/:id"
            element={
              <SidebarLayout>
                <EditWorkOrderPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/templates"
            element={
              <SidebarLayout>
                <TemplateListPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/templates/edit/:id"
            element={
              <SidebarLayout>
                <TemplateEditPage />
              </SidebarLayout>
            }
          />
          <Route
            path="/templates/new"
            element={
              <SidebarLayout>
                <TemplateCreatePage />
              </SidebarLayout>
            }
          />
          <Route
            path="/contracts"
            element={
              <SidebarLayout>
                <ContractTable />
              </SidebarLayout>
            }
          />
          <Route
            path="/contracts/:contractId"
            element={
              <SidebarLayout>
                <ContractDetailPage />
              </SidebarLayout>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}