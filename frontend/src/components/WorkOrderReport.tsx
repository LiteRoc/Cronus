import React, { useEffect, useState, useRef } from "react";
import { getAssetById } from "../services/api";
import { WorkOrder, Asset } from "../types/types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

  interface WorkOrderReportProps {
    workOrder: WorkOrder;
  }

  const WorkOrderReport: React.FC<WorkOrderReportProps> = ({ workOrder }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [asset, setAsset] = useState<Asset | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
  
    useEffect(() => {
      const fetchAsset = async () => {
        if (!workOrder.assetId) return;
        try {
          const assetId = workOrder.assetId.toString();
          setLoading(true);
          const fetchedAsset = await getAssetById(assetId);
          setAsset(fetchedAsset);
        } catch (err) {
          console.error("Failed to fetch asset:", err);
          setError("Failed to load asset details.");
        } finally {
          setLoading(false);
        }
      };
  
      fetchAsset();
    }, [workOrder.assetId]);

    const downloadPdf = async () => {
      if (!reportRef.current) return;
  
      const canvas = await html2canvas(reportRef.current);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`WorkOrder_${workOrder.workOrderNumber}.pdf`);
    };
  
    if (loading) return <p>Loading asset details...</p>;
    if (error) return <p>{error}</p>;

    return (
      <div>
        <button onClick={downloadPdf} style={{ marginBottom: "20px" }}>
        Download PDF
      </button>
      
      <div ref={reportRef} style={styles.container}>
          {/* Header Section */}
          {/*<div style={styles.header}>
            <h1 style={styles.title}>Service Report</h1>
            <p style={styles.subHeader}>
              Work Order #: {workOrder.workOrderNumber} <br />
              Status: {workOrder.status} <br />
              Scheduled Date: {new Date(workOrder.scheduledDate).toLocaleDateString()} <br />
              Completion Date:{" "}
              {workOrder.completionDate
                ? new Date(workOrder.completionDate).toLocaleDateString()
                : "Not Completed"}
            </p>
          </div>*/}

<div id="workOrderReport" style={{ padding: "20px", backgroundColor: "#fff" }}>
  <h1>Service Report</h1>
  <p>
    <strong>Work Order #: </strong> {workOrder.workOrderNumber}
  </p>
  <p>
    <strong>Status: </strong> {workOrder.status}
  </p>
  <p>
    <strong>Scheduled Date: </strong>
    {new Date(workOrder.scheduledDate).toLocaleDateString()}
  </p>
  {/* Add other sections like Asset Details, Tasks, etc. */}
  {/* Asset Details */}
  <div ref={reportRef} style={styles.section}>
            <h2 style={styles.sectionTitle}>Asset Details</h2>
            <p><strong>Control Number:</strong> {asset?.ctrlNumber}</p>
            <p><strong>Manufacturer:</strong> {asset?.manufacturer}</p>
            <p><strong>Model:</strong> {asset?.model}</p>
            <p><strong>S/N:</strong> {asset?.serialNumber}</p>
          </div>
</div>


          {/* Asset Details */}
          <div ref={reportRef} style={styles.section}>
            <h2 style={styles.sectionTitle}>Asset Details</h2>
            <p><strong>Control Number:</strong> {asset?.ctrlNumber}</p>
            <p><strong>Manufacturer:</strong> {asset?.manufacturer}</p>
            <p><strong>Model:</strong> {asset?.model}</p>
            <p><strong>S/N:</strong> {asset?.serialNumber}</p>
          </div>

          {/* Description Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Description</h2>
            <p>{workOrder.description}</p>
          </div>

          {/* Time & Travel Logs */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Time Log</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Date Performed</th>
                  <th style={styles.tableHeader}>Notes</th>
                  <th style={styles.tableHeader}>Time in minutes</th>
                  <th style={styles.tableHeader}>Tech</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.timeLogs.map((time, index) => (
                  <tr key={index}>
                    <td style={styles.tableCell}>
                      {time.timestamp
                        ? new Date(time.timestamp).toLocaleDateString()
                        : "No time stamp"}
                    </td>
                    <td style={styles.tableCell}>{time.description}</td>
                    <td style={styles.tableCell}>{time.timeSpent}</td>
                    <td style={styles.tableCell}>{time.userId.username}</td>
                    </tr>
                ))}
              </tbody>
            </table>
            <h2 style={styles.sectionTitle}>Travel Log</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Date Traveled</th>
                  <th style={styles.tableHeader}>Time in minutes</th>
                  <th style={styles.tableHeader}>Tech</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.travelLogs.map((travel, index) => (
                  <tr key={index}>
                    <td style={styles.tableCell}>
                      {travel.timestamp
                        ? new Date(travel.timestamp).toLocaleDateString()
                        : "No Trave Time"}
                    </td>
                    <td style={styles.tableCell}>{travel.travelTime}</td>
                    <td style={styles.tableCell}>{travel.userId.username}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tasks Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Tasks</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Task</th>
                  <th style={styles.tableHeader}>Result</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.procedure?.tasks?.map((task) => {
                  const taskResult = (workOrder.procedure?.taskResults || []).find(
                    (result) => result.taskId === task._id
                  );
                  return (
                    <tr key={task._id}>
                      <td style={styles.tableCell}>{task.description || "No description available"}</td>
                      <td style={styles.tableCell}>
                        {taskResult
                          ? typeof taskResult.result === "boolean"
                            ? taskResult.result
                              ? "Pass"
                              : "Fail"
                            : `Measurment: ${taskResult.result || "N/A"}`
                          : "Not Result"}
                      </td>
                      <td style={styles.tableCell}>
                        {taskResult?.timestamp
                          ? new Date(taskResult.timestamp).toLocaleDateString()
                          : "No timestamp"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Parts Used Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Parts Used</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Part</th>
                  <th style={styles.tableHeader}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.partsUsed.map((part) => (
                  <tr key={part.partId._id}>
                    <td style={styles.tableCell}>
                      {part.partId.partNumber} - {part.partId.description}
                    </td>
                    <td style={styles.tableCell}>{part.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Section */}
          <div style={styles.footer}>
            <p>Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        </div>
    );
  };

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    margin: "0 auto",
    padding: "1.5rem",
    maxWidth: "90%",
    maxHeight: "75vh",
    border: "1px solid #ccc",
    borderRadius: "8px",
    backgroundColor: "#fff",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  subHeader: {
    fontSize: "14px",
    color: "#555",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    borderBottom: "2px solid #000",
    marginBottom: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  tableHeader: {
    borderBottom: "2px solid #000",
    textAlign: "left" as const,
    padding: "8px",
    fontWeight: "bold",
  },
  tableCell: {
    borderBottom: "1px solid #ccc",
    padding: "8px",
  },
  footer: {
    textAlign: "center" as const,
    marginTop: "20px",
    fontSize: "12px",
    color: "#555",
  },
};

export default WorkOrderReport;