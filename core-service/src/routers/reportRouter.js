const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { buildTenantFilter } = require('../middleware/tenantScope');
const { generatePDF, generateWorkOrderReport, generateWorkOrderPDF } = require('../services/reportingService');
const debug = require('debug')('app:reportRouter');
const WorkOrder = require('../models/WorkOrder');
const Asset = require('../models/Asset');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const reportRouter = express.Router();

// Helper function to build queries dynamically
const buildQuery = (queryParams) => {
    const query = {};

    if (queryParams.status) query.status = queryParams.status;
    if (queryParams.assetId) query.assetId = queryParams.assetId;
    if (queryParams.assignedTo) query.assignedTo = queryParams.assignedTo;

    if (queryParams.startDate || queryParams.endDate) {
        query.scheduledDate = {};
        if (queryParams.startDate) query.scheduledDate.$gte = new Date(queryParams.startDate);
        if (queryParams.endDate) query.scheduledDate.$lte = new Date(queryParams.endDate);
    }

    return query;
};

// GET: PDF Work Order Report
reportRouter.get('/workorders/pdf', [authenticateToken, authorizeRoles('admin', 'tech', 'customer')], async (req, res) => {
    try {
        const filter = buildTenantFilter(req);
        const query = { ...filter, ...buildQuery(req.query) };
        const workOrders = await WorkOrder.find(query).populate('assetId', 'ctrlNumber manufacturer model');
        
        if (!workOrders.length) {
            return res.status(404).json({ error: 'No work orders found for the given criteria.' });
        }

        const pdfData = await generatePDF(workOrders, 'Filtered Work Order Report');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=work_orders.pdf');
        res.send(Buffer.from(pdfData));
    } catch (error) {
        debug('Error generating PDF report:', error);
        res.status(500).json({ error: 'Error generating PDF report' });
    }
});

// GET: Excel Work Order Report
reportRouter.get('/workorders/excel', authenticateToken, authorizeRoles('admin', 'tech', 'customer'), async (req, res) => {
    try {
        const filter = buildTenantFilter(req);
        const query = { ...filter, ...buildQuery(req.query) };
        const workOrders = await WorkOrder.find(query).populate('assignedTo', 'username');

        if (!workOrders.length) {
            return res.status(404).send('No work orders found for the given criteria.');
        }

        // Avoid any non-customer-specific fields
        if (req.user.role === 'customer') {
            workOrders.forEach(wo => {
                wo.timeLogs = undefined; // or just anonymize names
                wo.internalNotes = undefined;
            });
        }

        await generateWorkOrderReport(workOrders, res);
    } catch (error) {
        debug('Error generating Excel report:', error);
        res.status(500).send('Failed to generate report.');
    }
});

// GET: Get filtered asset in excel
reportRouter.get('/assets/excel', [authenticateToken, authorizeRoles('admin', 'tech', 'customer')], async (req, res) => {
    try {
        const filter = buildTenantFilter(req);
        const { status, category, maintenanceDueBefore } = req.query;

        // Build dynamic filters based on query parameters
        const filters = { ...filter };
        if (status) filters.status = status;
        if (category) filters.category = category;
        if (maintenanceDueBefore) {
            filters['maintenanceSchedule.nextMaintenance'] = {
                $lte: new Date(maintenanceDueBefore),
            };
        }

        const assets = await Asset.find(filters).populate('workOrders', 'workOrderNumber');

        // Format data for Excel
        const reportData = assets.map((asset) => ({
            ctrlNumber: asset.ctrlNumber,
            manufacturer: asset.manufacturer,
            model: asset.model,
            serialNumber: asset.serialNumber,
            status: asset.status,
            category: asset.category,
            maintenanceSchedule: asset.maintenanceSchedule
                ? `${asset.maintenanceSchedule.frequency} | Next: ${asset.maintenanceSchedule.nextMaintenance.toISOString().split('T')[0]}`
                : 'N/A',
            workOrders: asset.workOrders.map((wo) => wo.workOrderNumber).join(', '),
        }));

        // Create the Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Filtered Assets');

        worksheet.columns = [
            { header: 'Control Number', key: 'ctrlNumber', width: 20 },
            { header: 'Manufacturer', key: 'manufacturer', width: 20 },
            { header: 'Model', key: 'model', width: 20 },
            { header: 'Serial Number', key: 'serialNumber', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Maintenance Schedule', key: 'maintenanceSchedule', width: 30 },
            { header: 'Work Orders', key: 'workOrders', width: 30 },
        ];

        worksheet.addRows(reportData);

        // Send the Excel file to the browser
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=filtered_assets_report_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating filtered asset report:', error);
        res.status(500).json({ error: 'Failed to generate filtered asset report' });
    }
});

// GET: Generate a single Work Order Report downloaded from the browser
reportRouter.get('/workorders/:workOrderNumber/pdf', [authenticateToken, authorizeRoles('admin', 'tech', 'customer')], async (req, res) => {
    const { workOrderNumber } = req.params;
    const filter = buildTenantFilter(req);

    try {
        // Fetch the work order by its readable workOrderNumber
        const workOrder = await WorkOrder.findOne({ ...filter, workOrderNumber }).populate('assetId').populate('assignedTo').populate({
            path: 'procedure',
            populate: { path: 'tasks' },
        });

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Generate the PDF content
        const pdfPath = await generateWorkOrderPDF(workOrder);

        // Send the file as a downloadable response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="Work_Order_${workOrderNumber}.pdf"`
        );
        res.sendFile(pdfPath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error downloading file.');
            }
        });
    } catch (error) {
        console.error('Error generating work order report:', error);
        res.status(500).json({ error: 'Failed to generate work order report' });
    }
});


