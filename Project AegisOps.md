# Project: AegisOps

## Overview

AegisOps is a comprehensive operational management system designed for tracking assets, managing work orders, scheduling maintenance, and generating reports. Built with a React frontend, Node.js backend, and MongoDB database, the system offers flexibility for future expansion beyond just maintenance workflows.

---

## Key Features

### Work Orders

* Create, edit, and delete work orders.
* Assign work orders to users or teams.
* Track work order types (e.g., Planned Maintenance, Corrective Maintenance).
* Auto-generate readable work order numbers.
* Add time logs with descriptions.
* Record travel time (optional).
* Attach test equipment used.
* Log parts used with pricing and inventory tracking.
* Associate work orders with reusable procedures and tasks.
* Update task results dynamically.

### Assets

* Manage assets with control number, manufacturer, model, serial number, category, and status.
* Configure maintenance schedules with frequency and next due date.
* Auto-generate work orders from maintenance schedules.
* View work orders linked to specific assets.

### Reporting

* Export filtered work orders to Excel.
* Export individual work orders as printable PDFs.
* Export filtered asset reports to Excel.
* Metrics for technician performance and work order trends.

### Dashboard

* Real-time summaries of:

  * Open, completed, and overdue work orders
  * Asset statuses and upcoming maintenance
  * Technician activity and time logs
  * Parts usage and inventory

### User Management

* Secure authentication with JWT.
* Role-based access for Admin and Technician users.

### Real-Time Features

* Dashboard metrics planned for WebSocket-based updates.

---

## Backend

### API Endpoints

#### Work Order Routes

* `GET /workorders/:id` – Fetch a work order by ID
* `POST /assets/:assetId/workorders` – Create work order for asset
* `PATCH /workorders/:id/timelogs` – Add time logs
* `PATCH /workorders/:id/travellogs` – Add travel logs
* `PATCH /workorders/:id/procedure` – Attach procedure to work order
* `PATCH /workorders/:id/procedure/:taskId/result` – Update task results

#### Asset Routes

* `GET /assets/:id` – Fetch asset by ID
* `GET /assets` – List all assets
* `POST /assets` – Create new asset
* `PATCH /assets/:id` – Update asset

#### Report Routes

* `GET /reports/workorders/excel` – Export filtered work orders (Excel)
* `GET /reports/workorders/:workOrderNumber/pdf` – Export work order as PDF
* `GET /reports/assets/excel` – Export filtered assets (Excel)

#### Dashboard Routes

* `GET /dashboard/workorders/summary` – Summary of open/completed/overdue work orders
* `GET /dashboard/assets/summary` – Asset count and maintenance status
* `GET /dashboard/technicians/performance` – Time log metrics by user

---

## Frontend

### Key Components

* Work Order Views and Forms
* Asset Management Pages
* Reporting Tools (Excel, PDF)
* Dashboard Charts and Summary Cards (pending)

### Utilities

* API handler (Axios)
* Time/date formatting and status logic

---

## Installation

### Prerequisites

* Docker (recommended)
* Node.js (for local setup)
* MongoDB (if running locally)

### Docker Setup

1. Add a `Dockerfile` for backend and frontend.
2. Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  mongo:
    image: mongo
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/aegisops
      - JWT_SECRET=your_secret_here
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  mongo-data:
```

3. Run `docker-compose up --build`

### Local Dev

1. Clone the repo
2. Set up `.env`
3. Install dependencies
4. Run backend: `npm start`
5. Run frontend: `cd frontend && npm run dev`

---

## Usage

### Creating Work Orders

* Go to an asset page, click “Create Work Order,” fill in details.

### Logging Time & Travel

* Open a work order, click “Add Time Log” or “Add Travel Log.”

### Generating Reports

* Go to “Reports” and export filtered work orders or assets.

---

## Scripts

* Maintenance schedule automation (daily cron or manual run)
* Backfill utilities for:

  * `workOrderNumber`
  * `requestDate`, `dueDate`
  * Task results migration to procedures

---

## Future Plans

* Finalize real-time dashboard
* Mobile responsive views
* Advanced parts inventory controls
* MFA and audit logging
* Modular plugin architecture (scheduling, compliance, etc.)

---

## License

MIT License

