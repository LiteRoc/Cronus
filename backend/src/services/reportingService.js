const { PDFDocument, StandardFonts } = require('pdf-lib');
const ExcelJS = require('exceljs');

const generatePDF = async (data, title) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add title
    const fontSize = 18;
    let yPosition = height - 50;
    page.drawText(title, { x: 50, y: yPosition, size: fontSize, font });
    yPosition -= 30;

    // Add table headers
    page.drawText('Work Order ID | Description | Status | Assigned To | Scheduled Date', {
        x: 50,
        y: yPosition,
        size: 10,
        font,
    });
    yPosition -= 20;

    // Add table rows
    for (const item of data) {
        const text = `${item._id} | ${item.description} | ${item.status} | ${item.assignedTo?.username || 'Unassigned'} | ${item.scheduledDate || 'N/A'}`;
        page.drawText(text, { x: 50, y: yPosition, size: 10, font });
        yPosition -= 15;

        if (yPosition < 50) {
            page = pdfDoc.addPage();
            yPosition = height - 50;
        }
    }

    return pdfDoc.save();
};

const generateWorkOrderReport = async (workOrders, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Orders');

    // Define columns dynamically
    worksheet.columns = [
        { header: 'Work Order#', key: 'workOrderNumber', width: 20 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Assigned To', key: 'assignedTo', width: 25 },
        { header: 'Scheduled Date', key: 'scheduledDate', width: 20 },
        { header: 'Completion Date', key: 'completionDate', width: 20 },
    ];

    // Add rows dynamically
    workOrders.forEach((order) => {
        worksheet.addRow({
            workOrderNumber: order.workOrderNumber,
            description: order.description,
            status: order.status,
            assignedTo: order.assignedTo?.username || 'Unassigned',
            scheduledDate: order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : '',
            completionDate: order.completionDate ? new Date(order.completionDate).toLocaleDateString() : '',
        });
    });

    // Stream the workbook to the response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=work_orders.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
};

// Generates a single WO Report
const generateWorkOrderPDF = async (workOrder) => {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const filePath = path.join(__dirname, `../../reports/Work_Order_${workOrder.workOrderNumber}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add Header with Logo
    doc.image(path.join(__dirname, '../../assets/logo.png'), 50, 30, { width: 80 });
    doc.fontSize(20).text('Work Order Report', 150, 50, { align: 'center' }).moveDown(2);

    // Add Horizontal Line
    doc.moveTo(50, 100).lineTo(550, 100).stroke();

    // Asset Information Section
    if (workOrder.assetId) {
        doc.fontSize(12).font('Helvetica-Bold').text('Asset Information', { underline: true });
        doc.font('Helvetica').text(`Manufacturer: ${workOrder.assetId.manufacturer}`);
        doc.text(`Model: ${workOrder.assetId.model}`);
        doc.text(`Serial Number: ${workOrder.assetId.serialNumber}`);
        doc.moveDown();
    }

    // Work Order Details Section
    doc.fontSize(12).font('Helvetica-Bold').text('Work Order Details', { underline: true });
    doc.font('Helvetica').text(`Work Order #: ${workOrder.workOrderNumber}`);
    doc.text(`Description: ${workOrder.description}`);
    doc.text(`Status: ${workOrder.status}`);
    doc.text(`Assigned To: ${workOrder.assignedTo?.username || 'Unassigned'}`);
    doc.text(`Scheduled Date: ${workOrder.scheduledDate ? new Date(workOrder.scheduledDate).toLocaleDateString() : 'N/A'}`);
    doc.text(`Completion Date: ${workOrder.completionDate ? new Date(workOrder.completionDate).toLocaleDateString() : 'N/A'}`);
    doc.moveDown();

    // Procedure and Task Results Section
    if (workOrder.procedure) {
        doc.fontSize(12).font('Helvetica-Bold').text('Procedure and Task Results', { underline: true });
        doc.font('Helvetica');

        const tableTop = doc.y;
        const cellPadding = 5;

        // Table Header
        doc.rect(50, tableTop, 500, 20).fillAndStroke('#f2f2f2', '#000').stroke();
        doc.text('Task Description', 55, tableTop + cellPadding, { width: 250, align: 'left' });
        doc.text('Type', 305, tableTop + cellPadding, { width: 100, align: 'left' });
        doc.text('Result', 405, tableTop + cellPadding, { width: 100, align: 'left' });

        // Add Task Rows
        let currentY = tableTop + 25;
        workOrder.procedure.tasks.forEach((task) => {
            const result = workOrder.procedure.taskResults.forEach((tr) => tr.taskId.toString() === task._id.toString());

            let resultText = 'Pending';
            if (result) {
                if (task.type === 'Pass/Fail') {
                    resultText = result.result ? 'Pass' : 'Fail';
                } else if (task.type === 'Measurement') {
                    resultText = result.result ? `${result.result}` : 'N/A';
                }
            }

            doc.rect(50, currentY, 500, 20).stroke();
            doc.text(task.description, 55, currentY + cellPadding, { width: 250, align: 'left' });
            doc.text(task.type, 305, currentY + cellPadding, { width: 100, align: 'left' });
            doc.text(resultText, 405, currentY + cellPadding, { width: 100, align: 'left' });
            currentY += 25;

            if (currentY > doc.page.height - 50) {
                doc.addPage();
                currentY = 50;
            }
        });

        doc.moveDown();
    }

    // Footer
    const footerY = doc.page.height - 50;
    doc.fontSize(10).text(`Generated on ${new Date().toLocaleString()}`, 50, footerY, { align: 'left' });
    doc.text(`Page 1`, 500, footerY, { align: 'right' });

    doc.end();

    // Return the file path
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', (err) => reject(err));
    });
};

module.exports = {
    generatePDF,
    generateWorkOrderReport,
    generateWorkOrderPDF,
};


module.exports = { generatePDF, generateWorkOrderReport, generateWorkOrderPDF };
