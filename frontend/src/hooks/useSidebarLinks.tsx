import { FaTachometerAlt, FaBoxes, FaClipboardList, FaTools, FaUserShield, FaUbuntu, FaAtlas } from "react-icons/fa";
import { ReactElement } from "react";

interface SidebarLink {
  to: string;
  label: string;
  icon: ReactElement;
}

export const useSidebarLinks = (role: "admin" | "technician" | "customer" | "viewer"): SidebarLink[] => {

  if (role === "customer") {
    return [
      { to: "/contracts/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },
      { to: "/contracts/assets", label: "Assets", icon: <FaBoxes /> },
      { to: "/contracts", label: "Contracts", icon: <FaAtlas /> },
    ];
  }
  
  const commonLinks: SidebarLink[] = [
    { to: "/dashboard", label: "Home", icon: <FaTachometerAlt /> },
    { to: "/assets", label: "Assets", icon: <FaBoxes /> },
    { to: "/workorders", label: "Work Orders", icon: <FaClipboardList /> },
    { to: "/parts", label: "Parts", icon: <FaTools /> },
    { to: "/templates", label: "Templates", icon: <FaUbuntu /> },
    { to: "/contracts", label: "Contracts", icon: <FaAtlas /> },
  ];

  const adminLinks: SidebarLink[] = [
    { to: "/admin", label: "Admin", icon: <FaUserShield /> },
  ];

  if (role === "admin") return [...commonLinks, ...adminLinks];
  return commonLinks;
};
