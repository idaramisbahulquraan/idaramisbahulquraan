## Next Task Backlog and Guidelines

This file tells future agents what to do next. Keep it updated after each batch: mark completed batches as **Completed:** and remove any ambiguity. Do not delete this header.

### Current Batch Queue
1) **Completed:** Access + Audit Foundation
   - Granular roles enforced in rules (owner/admin/principal/teacher/accountant/clerk/parent/student), fees allow clerk, staff set includes clerk, audit collection guarded.
   - Shared audit logger (`logAudit`) writes to `audits` with actor/role/tenant/path/payload; wired into inventory actions.
   - Per-tenant helpers present; inventory now non-tenant-filtered for compatibility; other modules remain to be aligned as needed.

2) **Completed:** Payments & Billing (initial scaffolding)
   - Added `payments.js` gateway stubs (Stripe/Razorpay/PayPal placeholders), payment intents/receipts collections, status recording, reminder stub.
   - Fees UI now includes Pay button; payment intents mark fees paid on success; receipts are stored; rules opened for payment intents/receipts; audits wired via `logAudit`.
   - Still TODO for future: real provider keys/checkout redirects, webhook handling, automated reconciliation reports/PDF invoices/reminders.

3) **Completed:** Parent/Student Portals (mobile-first, initial)
   - Added parent portal page (mobile-friendly cards linking to attendance, timetable, grades, fees/payments, notices, messaging); sidebar now links parent role to the portal.
   - Note: homework/messaging are stubs pointing to communication; deeper integrations still needed for assignments/chat.

4) **Completed:** Attendance Automation (stubs)
   - QR/Barcode scan entry point stub and geofence check-in stub with location logging (`attendance_logs`). NOTE: Skipped actual QR decoder integration and geofence radius enforcement per instruction.

5) **Completed:** Assessments & Gradebook (initial)
   - Added grade weight field to teacher grades page; persisted with grades records; prefilled from saved grades. (Rubrics/report cards/promotion workflow still pending.)

6) **Completed:** Homework & Assignments (initial)
   - Teacher homework page added (create/list/delete with dept/class/subject/title/details/due date/late policy), student homework page (view, submit placeholder), sidebar links for teacher/student. Rules allow homework and submissions; audits wired via shared logger. Attachments/plagiarism and real submissions still pending.

7) **Completed:** Communication Suite (in-app + job hooks)
   - Implemented notices/events/templates CRUD in `js/communication.js` with audience targeting and role-gated actions; notices optionally queue `message_jobs` for Email/SMS/WhatsApp/Push channels (hook for future gateways/Cloud Functions).
   - Implemented two-way in-app messaging using `message_threads` + `messages` subcollections with participant metadata for display; added sidebar link to `pages/admin/communication.html#messages` for teacher/student/parent.

8) **Completed:** Transport Module (initial)
   - Added `pages/admin/transport.html` + `js/transport.js` with routes/vehicles/drivers CRUD, student route assignments (pickup/drop stops), trip attendance (AM/PM) and live tracking hook storing latest coordinates in `transport_locations`.
   - Added fee add-ons: bulk generate Transport fee records for a route/month/year (idempotent doc ids) and auto-creates a `fee_heads` entry named `Transport` if missing.

9) **Completed:** Inventory & Assets (initial)
   - Extended inventory with Procurement, Assets (straight-line depreciation display), and Maintenance schedules/tickets in `pages/admin/inventory.html` + `js/inventory.js`.
   - Added Firestore rules for `inventory_procurements`, `assets`, `maintenance_schedules`, and `maintenance_tickets` (admin/owner).

10) **Completed:** Library (initial)
   - Added `pages/admin/library.html` + `js/library.js` with catalog CRUD (copies tracked), loans issue/return, overdue fine calculation + mark-paid, reservations (create/cancel/fulfill), and ISBN lookup (Open Library) plus basic library settings.
   - Added sidebar links for Admin + Clerk and Firestore rules for `library_*` collections.

11) **Completed:** Timetable Automation (initial)
   - Extended `pages/admin/timetable.html` + `js/timetable.js` with a Tools modal: generator (preview what-if + apply), room management, conflict scanning, and daily coverage using approved `leaves` plus date-specific `timetable_overrides` for substitute teachers.
   - Added room assignment + conflict checks (teacher across all classes, room occupancy) and fixed the admin timetable PDF export.
   - Added Firestore rules for `timetable_rooms`, `timetable_overrides`, and `timetable_audit`.

