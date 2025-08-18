import React, { useEffect, useState } from "react";
import { Asset, Procedure } from "../../../types/types";
import { fetchProcdures } from "../../../services/assetAPI";
import Modal from "../../../components/Modal";

interface Props {
  schedule: Asset["maintenanceSchedule"];
  onChange: (field: string, value: any) => void;
}

const MaintenanceScheduleForm: React.FC<Props> = ({ schedule, onChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>();
  const [formData, setFormData] = useState({
    procedure: "",
    frequency: "Yearly",
    nextMaintenance: "",
    lastMaintenance: "",
  });

  useEffect(() => {
    fetchProcdures()
      .then ((res) => setProcedures(res))
      .catch((err) => console.error("Error fetching procedures:", err));
  }, []);

  const handleAddSchedule = () => {
    const selectedProcedure = procedures?.find(p => p._id === formData.procedure);

    onChange("maintenanceSchedule", {
      ...formData,
      procedure: selectedProcedure || formData.procedure, // <-- attach full object now
    });

    setIsModalOpen(false);
  };


  if (!schedule) {
    return (
      <div className="mt-6 border-t pt-4">
        <h3 className="text-lg font-semibold mb-2">Maintenance Schedule</h3>
        <p className="text-gray-600">No maintenance schedule defined for this asset.</p>
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setIsModalOpen(true)}
        >
          + Add Schedule
        </button>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Maintenance Schedule">
          <div className="space-y-4">
            <div>
              <label className="block font-semibold">Procedure</label>
              <select
                value={formData.procedure}
                onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
                className="w-full border p-2"
              >
                <option value="">Select Procedure</option>
                {procedures?.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full border p-2"
              >
                <option value="Yearly">Yearly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold">Next Maintenance Date</label>
              <input
                type="date"
                value={formData.nextMaintenance}
                onChange={(e) => setFormData({ ...formData, nextMaintenance: e.target.value })}
                className="w-full border p-2"
              />
            </div>

            <div>
              <label className="block font-semibold">Last Maintenance Date</label>
              <input
                type="date"
                value={formData.lastMaintenance}
                onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                className="w-full border p-2"
              />
            </div>

            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
                Cancel
              </button>
              <button onClick={handleAddSchedule} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Save Schedule
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  } else {
    return (
      <div className="mt-6 border-t pt-4">
        <h3 className="text-lg font-semibold mb-2">Maintenance Schedule</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-sm">Frequency</label>
            <p className="text-gray-700">{schedule.frequency || "—"}</p>
          </div>

          <div>
            <label className="block font-semibold text-sm">Next Maintenance</label>
            <p className="text-gray-700">{schedule.nextMaintenance?.slice(0, 10) || "—"}</p>
          </div>

          <div>
            <label className="block font-semibold text-sm">Last Maintenance</label>
            <p className="text-gray-700">{schedule.lastMaintenance?.slice(0, 10) || "—"}</p>
          </div>

          <div>
            <label className="block font-semibold text-sm">Procedure</label>
            {typeof schedule.procedure === "object" ? (
              <>
                <p className="text-gray-700">{schedule.procedure.name}</p>
                <p className="text-sm text-gray-500">
                  {schedule.procedure.tasks?.length || 0} task(s)
                </p>
              </>
            ) : (
              <p className="text-gray-700 italic">Unlinked procedure</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setFormData({
                procedure: typeof schedule.procedure === "object" ? schedule.procedure._id : schedule.procedure || "",
                frequency: schedule.frequency || "Yearly",
                nextMaintenance: schedule.nextMaintenance?.slice(0, 10) || "",
                lastMaintenance: schedule.lastMaintenance?.slice(0, 10) || "",
              });
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            ✏ Edit
          </button>

          <button
            onClick={() => onChange("maintenanceSchedule", null)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑 Delete
          </button>
        </div>

        {/* Modal for Edit */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Maintenance Schedule">
          <div className="space-y-4">
            <div>
              <label className="block font-semibold">Procedure</label>
              <select
                value={formData.procedure}
                onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
                className="w-full border p-2"
              >
                <option value="">Select Procedure</option>
                {procedures?.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full border p-2"
              >
                <option value="Yearly">Yearly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold">Next Maintenance Date</label>
              <input
                type="date"
                value={formData.nextMaintenance}
                onChange={(e) => setFormData({ ...formData, nextMaintenance: e.target.value })}
                className="w-full border p-2"
              />
            </div>

            <div>
              <label className="block font-semibold">Last Maintenance Date</label>
              <input
                type="date"
                value={formData.lastMaintenance}
                onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                className="w-full border p-2"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
                Cancel
              </button>
              <button onClick={handleAddSchedule} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
};

export default MaintenanceScheduleForm;