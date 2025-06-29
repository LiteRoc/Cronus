import React from "react";
import { useNavigate } from "react-router-dom";
import WorkOrderChart from "./WorkOrderChart";
import AssetChart from "./AssetChart";
import PartsChart from "./PartsChart";
import TechnicianChart from "./TechnicianChart";
import {
  WorkOrderSummary,
  AssetSummary,
  PartsSummary,
  TechnicianPerformance
} from "../../../types/types";

interface Props {
  workOrdersSummary: WorkOrderSummary;
  assetSummary: AssetSummary;
  partsSummary: PartsSummary;
  technicianPerformance: TechnicianPerformance[];
}

const Charts: React.FC<Props> = ({
  workOrdersSummary,
  assetSummary,
  partsSummary,
  technicianPerformance,
}) => {
  const navigate = useNavigate();

  const handleChartClick = (
    type: "workOrders" | "assets",
    status: string
  ) => {
    navigate(`/${type}?status=${encodeURIComponent(status)}`);
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      <WorkOrderChart workOrdersSummary={workOrdersSummary} onClick={(status) => handleChartClick("workOrders", status)} />
      <AssetChart assetSummary={assetSummary} onClick={(status: string) => handleChartClick("assets", status)} />
      <PartsChart partsSummary={partsSummary} />
      <TechnicianChart technicianPerformance={technicianPerformance} />
    </div>
  );
};

export default Charts;