12) **Completed:** Finance & Payroll
   - Finance: added Budget tab (monthly budgets vs actuals), tenant-aware reads/writes; finance heads support optional codes; budgets stored in `finance_budgets`.
   - Payroll: salary structures (allowances/fixed deductions/tax%/takaful%), advances/loans + repayments, enhanced payroll processing with breakdown + optional salary expense entry, bank export CSV, and improved payslip PDF breakdown.
   - Rules: added Firestore rules for `finance_heads`, `finance_budgets`, `salary_structures`, `salary_advances`, and `salary_advance_payments`.

13) **Completed:** Analytics & Dashboards
   - Expanded `pages/admin/reports.html` Analytics section with Fee Collection vs Target, Attendance Heatmap, Cohort Performance, Staffing Utilization, and a Risk Watchlist (arrears + attendance), plus a one-click Refresh action.
   - Implemented tenant-aware analytics loaders in `js/reports.js` with safe fallbacks and Chart.js lifecycle cleanup (destroy/recreate on refresh).

14) **Completed:** Multi-language / i18n
   - Per-user language preference persisted in `user_settings/{uid}` and synced on login/toggle in `js/script.js`.
   - Added English fallback + completed `data-i18n` key coverage across HTML pages in `js/translations.js` (EN/UR), with RTL support already in `css/style.css`.
   - Language toggle now appears on both dashboard pages and the login page.

15) **Completed:** Offline & Sync
   - Added PWA app shell: `manifest.json`, `sw.js`, `offline.html`, and generated icons (`assets/icon-192.png`, `assets/icon-512.png`).
   - Service worker precaches core assets + key entry pages (teacher attendance/grades) and caches required SDKs so attendance/marks entry can work offline after install.
   - Firestore persistence already enabled and now uses `synchronizeTabs: true` in `js/firebase-config.js`, providing queued writes + background sync when back online; added an offline/online banner via `js/script.js`.

16) **Completed:** Data Import/Export (initial)
   - Added bulk CSV/Excel import (Students/Teachers) with templates, preview, validation, and optional account creation in `pages/admin/backup.html` + `js/import-export.js`.
   - Added CSV export format to Reports Center (`pages/admin/reports.html` + `js/reports.js`) alongside existing PDF/Excel exports.

17) **Completed:** Compliance & Privacy (initial)
   - Added `pages/admin/compliance.html` + `js/compliance.js` for privacy notice edit/preview, consent recording/listing, retention settings, and an audit log viewer.
   - Added Firestore rules for `privacy_notices`, `retention_policies`, and `consents`, plus an admin sidebar link and EN/UR i18n keys.
   - Note: retention automation is configuration-only for now (cleanup requires Cloud Functions or an admin job).

18) **Completed:** Integrations (initial)
   - Added Google + Microsoft SSO buttons on `index.html` plus provisioning/domain/provider checks in `js/script.js` (requires enabling providers in Firebase Console).
   - Added `pages/admin/integrations.html` + `js/integrations.js` for SSO settings (allowed domains), Events iCal export (.ics), and webhook endpoints (client test send + queued `webhook_jobs`).
   - Added Firestore rules for `integration_settings`, `webhook_endpoints`, and `webhook_jobs`, plus an admin sidebar link (LMS/Google Classroom and true iCal subscription feeds remain future work).

19) **Completed:** Mobile Apps / Shell
   - Added role-specific PWA manifests (`manifest.teacher.json`, `manifest.student.json`, `manifest.parent.json`) and auto-select per role via `js/script.js`.
   - Improved installed-PWA flow by preserving the target page via `?next=...` redirects during auth.
   - Added Web Push scaffolding with Firebase Cloud Messaging (FCM): background handler + notification click routing in `sw.js`, client token registration stored in `push_tokens`, and admin config UI (VAPID key + device list) in Integrations.

20) **Completed:** Branding / White-label
   - Added tenant-scoped branding doc (`branding/{tenantId}`) with rules; Settings UI now saves branding (primary color, domain, PDF footer) and school profile assets into the branding doc.
   - App-wide branding applied via `js/script.js` (theme colors, sidebar logo/name, header banner) with localStorage caching for instant load.
   - PDF/report templates now use branding header/footer via shared `applyPdfBranding` (reports + payroll + key exports).

21) **Completed:** Supportability
   - Added global client-side error reporting (`error_reports`) with rate limiting + offline queue/flush in `js/script.js` and Firestore rules.
   - Added `pages/admin/support.html` + `js/support.js` for Help Center, Diagnostics (copyable), and admin error report viewer; included in sidebar + service worker precache.
   - Added a lightweight guided walkthrough overlay callable from Support.

### Working Instructions
- Always start with the highest-priority incomplete batch above (currently: none; add new items as needed) unless the user explicitly reprioritizes.
- After completing any batch (or sub-scope), update this file by prepending **Completed:** to that item and briefly noting what was delivered.
- Maintain ASCII; avoid deleting this file; keep the list order.
