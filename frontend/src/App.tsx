import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useUser } from "@/context/UserContext";
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
import SidebarLayout from "./components/SidebarLayout";

import ContractsLayout from "@/pages/Contracts/ContractsLayout";
import Dashboard from "@/pages/Contracts/Dashboard";
import Assets from "@/pages/Contracts/Assets";
import ContractsPage from "@/pages/Contracts/Contracts/ContractsPage";
import ContractDetailsPage from "@/pages/Contracts/Contracts/ContractDetailPage";

function RootRedirect() {
  const { user } = useUser();
  const token = localStorage.getItem("token");
  const isAuthed = !!user?.id || !!(user as any)?._id || !!token;
  return <Navigate to={isAuthed ? "/dashboard" : "/signin"} replace />;
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/home" element={<HomePage />} />
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
          {/* 👇 Contracts area */}
          <Route
            path="/contracts"
            element={
              <SidebarLayout>
                <ContractsLayout />
              </SidebarLayout>
            }
          >
            <Route index element={<ContractsPage />} />
            <Route path=":id" element={<ContractDetailsPage />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
          </Route>

          {/* Legacy customer routes */}
          <Route path="/customer/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/customer" element={<Navigate to="/dashboard" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