// POST: Generate Single Work Order Report
reportRouter.post('/workorders/:workOrderNumber/pdf', [authenticateToken, authorizeRoles('admin', 'tech', 'customer')], async (req, res) => {
    try {
        const { workOrderNumber } = req.params;
        const filter = buildTenantFilter(req);

        // Fetch the work order with detailed information
        const workOrder = await WorkOrder.findOne({ ...filter, workOrderNumber })
            .populate('assetId')
            .populate('assignedTo')
            .populate('procedure');

        if (!workOrder) {
            return res.status(404).json({ error: 'Work Order not found' });
        }

        // Generate the PDF
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, `../../reports/Work_Order_${workOrderNumber}.pdf`);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Add Header
        doc.fontSize(16).text('Scheduled Work Order', { align: 'center' });
        doc.fontSize(12).text(`WO#: ${workOrderNumber}`, { align: 'right' });
        doc.text(`Created: ${new Date(workOrder.createdAt).toLocaleDateString()}`, { align: 'right' });
        doc.text(`Closed: ${workOrder.completionDate ? new Date(workOrder.completionDate).toLocaleDateString() : 'N/A'}`, { align: 'right' });

        // Add Device Information
        doc.moveDown().fontSize(14).text('Device Information:');
        const { assetId } = workOrder;
        doc.fontSize(12).text(`• Manufacturer: ${assetId.manufacturer}`);
        doc.text(`• Model: ${assetId.model}`);
        doc.text(`• Serial Number: ${assetId.serialNumber}`);
        doc.text(`• Location: ${assetId.notes || 'N/A'}`);

        // Add Assigned Information
        doc.moveDown().fontSize(14).text('Assigned Information:');
        const assignedTo = workOrder.assignedTo;
        doc.fontSize(12).text(`• Assigned To: ${assignedTo ? assignedTo.username : 'N/A'}`);
        doc.text(`• Reason: ${workOrder.description || 'N/A'}`);
        doc.text(`• Next Scheduled Date: ${workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleDateString() : 'N/A'}`);

        // Add Notes
        doc.moveDown().fontSize(14).text('Notes:');
        if (workOrder.procedure) {
            doc.text(`Procedure: ${workOrder.procedure.name}`);
        }
        doc.text(`Status: ${workOrder.status}`);
        doc.text(`Notifications Sent: ${workOrder.notificationsSent ? 'Yes' : 'No'}`);

        // Add Services Performed
        doc.moveDown().fontSize(14).text('Services Performed:');
        workOrder.timeLogs.forEach(log => {
            doc.text(
                `${log.userId.username || 'N/A'} | Time Spent: ${log.timeSpent || 0} min | ${log.description || 'No description'}`
            );
        });

        doc.end();

        writeStream.on('finish', () => {
            res.download(filePath, `Work_Order_${workOrderNumber}.pdf`, () => {
                fs.unlinkSync(filePath); // Clean up the generated file after download
            });
        });
    } catch (error) {
        console.error('Error generating single work order report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});


module.exports = reportRouter;
