import React, { useState } from "react";
import { useAssets } from "./hooks/useAssets";
import { Button } from "@/components/ui";
import FilteredAssetControls from "./components/FilteredAssetControls";
import AssetTable from "./components/AssetTable";
import CreateAssetModal from "../AddAsset/modals/CreateAssetModal";
import Pagination from "../../components/Pagination";

const FilteredAssetPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { assets, totalPages, totalCount, pagination, setPagination, isLoading, error, refresh } = useAssets();

  if (error) return <div className="p-4 text-red-500">Failed to load assets</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Assets</h1>

      <div className="p-6">
        <FilteredAssetControls />
      </div>

      <CreateAssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={() => refresh()}/>

      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Add Asset
        </Button>
      </div>

      {isLoading ? <div>Loading assets...</div> : <AssetTable assets={assets} />}

      <Pagination
        page={pagination.page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pagination.pageSize}
        onPageChange={(newPage) => setPagination({ page: newPage })}
        onPageSizeChange={(newSize) =>
          setPagination({ page: 1, pageSize: newSize }) // reset to first page when size changes
        }
      />
    </div>
  );
};

export default FilteredAssetPage;