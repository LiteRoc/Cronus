import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import ContactsPage from "./ContactsPage";

export const canAccessContactUI = (role: string | null | undefined) =>
  role === "admin" || role === "technician";

export default function ContactRoute({ content }: { content?: ReactElement }) {
  const { user } = useUser();
  if (!canAccessContactUI(user?.role)) return <Navigate to="/dashboard" replace />;
  return content ?? <ContactsPage />;
}
