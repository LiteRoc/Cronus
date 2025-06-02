# **Application Documentation**

## **Overview**
The application is a comprehensive asset and work order management system designed for efficient tracking, maintenance scheduling, and reporting. It supports features like real-time dashboards, detailed reporting, and task management.

---

## **Features**

### **Work Order Management**
- Create, update, and delete work orders.
- Auto-generate **work order numbers** in a readable format.
- Support for **work order types**: Planned Maintenance, Corrective Maintenance.
- Track:
  - Assigned technician.
  - Time logs with detailed descriptions.
  - Travel logs (optional, tracks time spent traveling).
  - Parts used.
  - Test equipment used.
- Associate work orders with:
  - Assets.
  - Procedures.
- Includes `requestDate`, `dueDate` (auto-set to 7 days from creation by default), and `completionDate`.

---

### **Asset Management**
- Track detailed information, including:
  - Control number, manufacturer, model, and serial number.
  - Maintenance schedules (frequency-based: yearly, monthly, etc.).
  - Associated work orders.
- Automate planned maintenance schedules:
  - Create work orders with procedures based on asset schedules.
  - Update `nextMaintenance` and `lastMaintenance` dates dynamically.

---

### **Procedures and Tasks**
- Create reusable **tasks**:
  - Pass/Fail tasks.
  - Measurement tasks (with min/max values).
- Build **procedures** with multiple tasks.
- Task results are stored within the procedure:
  - Results can be updated dynamically.
  - Results tied to specific work orders.
- Procedures are optional for work orders.

---

### **Parts Management**
   - Track parts inventory, including stock levels, locations, and suppliers.
   - Link parts used in work orders.
   - Notify when parts are below reorder thresholds.

  ---

  ### **Technician Tools**
   - Log time with descriptions.
   - Record travel time for work orders.
   - Update task results dynamically.

---

### **Reporting and Analytics**
#### Work Orders
- Export:
  - **Filtered Excel reports** with customizable filters.
  - Individual work orders as **PDFs** (includes detailed asset information, work order details, and task results).
- Generate summary metrics like:
  - Total work orders, completed/open/overdue work orders.
  - Average time to complete work orders.

#### Assets
- Export filtered asset reports to Excel.
- Include asset-specific details and associated work orders.

#### Technician Performance
- Metrics for technician efficiency:
  - Total hours logged.
  - Average work order completion time.

---

### **Dashboard**
- Real-time dashboard (frontend pending implementation) with:
  - **Work Order Summary**:
    - Total open, completed, and overdue work orders.
  - **Asset Summary**:
    - Total assets, assets due for maintenance, active vs. inactive assets.
  - **Technician Performance**:
    - Total hours logged.
    - Work orders completed per technician.
  - **Parts and Inventory**:
    - Usage summary.
    - Stock alerts for low inventory.

---

### **Real-Time Features**
- Pending frontend development:
  - Real-time updates for work order statuses, technician logs, and asset changes.

---

## **Endpoints**

### **Work Orders**
| Method | Endpoint                                  | Description                                |
|--------|------------------------------------------|--------------------------------------------|
| POST   | `/assets/:assetId/workorders`            | Create a new work order for an asset.     |
| PATCH  | `/workorders/:workOrderId/timelogs`      | Add time logs with descriptions.          |
| PATCH  | `/workorders/:workOrderId/travellogs`    | Add optional travel time.                 |
| PATCH  | `/workorders/:workOrderId/procedure`     | Assign a procedure to a work order.       |
| PATCH  | `/workorders/:workOrderId/procedure/:taskId/result` | Update task results.                     |
| GET    | `/reports/workorders/excel`             | Export filtered work orders as Excel.     |
| GET    | `/reports/workorders/:workOrderId/pdf`  | Export a single work order as PDF.        |

---

### **Assets**
| Method | Endpoint                                  | Description                                |
|--------|------------------------------------------|--------------------------------------------|
| GET    | `/assets`                                | Fetch all assets with details.            |
| GET    | `/assets/:assetId`                       | Fetch details of a single asset.          |
| POST   | `/assets`                                | Create a new asset.                       |
| PATCH  | `/assets/:assetId`                       | Update an asset's details.                |
| DELETE | `/assets/:assetId`                       | Delete an asset.                          |

---

### **Procedures**
| Method | Endpoint                                  | Description                                |
|--------|------------------------------------------|--------------------------------------------|
| POST   | `/procedures`                            | Create a new procedure with reusable tasks.|
| GET    | `/procedures/:procedureId`               | Fetch details of a specific procedure.    |

---

### **Dashboard**
| Method | Endpoint                                  | Description                                |
|--------|------------------------------------------|--------------------------------------------|
| GET    | `/dashboard/workorders/summary`          | Fetch work order summary metrics.         |
| GET    | `/dashboard/assets/summary`              | Fetch asset summary metrics.              |
| GET    | `/dashboard/technicians/performance`     | Fetch technician performance metrics.     |

---

## **Scripts**
- **Maintenance Automation**: Automatically create planned maintenance work orders.
- **Data Migration**:
  - Backfill work order numbers.
  - Migrate task results from work orders to procedures.

---

## **To-Do for v1.0 Completion**
- Finalize frontend dashboard with real-time updates.
- Address any remaining edge cases in data integrity.
- Complete API documentation.

---

### **Current Enhancements**
1. **ExcelJS Integration**:
   - Reports now download directly from the browser, eliminating the need for temporary storage on the server.
2. **Filters for Reporting**:
   - Reports support filtering by date range, status, and user.
3. **Real-Time Updates (Planned)**:
   - Will implement once the front-end is ready.

---

### **Setup**
1. **Environment Variables**:
   - `MONGO_URI`: MongoDB connection string.
   - `JWT_SECRET`: Secret for token authentication.
   - `EMAIL_CREDENTIALS`: Email configuration for notifications.
   - `SMS_CREDENTIALS`: SMS configuration for notifications.

2. **Running the Application**:
   - Install dependencies: `npm install`
   - Start server: `npm start`
   - API runs on `http://localhost:4000`.

3. **Testing**:
   - Use Postman for API testing.
   - Example endpoints and test cases are included for most features.

---

### **Future Plans**
1. **Enhance Reports**:
   - Add more advanced filters and report types (e.g., PDF).
2. **Real-Time Dashboard**:
   - Integrate WebSockets for real-time updates.
3. **Mobile Optimization**:
   - Ensure functionality on mobile devices for technicians.
4. **Security Improvements**:
   - Implement MFA and encryption for sensitive data.
5. **Advanced Inventory Tracking**:
   - Notify users when parts are used or reordered.

---
