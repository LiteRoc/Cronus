# Project: Asset and Work Order Management System

## Overview
The Asset and Work Order Management System is a comprehensive tool designed for managing assets, tracking maintenance schedules, creating work orders, and generating reports. The application is built with a React frontend, a Node.js backend, and MongoDB for the database.

---

## Key Features

### Work Orders
- Create, edit, and delete work orders.
- Assign work orders to users.
- Add time logs, travel logs, and parts used.
- Attach test equipment used to work orders.
- Add and manage procedures for work orders.
- Display task results associated with procedures.

### Assets
- Manage assets with fields such as control number, manufacturer, model, category, and status.
- Add and update maintenance schedules, including frequency and associated procedures.
- Display work orders linked to specific assets.
- Generate work orders directly from the asset page.

### Reporting
- Generate individual work order reports as downloadable PDFs.
- Generate summary reports of work orders filtered by date.

### User Management
- Secure authentication using JWT.
- Role-based access for admin and technician users.

---

## Backend

### API Endpoints
#### Work Order Routes
- **`GET /workorders/:id`**: Fetch a work order by ID.
- **`POST /workorders`**: Create a new work order.
- **`PATCH /workorders/:id`**: Update an existing work order.

#### Asset Routes
- **`GET /assets/:id`**: Fetch asset details by ID.
- **`POST /assets`**: Create a new asset.
- **`PATCH /assets/:id`**: Update an existing asset.

#### Report Routes
- **`GET /reports/workorder/:workOrderNumber`**: Generate a PDF report for a specific work order.
- **`GET /reports/summary?startDate&endDate`**: Generate a summary report for work orders within a date range.

---

## Frontend

### Key Components
#### Pages
- **`EditWorkOrderPage.tsx`**: Allows users to view and update work order details.
- **`EditAssetPage.tsx`**: Allows users to view and update asset details.

#### Modals
- **`AddTimeLogModal.tsx`**: Add time logs to work orders.
- **`AddTravelTimeModal.tsx`**: Add travel logs to work orders.
- **`AddProcedureModal.tsx`**: Add or change procedures for work orders.

#### Reporting
- **`WorkOrderReport.tsx`**: Generate a detailed work order report for printing or downloading.

### Utilities
- **`api.ts`**: Handles all API calls for the application.
- **`WorkOrderUtils.ts`**: Contains helper functions for work order operations.

---

## Installation

### Prerequisites
- Node.js (v14 or later)
- MongoDB

### Steps
1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the `.env` file:
   ```env
   PORT=5000
   MONGO_URI=<your-mongodb-uri>
   JWT_SECRET=your_jwt_secret
   ```
4. Start the backend server:
   ```bash
   npm run start
   ```
5. Navigate to the frontend folder, install dependencies, and start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Usage

### Creating Work Orders
1. Navigate to the asset page.
2. Select an asset and click "Create Work Order."
3. Fill in the required fields and save.

### Adding Time Logs
1. Open a work order.
2. Click "Add Time Log."
3. Enter details and save.

### Generating Reports
1. Open the work order or navigate to the reports section.
2. Click the "Generate Report" button.
3. Download or print the report.

---

## Known Issues
- Ensure that all fields are properly validated before submitting forms.
- Some reports may require additional styling adjustments.

---

## Contributing
1. Fork the repository.
2. Create a new branch for your feature.
3. Commit your changes and push them.
4. Create a pull request.

---

## License
This project is licensed under the MIT License.

