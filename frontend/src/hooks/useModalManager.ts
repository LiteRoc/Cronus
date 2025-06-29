import { useState } from "react";
import { WorkOrder, Asset } from "../types/types";

export const useModalManager = () => {
  const [editItem, setEditItem] = useState<WorkOrder | Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const openEditModal = (item: WorkOrder | Asset) => {
    setEditItem(item);
  };

  const closeEditModal = () => setEditItem(null);

  const openCreateModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setSelectedAsset(null);
    setShowCreateModal(false);
  };

  return {
    editItem,
    showCreateModal,
    selectedAsset,
    openEditModal,
    closeEditModal,
    openCreateModal,
    closeCreateModal,
  };
};