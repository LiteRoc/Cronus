import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import FollowUpsPage from "./FollowUpsPage";

export const canAccessFollowUpUI = (role: string | null | undefined) =>
  role === "admin" || role === "technician";

export default function FollowUpRoute({ content }: { content?: ReactElement }) {
  const { user } = useUser();
  if (!canAccessFollowUpUI(user?.role)) return <Navigate to="/dashboard" replace />;
  return content ?? <FollowUpsPage />;
}
