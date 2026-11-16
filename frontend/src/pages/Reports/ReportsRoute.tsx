import { Navigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import ReportsPage from './ReportsPage';
export const canAccessReports = (role: string | null | undefined) => role === 'admin' || role === 'technician';
export default function ReportsRoute() {
  const { user } = useUser();
  return canAccessReports(user?.role) ? <ReportsPage /> : <Navigate to="/dashboard" replace />;
}
