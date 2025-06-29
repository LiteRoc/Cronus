import { FaBoxes, FaClipboardList, FaTools, FaUserShield } from "react-icons/fa";
import { ReactElement } from "react";

interface SidebarLink {
  to: string;
  label: string;
  icon: ReactElement;
}

export const useSidebarLinks = (role: "admin" | "technician" | "viewer"): SidebarLink[] => {
  const commonLinks: SidebarLink[] = [
    { to: "/assets", label: "Assets", icon: <FaBoxes /> },
    { to: "/workorders", label: "Work Orders", icon: <FaClipboardList /> },
    { to: "/parts", label: "Parts", icon: <FaTools /> },
  ];

  const adminLinks: SidebarLink[] = [
    { to: "/admin", label: "Admin", icon: <FaUserShield /> },
  ];

  if (role === "admin") return [...commonLinks, ...adminLinks];
  return commonLinks;
};