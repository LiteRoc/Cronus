import jsPDF from "jspdf";
import "jspdf-autotable";
import { WorkOrder, Asset } from "../types/types";

export const generateWorkOrderPDF = (workOrder: WorkOrder, asset: Asset | null) => {
  const pdf = new jsPDF({
    orientation: "p",
    unit: "in", // Use inches for letter-sized page
    format: [8.5, 11], // 8.5 x 11 inches
  });

  const pageWidth = 8.5;
  let currentY = 1; // Start at 1 inch from top

  // **Title (Centered)**
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Service Report", pageWidth / 2, currentY, { align: "center" });
  currentY += 0.3;

  // **Work Order Details**
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");

  const leftX = 0.5;
  const midX = pageWidth / 2;

  pdf.text(`Scheduled Date: ${
      workOrder.scheduledDate ? new Date(workOrder.scheduledDate).toLocaleDateString() : "N/A"
    }`, leftX, currentY);
  pdf.text(`Work Order #: ${workOrder.workOrderNumber}`, pageWidth / 2, currentY, { align: "center" });
  pdf.text(`Status: ${workOrder.status || "N/A"}`, pageWidth - 0.5, currentY, { align: "right"});
  currentY += 0.3;

  pdf.text(`Completion Date: ${
      workOrder.completionDate ? new Date(workOrder.completionDate).toLocaleDateString() : "Not Completed"
    }`, pageWidth - 0.5, currentY, { align: "right"});
  pdf.text(`Description: ${workOrder.description}`, leftX, currentY);
  currentY += 0.3;

  //currentY += 0.3;
  
  //currentY += 0.3;

  pdf.setLineWidth(0.01); // Set line width
  pdf.line(leftX, currentY, pageWidth - 0.5, currentY);
  currentY += 0.2;

  // **Asset Details**
  if (asset) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Asset Details:", leftX, currentY);
    currentY += 0.3;

    pdf.setFontSize(12);
    pdf.text(`Control Number: ${asset.ctrlNumber}`, leftX, currentY);
    //currentY += 0.3;
    pdf.text(`Manufacturer: ${asset.manufacturer}`, midX, currentY);
    currentY += 0.3;
    
    pdf.text(`S/N: ${asset.serialNumber || "N/A"}`, leftX, currentY);
    pdf.text(`Model: ${asset.model}`, midX, currentY);
    currentY += 0.3;
    
    //currentY += 0.3;
  }

  pdf.line(leftX, currentY, pageWidth - 0.5, currentY);
  currentY += 0.2;

  // **Time Logs**
  if (workOrder.timeLogs?.length) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Time Logs:", leftX, currentY);
    currentY += 0.3;

    const logs = workOrder.timeLogs.map((log) => [
      new Date(log.timestamp || "").toLocaleDateString(),
      log.timeSpent || "N/A",
      log.description || "N/A",
    ]);

    pdf.autoTable({
      head: [["Date", "Time Spent (min)", "Description"]],
      body: logs,
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
      margin: { left: leftX, right: 0.5 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 0.5;
  }

  // **Travel Logs**
  if (workOrder.travelLogs?.length) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Travel Logs:", leftX, currentY);
    currentY += 0.3;

    const logs = workOrder.travelLogs.map((log) => [
      new Date(log.timestamp || "").toLocaleDateString(),
      log.travelTime || "N/A",
    ]);

    pdf.autoTable({
      head: [["Date", "Time Spent (min)"]],
      body: logs,
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
      margin: { left: leftX, right: 0.5 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 0.5;
  }

  // **Parts Used**
  if (workOrder.partsUsed?.length) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Parts Used:", leftX, currentY);
    currentY += 0.3;

    const parts = workOrder.partsUsed.map((part) => [
      part.partId.partNumber,
      part.partId.description,
      part.quantity,
      `$${part.partId.price?.toFixed(2)}`,
    ]);

    pdf.autoTable({
      head: [["Part Number", "Description", "Quantity", "Unit Price"]],
      body: parts,
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
      margin: { left: leftX, right: 0.5 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 0.5;
  }

  pdf.line(leftX, currentY, pageWidth - 0.5, currentY);
  currentY += 0.2;

  // **Procedure Name**
  if (workOrder.procedure?.name) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Procedure:", leftX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(workOrder.procedure.name, leftX + 1.5, currentY);
    currentY += 0.5;
  }

  // **Task Results**
  if (workOrder.procedure?.tasks?.length) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Task Results:", leftX, currentY);
    currentY += 0.3;

    const taskResults = workOrder.taskResults || [];
    const taskData = workOrder.procedure.tasks.map((task) => {
      const result = taskResults.find((res) => res.taskId === task._id);
      return [
        task.description,
        task.type,
        result
          ? typeof result.result === "boolean"
            ? result.result ? "Pass" : "Fail"
            : result.result
          : "Pending",
        result?.timestamp ? new Date(result.timestamp).toLocaleDateString() : "No timestamp",
      ];
    });

    pdf.autoTable({
      head: [["Task Description", "Type", "Result", "Timestamp"]],
      body: taskData,
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
      margin: { left: leftX, right: 0.5 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 0.5;
  }

  

  // **Test Equipment Used**
  if (workOrder.testEquipmentUsed?.length) {
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Test Equipment Used:", leftX, currentY);
    currentY += 0.3;

    const equipment = workOrder.testEquipmentUsed.map((eq) => [
      eq.ctrlNumber,
      eq.manufacturer,
      eq.model
      //eq.calibrationDate ? new Date(eq.calibrationDate).toLocaleDateString() : "N/A",
    ]);

    pdf.autoTable({
      head: [["Equipment ID", "Equipment Name", "Model"]],
      body: equipment,
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [0, 123, 255] },
      margin: { left: leftX, right: 0.5 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 0.5;
  }

  // **Footer**
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "italic");
  pdf.text(`Generated on: ${new Date().toLocaleDateString()} - Your Company Name`, leftX, 10.5);

  // **Save PDF**
  pdf.save(`Work_Order_${workOrder.workOrderNumber}.pdf`);
};