// src/pages/Contracts/ContractsLayout.tsx

import React from "react";
import { Outlet } from "react-router-dom";

const ContractsLayout: React.FC = () => {
  /*const navItems = [
    { name: "Dashboard", path: "/contracts/dashboard" },
    { name: "Assets", path: "/contracts/assets" },
    { name: "Contracts", path: "/contracts" },
  ];*/

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {/*<aside className="w-64 bg-white shadow-lg p-6">
        <h1 className="text-xl font-semibold mb-6 text-blue-700">Cronus Portal</h1>
        <nav className="space-y-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg ${
                  isActive ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>*/}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default ContractsLayout;
