import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";

import EditWorkOrderPage from "./pages/EditWorkOrder/EditWorkOrderPage";

import FilteredAssetPage from "./pages/ListAsset/FilteredAssetPage";
import EditAssetPage from "./pages/EditAsset/EditAssetPage"
import PrivateRoute from "./components/PrivateRoute";
import NotFound from "./pages/NotFound";
import FilteredWorkOrderPage from "./pages/ListWorkOrders/FilteredWorkOrderPage";

export default function App() {
  return (
    <>
      <ToastContainer />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route path="/assets" element={<FilteredAssetPage />} />
          <Route path="/assets/edit/:id" element={<EditAssetPage />} />
          <Route path="/workorders" element={<FilteredWorkOrderPage />} />
          <Route path="/workorders/edit/:id" element={<EditWorkOrderPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
