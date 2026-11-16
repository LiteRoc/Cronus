import { Navigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import ReportsPage from './ReportsPage';
import type { ReactElement } from 'react';
export const canAccessReports = (role: string | null | undefined) => role === 'admin' || role === 'technician';
export default function ReportsRoute({ content }: { content?: ReactElement }) {
  const { user } = useUser();
  return canAccessReports(user?.role) ? content ?? <ReportsPage /> : <Navigate to="/dashboard" replace />;
}
