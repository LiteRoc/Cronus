import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaTools, FaBoxes, FaUserShield, FaClipboardList, FaFileContract } from 'react-icons/fa';

const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const linkClasses = (path: string) =>
    `flex items-center p-2 rounded hover:bg-gray-700 ${
      location.pathname.startsWith(path) ? 'bg-gray-700 font-semibold' : ''
    }`;

    console.log('SIDEBAR route is:', location.pathname);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-4">
        <div className="text-2xl font-bold mb-6">AegisOps</div>
        <nav className="flex flex-col space-y-3">
          <Link to="/assets" className={linkClasses('/assets')}>
            <FaBoxes className="mr-2" /> Assets
          </Link>
          <Link to="/workorders" className={linkClasses('/workorders')}>
            <FaClipboardList className="mr-2" /> Work Orders
          </Link>
          <Link to="/parts" className={linkClasses('/parts')}>
            <FaTools className="mr-2" /> Parts
          </Link>
          <p className="text-xs font-semibold text-gray-500 mt-6 mb-2 px-3">Management</p>
          <Link to="/contracts" className="flex items-center p-2 rounded bg-red-600 text-white">
            <FaFileContract className="mr-2" /> Contracts
          </Link>
          {/*<Link to="/contracts" className={linkClasses('/contracts')}>
            <FaFileContract className="mr-2" /> Contracts
          </Link>*/}
          <Link to="/admin" className={linkClasses('/admin')}>
            <FaUserShield className="mr-2" /> Admin
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-100">{children}</main>
    </div>
  );
};

export default SidebarLayout;