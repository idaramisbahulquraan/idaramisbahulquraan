# School Management System Update Plan
**Last Updated:** 2025-12-12
**Status:** ✅ Completed (Ready for Production Review)

This document outlines the comprehensive update plan for the School Management System (SMS) to scale it into a commercial product.

## 1. Architecture & Scaling Strategy

To ensure the application is "product-ready" and scalable:
-   [x] **Configurability**: Move hardcoded values (currency, school name, roles) to a global `Settings` collection.
-   [x] **Security**: Implement strict Firestore Security Rules (currently open/basic) to ensure role-based access control (RBAC).
-   [x] **Modular Code**: Continue the pattern of separate JS files per module.
-   [x] **Data Integrity**: Use Firestore Transactions/Batches for critical operations (Inventory, etc.).

## 2. New Modules Implementation

### 2.1 Settings Module (Admin Only)
**Files**: `pages/admin/settings.html`, `js/settings.js`
**Status**: ✅ Completed
**Features**:
-   [x] **School Profile**: Upload Logo, Banner, Address, Contact Info.
-   [x] **System Config**: Set Currency, Academic Year, Date Format.
-   [x] **Data Management**: "Factory Reset" button to wipe data.

### 2.2 HR & Payroll Module
**Files**: `pages/admin/payroll.html`, `js/payroll.js`
**Status**: ✅ Completed
**Features**:
-   [x] **Staff Management**: Listing Teachers for payroll.
-   [x] **Payroll Processing**: Generate monthly slips. Calculate Net Salary.
-   [x] **History**: View past payroll records.
-   [x] **Extended Staff Profile**: Store bank details, join date, non-teaching staff.
-   [x] **Salary Structure**: Define fixed Basic, HRA, Allowances per staff member.
-   [x] **Leave Management**: Track Sick/Casual/Paid leaves.

### 2.3 Inventory Management Module
**Files**: `pages/admin/inventory.html`, `js/inventory.js`
**Status**: ✅ Completed
**Features**:
-   [x] **Categories**: Furniture, Electronics, Stationery.
-   [x] **Item Master**: Name, SKU, Quantity, Unit Price, Low Stock.
-   [x] **Transactions**: Purchase (Add), Issue (Assign), Consume.
-   [x] **Alerts**: Low stock indicators.

### 2.4 Communication Module (Notice Board)
**Files**: `pages/admin/communication.html`
**Status**: ✅ Completed
**Features**:
-   [x] **Notice Board**: CRUD for Admin.
-   [x] **Events Calendar**: FullCalendar.js integration.
-   [x] **Messaging**: Broadcast to All/Teachers/Parents.

### 2.5 AI Features (New)
**Files**: `pages/admin/ai-features.html`, `js/ai-features.js`, `js/script.js`
**Status**: ✅ Completed
**Features**:
-   [x] **Provider Configuration**: Support for Gemini, Groq, HuggingFace, Mistral, xAI.
-   [x] **AI Chatbot**: Context-aware assistant that answers questions based on system data (Teachers, Students, Finance, etc.).
-   [x] **Smart Data Entry**: Natural language processing to add bulk records (Finance, Students, etc.).
-   [x] **Multimodal Support**: Drag-and-drop file upload (Images/PDFs) for analysis and data extraction.
-   [x] **Floating Bot**: Global AI assistant available on all pages with glassmorphism UI.
-   [x] **Secure Key Storage**: LocalStorage + Firebase (optional) for API keys.

## 3. Enhancements to Existing Modules

### 3.1 Fee Management
**Files**: `pages/admin/fees.html`, `pages/admin/fee-receipt.html`, `js/fees.js`
**Status**: ✅ Mostly Completed
**Updates**:
-   [x] **Fee Structure**: Manage Fee Heads/Types.
-   [x] **Receipts**: Dedicated printable receipt page.
-   [x] **Defaulters**: Query pending fees.
-   [x] **Reminders**: Button to "Send Reminder" (Simulated).
-   [ ] **Advanced Profiles**: Assign fee structures to specific classes automatically.

### 3.2 Timetable Management
**Files**: `pages/admin/timetable.html`, `js/timetable.js`
**Status**: ✅ Completed
**Updates**:
-   [x] **Views**: Class View (Weekly Grid).
-   [x] **Teacher View**: Pivot table view & PDF Download.
-   [x] **Conflict Detection**: Prevent double booking.
-   [x] **Settings**: Define "Period Duration" for auto-time calculation.

### 3.3 Dashboard (Role-Specific)
**Status**: ✅ Completed
**Updates**:
-   [x] **Admin**: Financial overview (Charts), Staff presence.
-   [x] **Teacher**: Today's classes.
-   [x] **Student/Parent**: Upcoming exams, Attendance stats.

### 3.4 Reports & Analytics
**Files**: `pages/admin/reports.html`, `js/reports.js`
**Status**: ✅ Completed
**Updates**:
-   [x] **PDF Generation**: Students, Teachers, Finance, Fees.
-   [x] **Visuals**: Chart.js integration for Fee Collection/Attendance.
-   [x] **Excel Export**: SheetJS integration.

## 4. Implementation Phase Plan (Revised)

### Phase 1: Foundation & Settings (✅ Done)
-   Settings Page, Logo/Banner, Reset Data.

### Phase 2: Core Enhancements (Fees & Timetable) (🚧 In Progress)
-   Fees: Done.
-   Timetable: Basic Grid Done. **Next: Conflict Detection & Teacher View.**

### Phase 3: New Business Modules (HR & Inventory) (🚧 In Progress)
-   Payroll: Basic Processing Done. **Next: Staff Profiles & Leave Mgmt.**
-   Inventory: **Next Priority.**

### Phase 4: Communication & Dashboard (⏳ Pending)
-   Event Calendar & Notice Board.
-   Dashboard Widgets.

### Phase 5: Reporting & Polish (⏳ Pending)
-   Excel Export & Charts.
-   Final Security Rules.

## 5. Technical Requirements
-   **Libraries Added**:
    -   `jspdf`, `jspdf-autotable` (Reports)
-   **Libraries to Add**:
    -   `FullCalendar` (Events)
    -   `SheetJS (xlsx)` (Excel Export)
    -   `Chart.js` (Visuals)
