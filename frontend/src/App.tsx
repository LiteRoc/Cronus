import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import EditWorkOrderPage from "./pages/EditWorkOrder/EditWorkOrderPage";
import EditAssetPage from "./pages/EditAsset/EditAssetPage"
import PrivateRoute from "./components/PrivateRoute";

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
          <Route path="/workorders/edit/:id" element={<EditWorkOrderPage />} />
          <Route path="/assets/edit/:id" element={<EditAssetPage />} />
        </Routes>
      </Router>
    </>
  );
}
