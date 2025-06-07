import React, { useState, useEffect } from "react";
import Charts from "./Charts";
import FilteredData from "./FilteredData";
import EditWorkOrderModal from "./modals/EditWorkOrderModal";
import CreateWorkOrderModal from "./modals/CreateWorkOrderModal";
import { fetchDashboardData, updateWorkOrder } from "../../services/api";
import { Asset, WorkOrder, DashboardData, Part } from "../../types/types";
import api from "../../services/api"
import { isWorkOrderArray, isAssetArray } from "../../utils/typeGuards";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { FaTools, FaBoxes, FaUserShield, FaClipboardList } from 'react-icons/fa';

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filteredData, setFilteredData] = useState<{
    type: "workOrders" | "assets";
    items: WorkOrder[] | Asset[];
  } | null>(null);
  const [editItem, setEditItem] = useState<WorkOrder | Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  //const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const navigate = useNavigate();

  // Fetch data
  useEffect(() => {
    console.log('Updated Filtered Data:', filteredData);
    const fetchData = async () => {
      setLoading(true);
      try {
        const dashboardData = await fetchDashboardData();
        setData(dashboardData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filteredData]);

  // Event Handlers
  const onFilter = (type: "workOrders" | "assets", items: WorkOrder[] | Asset[]) => {
    console.log('Type:', type);
    console.log("onFilter called with items:", items);
  
    if (type === "workOrders" && isWorkOrderArray(items)) {
      setFilteredData({ type, items });
    } else if (type === "assets" && isAssetArray(items)) {
      setFilteredData({ type, items });
    } else {
      console.error("Invalid items passed to onFilter.");
      setFilteredData(null);
    }
  };

  const handleEdit = (item: WorkOrder | Asset | Part) => {
    if ("workOrderNumber" in item) {
      setEditItem(item as WorkOrder);
      console.log('Edit work order:', item);
      navigate(`/workorders/edit/${item._id}`)
    } else if ("ctrlNumber" in item) {
      // Handle editing an Asset
      setEditItem(item as Asset);
      console.log('Edit Asset:', item);
      navigate(`/assets/edit/${item._id}`);
      console.log("Edit Asset:", item);
    } else if ("partNumber" in item) {
      // Handle editing a Part
      console.log("Edit Part:", item);
    }
  };
  
  const handleDelete = (id: string) => {
    setFilteredData((prev) => {
      if (!prev) return null;
    
      // Handle workOrders
      if (prev.type === "workOrders") {
        const filteredItems = prev.items.filter(
          (item) => (item as WorkOrder)._id !== id
        ) as WorkOrder[];
        return { ...prev, items: filteredItems };
      }
    
      // Handle assets
      if (prev.type === "assets") {
        const filteredItems = prev.items.filter(
          (item) => (item as Asset)._id !== id
        ) as Asset[];
        return { ...prev, items: filteredItems };
      }
    
      return null;
    });    
    // Call the delete API here
  };

  const handleSave = async (updatedWorkOrder: WorkOrder) => {
    try {
      const savedWorkOrder = await updateWorkOrder(updatedWorkOrder._id, updatedWorkOrder);
      console.log('Scheduled Date to Save:', updatedWorkOrder.scheduledDate);
      // Update the filtered data state
      setFilteredData((prev) => {
        if (!prev || prev.type !== "workOrders") return prev;

        const updatedItems = (prev.items as WorkOrder[]).map((item) =>
          item._id === savedWorkOrder._id ? savedWorkOrder : item
        );

        return { ...prev, items: updatedItems };
      });
  
      setEditItem(null); // Close the modal
      // Show a success toast notification
      toast.success("Work order saved successfully!", {
        position: "top-right",
        autoClose: 3000, // 3 seconds
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
      });
    } catch (error) {
      console.error("Failed to save work order:", error);
      // Show an error toast notification
      toast.error("Failed to save changes. Please try again.", {
        position: "top-right",
        autoClose: 5000, // 5 seconds
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
      });
    }
  };
  
  const handleCreateWorkOrder = async (asset: Asset) => {
    setSelectedAsset(asset);
    setShowCreateModal(true);
  };

  const handleCreateWorkOrderFromModal = async (newWorkOrder: WorkOrder) => {
    try {
      const response = await api.post("/workorders", newWorkOrder, {
        headers: { "Content-Type": "application/json" },
      });
  
      console.log("Work order created from modal:", response.data);
      alert("Work order created successfully!");
  
      // Optionally, update the state with the new work order
      setFilteredData((prev) => {
        if (!prev) return null;
        if (prev.type === "workOrders") {
          return {
            ...prev,
            items: [...(prev.items as WorkOrder[]), response.data],
          };
        }
        return prev;
      });
  
      setShowCreateModal(false); // Close the modal after creation
    } catch (error) {
      console.error("Error creating work order from modal:", error);
      alert("Failed to create work order.");
    }
  };  

  const handleCloseModal = () => setEditItem(null);
  const handleCloseCreateModal = () => setShowCreateModal(false);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-4">
        <div className="text-2xl font-bold mb-6">AegisOps</div>
        <nav className="flex flex-col space-y-3">
          <Link to="/assets" className="flex items-center hover:bg-gray-700 p-2 rounded">
            <FaBoxes className="mr-2" /> Assets
          </Link>
          <Link to="/workorders" className="flex items-center hover:bg-gray-700 p-2 rounded">
            <FaClipboardList className="mr-2" /> Work Orders
          </Link>
          <Link to="/parts" className="flex items-center hover:bg-gray-700 p-2 rounded">
            <FaTools className="mr-2" /> Parts
          </Link>
          <Link to="/admin" className="flex items-center hover:bg-gray-700 p-2 rounded">
            <FaUserShield className="mr-2" /> Admin
          </Link>
        </nav>
      </aside>

      {/* Main dashboard content */}
      <main className="flex-1 p-6 bg-gray-100">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

        {/* Charts Section */}
        {data && <Charts
          data={data}
          onFilter={onFilter} 
          />
        }
      

        {/* Filtered Data Section */}
        {filteredData && (
          <FilteredData
            type={filteredData.type}
            items={filteredData?.items || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateWorkOrder={handleCreateWorkOrder}
          />
          )
        }

        {editItem && (
          <div className="relative z-40">
            <EditWorkOrderModal
              workOrder={editItem as WorkOrder}
              onClose={handleCloseModal}
              onSave={handleSave}
            />
          </div>
        )}


        {/* Create Work Order Modal */}
        {showCreateModal && selectedAsset && (
          <CreateWorkOrderModal
            asset={selectedAsset}
            onClose={handleCloseCreateModal}
            onCreate={handleCreateWorkOrderFromModal}
          />
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
