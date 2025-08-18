import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {getTemplates, getManufactures } from "../../services/templateAPI";

interface EquipmentTemplate {
  _id: string;
  manufacturer: string;
  model: string;
  description: string;
  verified: boolean;
  updatedAt?: string;
}

const TemplateListPage: React.FC = () => {
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 25;
  const [sortBy, setSortBy] = useState("manufacturer");
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
    fetchManufacturers();
  }, [search, manufacturer, verifiedOnly, sortBy, currentPage]);

  const fetchTemplates = async () => {
    try {
      const params: any = {
        q: search || undefined,
        manufacturer: manufacturer || undefined,
        skip: (currentPage - 1) * limit,
        limit,
      };

      const { templates: fetchedTemplates, totalCount } = await getTemplates(params);
      //console.log("Fetched templates:", fetchedTemplates);

      const filtered = verifiedOnly ? templates.filter((t: { verified: any; }) => t.verified) : fetchedTemplates;

      setTemplates(filtered);
      setTotalPages(Math.ceil(totalCount / limit));
    } catch (err) {
      console.error("Error fetching templates", err);
    }
  };

  const fetchManufacturers = async () => {
    try {
      const res = await getManufactures();
      setManufacturers(res);
    } catch (error) {
      console.error("Failed to fetch manufacturers", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by model, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 rounded"
        />

        <select
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">All Manufacturers</option>
          {manufacturers.map((mfr) => (
            <option key={mfr} value={mfr}>
              {mfr}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={() => setVerifiedOnly(!verifiedOnly)}
          />
          FDA Verified Only
        </label>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="manufacturer">Sort by Manufacturer</option>
          <option value="model">Sort by Model</option>
          <option value="updatedAt">Sort by Last Updated</option>
        </select>

        <button
          onClick={() => navigate("/templates/new")}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          ➕ Create New Template
        </button>
      </div>

      <table className="w-full table-auto border mt-4">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Manufacturer</th>
            <th className="p-2">Model</th>
            <th className="p-2">Description</th>
            <th className="p-2">Verified</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((tpl) => (
            <tr
              key={tpl._id}
              className="border-t hover:bg-gray-100 cursor-pointer"
              onClick={() => navigate(`/templates/edit/${tpl._id}`)}
            >
              <td className="p-2">{tpl.manufacturer}</td>
              <td className="p-2">{tpl.model}</td>
              <td className="p-2">{tpl.description}</td>
              <td className="p-2">
                {tpl.verified ? (
                  <span className="text-green-700 font-semibold">✅ FDA</span>
                ) : (
                  <span className="text-gray-500 italic">Manual</span>
                )}
              </td>
              {/* Add Duplicate Flag */}
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                No templates found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          ◀ Prev
        </button>

        <span className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded border disabled:opacity-50"
        >
          Next ▶
        </button>
      </div>
    </div>
  );
};

export default TemplateListPage;