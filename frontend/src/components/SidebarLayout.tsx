import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { logoutUser } from '../services/authAPI';
import { useUser } from '../context/UserContext';
import { useFacility } from '../context/FacilityContext';
import { useSidebarLinks } from '../hooks/useSidebarLinks';

const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useUser() || {};
  const normalizedRole = (() => {
    if (user?.role === "tech") return "technician";
    if (user?.role === "admin" || user?.role === "customer" || user?.role === "viewer") {
      return user.role;
    }
    return "viewer";
  })();
  const links = useSidebarLinks(normalizedRole);
  const { selectedFacilityId, setSelectedFacilityId, availableFacilities } = useFacility();
  //console.log("availableFacilities:", availableFacilities);

  const handleFacilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedFacilityId(newId); // ✅ this will now also save to localStorage
  };

  //const name = user?.name;
  const username = user?.username;

  const linkClasses = (path: string) =>
    `flex items-center p-2 rounded hover:bg-gray-700 ${
      location.pathname.startsWith(path) ? 'bg-gray-700 font-semibold' : ''
    }`;

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    navigate('/signin');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col justify-between p-4 h-screen overflow-hidden">
        {/* Top section (welcome + nav) */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Welcome, {username}</h1>

          {(user?.role === "admin" || normalizedRole === "technician") && (
            <p className="text-xs text-gray-400 italic mb-4">{user?.role}</p>
          )}
          {/* Facility switcher */}
          {availableFacilities.length > 1 && (
            <div className="mb-4">
              <label htmlFor="facility" className="block text-xs text-gray-400 mb-1">
                Current Facility:
              </label>
              <select
                id="facility"
                className="w-full p-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedFacilityId || ""}
                onChange={handleFacilityChange}
              >
                {availableFacilities.map((facility) => (
                  <option key={facility._id} value={facility._id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/*<div className="text-2xl font-bold mb-6">Cronus</div>*/}
          <nav className="flex flex-col space-y-2">
            {links.map(({ to, label, icon }) => (
              <Link key={to} to={to} className={linkClasses(to)}>
                {icon} {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom section (logout) */}
        <div className="pt-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center py-2 px-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>


      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto p-6 bg-gray-100">{children}</main>
    </div>
  );
};

export default SidebarLayout;