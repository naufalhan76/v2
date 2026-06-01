# Business Process Guide - AC Service Management Dashboard

## Table of Contents

1. [Introduction](#introduction)
2. [User Roles & Responsibilities](#user-roles--responsibilities)
3. [Order Lifecycle Overview](#order-lifecycle-overview)
4. [Order Creation Process](#order-creation-process)
5. [Order Assignment & Dispatch](#order-assignment--dispatch)
6. [Service Execution](#service-execution)
7. [Invoicing & Payment](#invoicing--payment)
8. [Payment Scenarios](#payment-scenarios)
9. [Do's and Don'ts](#dos-and-donts)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

This guide provides a comprehensive walkthrough of business processes in the AC Service Management Dashboard. It covers the complete order lifecycle from creation to payment, including payment scenarios for different customer types (retail, corporate, contract-based).

**Target Audience:**
- Admin staff managing orders and customers
- Finance staff handling invoicing and payments
- Technicians completing service jobs
- Managers overseeing operations

**Key Concepts:**
- **Order**: A service request from a customer for AC maintenance/repair
- **Service Report**: Technician's completion report with photos, materials used, and findings
- **Proforma Invoice**: Deposit invoice issued before service (optional)
- **Final Invoice**: Invoice issued after service completion with actual costs
- **Payment Recording**: Tracking payments (full, partial, installment)

---

## User Roles & Responsibilities

### SUPERADMIN
**Access Level:** Full system access

**Responsibilities:**
- User management (create, edit, deactivate users)
- System configuration (service catalog, pricing, SLA)
- Database maintenance and backups
- Technician onboarding (create technician accounts with passwords)
- Addon request approval (review technician part requests)

**Key Actions:**
- Create admin/finance users
- Configure service pricing and catalog
- Approve/reject addon requests from technicians
- Monitor system health and performance

### ADMIN
**Access Level:** Order management, customer management, invoicing

**Responsibilities:**
- Order creation and management
- Customer and location management
- Order assignment to technicians
- Order rescheduling and reassignment
- Invoice generation (proforma and final)
- Service reminder management

**Key Actions:**
- Create orders from customer requests
- Assign orders to available technicians
- Monitor order progress (Kanban board)
- Generate invoices after service completion
- Dispatch service reminders

### TECHNICIAN
**Access Level:** Mobile app, assigned jobs only

**Responsibilities:**
- View assigned jobs
- Update job status (EN_ROUTE, IN_PROGRESS, COMPLETED)
- Complete service reports with photos and materials
- Request new parts/addons (if not in catalog)
- Capture customer signatures

**Key Actions:**
- Mark job as EN_ROUTE when traveling
- Mark job as IN_PROGRESS when on-site
- Submit service report with:
  - Before/after photos
  - Materials/addons used
  - Service findings and notes
  - Customer signature
- Request new parts via "Request Part Baru" button

### FINANCE
**Access Level:** Invoice management, payment recording

**Responsibilities:**
- Review invoices before sending
- Record payments (full, partial, installment)
- Track outstanding invoices
- Generate financial reports

**Key Actions:**
- Record payment with payment method and date
- Track installment payments for corporate clients
- Export invoice PDFs
- Send invoices via email

---

## Order Lifecycle Overview

Orders follow a strict 8-state lifecycle:

```
┌─────────┐
│ PENDING │ ← Order created, awaiting assignment
└────┬────┘
     │ Admin assigns technician
     ↓
┌──────────┐
│ ASSIGNED │ ← Technician assigned, awaiting dispatch
└────┬─────┘
     │ Technician starts travel
     ↓
┌──────────┐
│ EN_ROUTE │ ← Technician traveling to location
└────┬─────┘
     │ Technician arrives on-site
     ↓
┌─────────────┐
│ IN_PROGRESS │ ← Service in progress
└──────┬──────┘
       │ Technician submits service report
       ↓
┌───────────┐
│ COMPLETED │ ← Service completed, awaiting invoice
└─────┬─────┘
      │ Admin generates final invoice
      ↓
┌──────────┐
│ INVOICED │ ← Invoice sent, awaiting payment
└────┬─────┘
     │ Finance records payment
     ↓
┌──────┐
│ PAID │ ← Payment received, order closed
└──────┘

Special States:
┌───────────┐
│ CANCELLED │ ← Order cancelled (can happen from any state)
└───────────┘
```

**State Transition Rules:**
- Orders can only move forward (no backward transitions except via reschedule)
- Each state has specific entry conditions and required actions
- State changes trigger notifications (push notifications for technicians)
- Real-time updates visible on admin Kanban board

**Special Actions:**
- **Reschedule**: Resets order to PENDING (preserves technician assignment)
- **Reassign**: Changes technician while in ASSIGNED state
- **Cancel**: Moves order to CANCELLED (terminal state)

---

## Order Creation Process

### Prerequisites
- Customer exists in database (or create new customer)
- Service location exists (or create new location)
- AC unit exists (or create new AC unit)

### Step-by-Step Process

**1. Navigate to Create Order Page**
- Dashboard → Orders → "Create Order" button
- Or: Dashboard → "Create Order" shortcut

**2. Select Customer**
- Search existing customer by name or ID
- Or: Click "Add New Customer" to create customer inline
  - Fill: Customer name, contact person, email, phone, billing address
  - Save customer

**3. Select Service Location**
- Choose from customer's existing locations
- Or: Click "Add New Location" to create location inline
  - Fill: Full address, notes
  - Save location

**4. Select AC Unit**
- Choose from location's existing AC units
- Or: Click "Add New AC Unit" to create unit inline
  - Fill: Unit type, capacity, brand, serial number, installation date
  - Save AC unit

**5. Configure Service Details**
- **Service Type**: Select from catalog (e.g., "Cuci AC", "Service Rutin", "Perbaikan")
- **Service Date**: Choose scheduled date and time
- **Priority**: Normal / Urgent
- **Notes**: Add any special instructions or customer requests

**6. Add Service Items (Optional)**
- Service items are auto-populated based on service type, unit type, and capacity
- Review estimated prices from service catalog
- Add/remove items as needed
- Items shown are estimates - actual costs determined after service completion

**7. Generate Proforma Invoice (Optional)**
- Check "Generate Proforma Invoice" if customer requires deposit
- Proforma invoice uses estimated prices from service catalog
- Status: DRAFT (not final invoice)
- Use case: Corporate clients requiring PO/deposit before service

**8. Submit Order**
- Click "Create Order"
- Order created with status: PENDING
- Order appears in admin dashboard (Kanban board and list view)

### Order Creation Best Practices

**DO:**
- ✅ Verify customer contact information is up-to-date
- ✅ Confirm service location address is accurate (technician will navigate here)
- ✅ Record AC unit serial number for warranty tracking
- ✅ Add detailed notes for special customer requests
- ✅ Generate proforma invoice for corporate clients requiring deposit
- ✅ Set realistic service dates (check technician availability)

**DON'T:**
- ❌ Create orders without verifying customer contact info
- ❌ Skip AC unit details (needed for pricing and service history)
- ❌ Use vague service descriptions (be specific)
- ❌ Schedule orders without checking technician capacity
- ❌ Generate proforma invoices for retail walk-in customers (not needed)

---

## Order Assignment & Dispatch

### Prerequisites
- Order exists with status: PENDING
- Technicians are available in the system
- Service date is confirmed

### Step-by-Step Process

**1. View Pending Orders**
- Dashboard → Orders (Kanban view or List view)
- Filter by status: PENDING
- Review order details: customer, location, service type, scheduled date

**2. Select Technician**
- Click "Assign" on order card (Kanban) or row (List)
- View available technicians with:
  - Current workload (number of assigned jobs)
  - Skills/specializations
  - Location proximity (if available)
- Select appropriate technician

**3. Assign Order**
- Click "Assign to [Technician Name]"
- Order status changes: PENDING → ASSIGNED
- Technician receives push notification (if enabled)
- Order appears in technician's mobile app job list

**4. Technician Receives Assignment**
- Push notification: "New job assigned: [Customer Name] - [Service Type]"
- Technician opens mobile app
- Views job details:
  - Customer name and contact
  - Service location address (with map link)
  - AC unit details
  - Service type and notes
  - Scheduled date/time

### Assignment Best Practices

**DO:**
- ✅ Assign orders at least 1 day before scheduled date
- ✅ Consider technician workload (don't overload)
- ✅ Match technician skills to service type (e.g., refrigerant specialist for leak repair)
- ✅ Verify technician has necessary tools/parts
- ✅ Confirm technician availability before assigning
- ✅ Send push notification to technician after assignment

**DON'T:**
- ❌ Assign orders on the same day without technician confirmation
- ❌ Assign multiple urgent jobs to one technician simultaneously
- ❌ Assign complex repairs to junior technicians without supervision
- ❌ Forget to notify technician (check push notification sent)
- ❌ Assign orders to inactive/unavailable technicians

### Rescheduling Orders

**When to Reschedule:**
- Customer requests date change
- Technician unavailable (sick, emergency)
- Weather conditions prevent service
- Parts not available

**How to Reschedule:**
1. Open order detail
2. Click "Reschedule"
3. Select new date/time
4. Add reschedule reason (required)
5. Confirm reschedule
6. Order status resets: ASSIGNED → PENDING
7. Technician receives notification of reschedule
8. Re-assign order to same or different technician

**Reschedule Best Practices:**
- ✅ Notify customer of reschedule immediately
- ✅ Provide clear reason for reschedule
- ✅ Offer alternative dates within 3 days
- ✅ Update order notes with reschedule history
- ✅ Re-assign to same technician if possible (maintains continuity)

### Reassigning Orders

**When to Reassign:**
- Technician requests transfer (workload, location, skills)
- Customer requests specific technician
- Original technician unavailable after assignment

**How to Reassign:**
1. Open order detail (must be in ASSIGNED status)
2. Click "Reassign"
3. Select new technician
4. Add reassignment reason (required)
5. Confirm reassignment
6. Original technician receives notification (job removed)
7. New technician receives notification (job assigned)

**Reassignment Best Practices:**
- ✅ Only reassign in ASSIGNED status (before technician starts travel)
- ✅ Notify both technicians of reassignment
- ✅ Document reassignment reason in order notes
- ✅ Avoid frequent reassignments (confuses technicians and customers)

---

## Service Execution

### Technician Workflow (Mobile App)

**1. View Assigned Jobs**
- Open technician mobile app
- View job list (sorted by scheduled date)
- Job cards show:
  - Customer name
  - Service location
  - Service type
  - Scheduled date/time
  - Current status

**2. Start Travel (EN_ROUTE)**
- On service day, open job detail
- Click "Start Travel" button
- Order status changes: ASSIGNED → EN_ROUTE
- Admin sees real-time update on Kanban board
- Timestamp recorded for travel start time

**3. Arrive On-Site (IN_PROGRESS)**
- Upon arrival at customer location
- Click "Arrive" button
- Order status changes: EN_ROUTE → IN_PROGRESS
- Timestamp recorded for arrival time
- Begin service work

**4. Complete Service Work**
- Perform AC service (cleaning, repair, maintenance)
- Use materials/addons from inventory
- Document findings and issues
- Take before/after photos

**5. Submit Service Report (COMPLETED)**
- Click "Complete Job" button
- Fill service report form:

**A. Photo Upload**
- Take "Before" photos (minimum 2):
  - AC unit exterior
  - AC unit interior (before cleaning)
- Perform service work
- Take "After" photos (minimum 2):
  - AC unit exterior (after service)
  - AC unit interior (after cleaning)
- Photos are compressed automatically (reduces upload size)
- Works offline (photos queued for upload when online)

**B. Material/Addon Entry**
- Add materials used during service:
  - Select from addon catalog
  - Enter quantity used
  - System calculates total cost
  - Stock is deducted automatically
- If material not in catalog:
  - Click "Request Part Baru" (Request New Part)
  - Fill: Category, item name, proposed price, unit, description
  - Submit request to admin for approval
  - Admin reviews and approves with final price and stock
  - Approved part appears in addon catalog

**C. Service Findings**
- Document service findings:
  - AC condition (good, fair, poor)
  - Issues found (refrigerant leak, dirty filter, etc.)
  - Recommendations for customer
  - Next service due date (system generates reminder)

**D. Customer Signature**
- Capture customer signature on mobile device
- Signature confirms service completion
- Required before submission

**6. Submit Report**
- Review all entered data
- Click "Submit Report"
- Order status changes: IN_PROGRESS → COMPLETED
- Report syncs to server (or queued if offline)
- Admin receives notification
- Order appears in "Completed" column on Kanban board

### Service Execution Best Practices

**DO:**
- ✅ Take clear, well-lit photos (before and after)
- ✅ Document all materials used accurately
- ✅ Record detailed service findings
- ✅ Set realistic next service due date
- ✅ Get customer signature before leaving site
- ✅ Submit report immediately after service
- ✅ Request new parts if not in catalog (don't skip)

**DON'T:**
- ❌ Skip photo upload (required for quality control)
- ❌ Forget to record materials used (affects invoicing)
- ❌ Leave service findings blank (needed for history)
- ❌ Submit report without customer signature
- ❌ Use materials without recording (causes stock discrepancies)
- ❌ Set unrealistic next service dates (causes reminder issues)

---

## Invoicing & Payment

### Invoice Generation Process

**Prerequisites:**
- Order status: COMPLETED
- Service report submitted by technician
- Materials and costs recorded

### Step-by-Step Process

**1. Review Completed Order**
- Dashboard → Orders → Filter by "Completed"
- Click on order to view details
- Review service report:
  - Photos (before/after)
  - Materials used
  - Service findings
  - Customer signature

**2. Generate Final Invoice**
- Click "Generate Invoice" button
- Invoice auto-populates with:
  - Service items (from order)
  - Materials/addons used (from service report)
  - Actual costs (from addon catalog)
  - Labor costs (if configured)
- Review invoice line items
- Adjust quantities or prices if needed (with reason)
- Add discount if applicable

**3. Invoice Details**
- Invoice type: FINAL (not proforma)
- Invoice number: Auto-generated (INV-YYYYMMDD-XXXX)
- Invoice date: Current date
- Due date: Current date + payment terms (default: 7 days)
- Status: DRAFT (not sent yet)

**4. Review and Finalize**
- Verify all line items are correct
- Check total amount
- Add payment instructions (bank account, payment methods)
- Add notes if needed
- Click "Finalize Invoice"
- Invoice status changes: DRAFT → PENDING
- Order status changes: COMPLETED → INVOICED

**5. Send Invoice to Customer**
- Click "Send Invoice" button
- Options:
  - **Email**: Send via Resend API (requires RESEND_API_KEY)
  - **PDF Export**: Download PDF and send manually
  - **Print**: Print invoice for hand delivery
- Invoice sent timestamp recorded

### Proforma Invoice vs Final Invoice

**Proforma Invoice:**
- Generated BEFORE service (optional)
- Uses estimated prices from service catalog
- Purpose: Deposit, PO, contract approval
- Status: DRAFT (not final)
- Does NOT affect order status
- Common for: Corporate clients, contract-based billing

**Final Invoice:**
- Generated AFTER service completion
- Uses actual costs from service report
- Purpose: Payment collection
- Status: PENDING → PAID
- Changes order status: COMPLETED → INVOICED → PAID
- Required for: All orders

### Invoice Best Practices

**DO:**
- ✅ Review service report before generating invoice
- ✅ Verify material costs match addon catalog
- ✅ Add clear payment instructions
- ✅ Set realistic due dates (7-14 days for retail, 30 days for corporate)
- ✅ Send invoice within 24 hours of service completion
- ✅ Follow up on overdue invoices

**DON'T:**
- ❌ Generate invoice without reviewing service report
- ❌ Manually adjust prices without documentation
- ❌ Send invoice before order is COMPLETED
- ❌ Skip payment instructions (causes payment delays)
- ❌ Set unrealistic due dates (same day for corporate clients)

---

## Payment Scenarios

This section covers different payment scenarios for various customer types: retail walk-in, corporate clients, and contract-based billing.

### Scenario 1: Full Payment Upfront (Retail)

**Customer Type:** Retail walk-in, residential customers

**Use Case:** Customer pays full amount immediately after service completion

**Workflow:**

1. **Order Creation**
   - Admin creates order (no proforma invoice needed)
   - Order status: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS

2. **Service Completion**
   - Technician completes service and submits report
   - Order status: IN_PROGRESS → COMPLETED

3. **Invoice Generation**
   - Admin generates final invoice
   - Invoice uses actual costs from service report
   - Order status: COMPLETED → INVOICED

4. **Payment Collection**
   - Finance records payment immediately
   - Payment method: Cash / Bank Transfer / Credit Card
   - Payment amount: Full invoice amount
   - Payment date: Same day as invoice
   - Order status: INVOICED → PAID

**Example:**
- Service: AC Cleaning (1 unit, 1.5 PK)
- Service cost: Rp 150,000
- Materials used: Cleaning solution (Rp 25,000)
- Total invoice: Rp 175,000
- Payment: Cash, full amount, same day
- Order closed: PAID

**Best Practices:**
- ✅ Generate invoice immediately after service
- ✅ Collect payment before technician leaves (if cash)
- ✅ Provide receipt immediately
- ✅ Record payment same day

---

### Scenario 2: Deposit + Balance (Proforma Invoice)

**Customer Type:** Corporate clients, large projects, new customers

**Use Case:** Customer requires PO/deposit before service, pays balance after completion

**Workflow:**

1. **Order Creation with Proforma**
   - Admin creates order
   - Check "Generate Proforma Invoice" option
   - Proforma invoice created with estimated costs
   - Proforma status: DRAFT
   - Order status: PENDING

2. **Deposit Payment**
   - Send proforma invoice to customer
   - Customer pays deposit (typically 30-50% of estimated total)
   - Finance records deposit payment:
     - Payment type: Deposit
     - Amount: Rp 500,000 (example: 50% of Rp 1,000,000 estimate)
     - Payment date: Before service date
   - Order status: PENDING (unchanged, waiting for service)

3. **Service Execution**
   - Technician assigned and completes service
   - Order status: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED

4. **Final Invoice Generation**
   - Admin generates final invoice with actual costs
   - Final invoice may differ from proforma (actual vs estimated)
   - System shows:
     - Total invoice amount: Rp 950,000 (actual cost)
     - Deposit paid: Rp 500,000
     - Balance due: Rp 450,000
   - Order status: COMPLETED → INVOICED

5. **Balance Payment**
   - Finance records balance payment:
     - Payment type: Balance
     - Amount: Rp 450,000
     - Payment date: Within payment terms (e.g., 7 days)
   - Order status: INVOICED → PAID

**Example:**
- Service: AC Installation (3 units, 2 PK each)
- Proforma estimate: Rp 3,000,000
- Deposit (50%): Rp 1,500,000 (paid before service)
- Actual cost: Rp 3,200,000 (higher due to additional materials)
- Balance due: Rp 1,700,000 (Rp 3,200,000 - Rp 1,500,000)
- Balance payment: Bank transfer, 7 days after service
- Order closed: PAID

**Best Practices:**
- ✅ Generate proforma for orders >Rp 1,000,000
- ✅ Collect 30-50% deposit before service
- ✅ Clearly communicate that final invoice may differ from proforma
- ✅ Send final invoice within 24 hours of service completion
- ✅ Track deposit and balance separately in payment records

**DON'T:**
- ❌ Skip proforma for large corporate orders
- ❌ Collect 100% deposit (leaves no incentive for quality)
- ❌ Forget to deduct deposit from final invoice
- ❌ Generate final invoice before service completion

---

### Scenario 3: Installment Payment (Corporate - Nyicil)

**Customer Type:** Corporate clients, contract-based customers, large projects

**Use Case:** Customer pays in multiple installments over time (monthly, quarterly)

**Workflow:**

1. **Order Creation with Payment Plan**
   - Admin creates order
   - Generate proforma invoice with payment terms
   - Document payment plan in order notes:
     - Total amount: Rp 10,000,000
     - Installments: 4 payments (monthly)
     - Payment schedule: 1st of each month
   - Order status: PENDING

2. **Service Execution**
   - Service completed as normal
   - Order status: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED

3. **Final Invoice Generation**
   - Admin generates final invoice
   - Invoice shows:
     - Total amount: Rp 10,000,000
     - Payment terms: 4 monthly installments of Rp 2,500,000
     - Due dates: 1st of each month
   - Order status: COMPLETED → INVOICED

4. **Installment Payments**
   - **Payment 1** (Month 1):
     - Amount: Rp 2,500,000
     - Payment date: 2026-07-01
     - Status: Partial payment (25% paid)
   - **Payment 2** (Month 2):
     - Amount: Rp 2,500,000
     - Payment date: 2026-08-01
     - Status: Partial payment (50% paid)
   - **Payment 3** (Month 3):
     - Amount: Rp 2,500,000
     - Payment date: 2026-09-01
     - Status: Partial payment (75% paid)
   - **Payment 4** (Month 4):
     - Amount: Rp 2,500,000
     - Payment date: 2026-10-01
     - Status: PAID (100% paid)
   - Order status: INVOICED → PAID (after final installment)

**Example:**
- Service: Annual AC Maintenance Contract (10 units, 12 months)
- Total contract value: Rp 12,000,000
- Payment plan: 12 monthly installments of Rp 1,000,000
- Payment method: Bank transfer (auto-debit)
- Payment schedule: 1st of each month
- Order closed: PAID (after 12 months)

**Best Practices:**
- ✅ Document payment plan in contract and order notes
- ✅ Set up payment reminders (7 days before due date)
- ✅ Track each installment separately in payment records
- ✅ Send payment confirmation after each installment
- ✅ Follow up immediately on missed installments
- ✅ Consider auto-debit for corporate clients

**DON'T:**
- ❌ Offer installments without signed contract
- ❌ Skip payment reminders (causes late payments)
- ❌ Mark order as PAID before final installment
- ❌ Forget to track partial payment amounts

---

### Scenario 4: Contract-Based Billing (Kontrak)

**Customer Type:** Corporate clients with annual maintenance contracts, facility management companies

**Use Case:** Customer signs annual contract with monthly retainer + deposit upfront, covers multiple service visits

**Workflow:**

1. **Contract Negotiation & Signing**
   - Negotiate annual contract terms:
     - Contract period: 12 months
     - Service coverage: 20 AC units, monthly maintenance
     - Total contract value: Rp 24,000,000
     - Payment structure: Deposit + monthly retainer
   - Sign contract with payment terms

2. **Deposit Payment (Before Contract Start)**
   - Customer pays deposit (typically 1-2 months retainer)
   - Deposit amount: Rp 4,000,000 (2 months × Rp 2,000,000)
   - Finance records deposit payment:
     - Payment type: Contract Deposit
     - Amount: Rp 4,000,000
     - Payment date: Before contract start date
     - Contract reference: CONTRACT-2026-001

3. **Monthly Service Orders**
   - Each month, admin creates service order for scheduled maintenance
   - Order references contract number
   - Service completed as normal (technician visits, submits report)
   - Order status: PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED

4. **Monthly Invoice Generation**
   - Admin generates monthly invoice:
     - Invoice amount: Rp 2,000,000 (monthly retainer)
     - Invoice references contract number
     - Deduct from deposit if applicable (first 2 months)
   - **Month 1-2**: Deducted from deposit (no payment needed)
   - **Month 3-12**: Customer pays monthly retainer
   - Order status: COMPLETED → INVOICED

5. **Monthly Retainer Payments**
   - **Month 1**: Deducted from deposit (Rp 2,000,000 from Rp 4,000,000)
   - **Month 2**: Deducted from deposit (Rp 2,000,000 from remaining Rp 2,000,000)
   - **Month 3**: Customer pays Rp 2,000,000 (deposit exhausted)
   - **Month 4-12**: Customer pays Rp 2,000,000 each month
   - Payment method: Bank transfer (auto-debit recommended)
   - Payment schedule: 1st of each month
   - Order status: INVOICED → PAID (each month)

6. **Contract Renewal**
   - At end of 12 months, review contract performance
   - Negotiate renewal terms
   - Collect new deposit for next contract period

**Example:**
- Customer: PT ABC Facility Management
- Contract: Annual AC Maintenance (50 units, 12 months)
- Total value: Rp 60,000,000
- Deposit: Rp 10,000,000 (2 months retainer)
- Monthly retainer: Rp 5,000,000
- Payment: Auto-debit on 1st of each month
- Month 1-2: Deducted from deposit
- Month 3-12: Monthly payment of Rp 5,000,000

**Best Practices:**
- ✅ Collect 1-2 months deposit before contract start
- ✅ Set up auto-debit for monthly retainer (reduces late payments)
- ✅ Reference contract number in all orders and invoices
- ✅ Track deposit balance separately
- ✅ Send monthly invoice 7 days before due date
- ✅ Review contract performance quarterly
- ✅ Start renewal negotiation 2 months before contract end

**DON'T:**
- ❌ Start contract without signed agreement
- ❌ Skip deposit collection (leaves no buffer for non-payment)
- ❌ Forget to reference contract number in orders
- ❌ Mix contract orders with non-contract orders
- ❌ Wait until contract end to discuss renewal

---

### Payment Recording Best Practices

**General Guidelines:**

1. **Record Payments Promptly**
   - Record payment within 24 hours of receipt
   - Verify payment amount matches invoice
   - Attach payment proof (bank transfer receipt, etc.)

2. **Payment Method Tracking**
   - Cash: Record immediately, issue receipt
   - Bank Transfer: Verify transfer before recording
   - Credit Card: Record after payment confirmation
   - Auto-debit: Record on scheduled date

3. **Partial Payment Handling**
   - Record each partial payment separately
   - Track remaining balance
   - Update invoice status (Partial Paid / Paid)
   - Send payment confirmation after each payment

4. **Payment Reconciliation**
   - Daily: Reconcile cash payments
   - Weekly: Reconcile bank transfers
   - Monthly: Reconcile all payment records
   - Quarterly: Audit payment records vs bank statements

**Common Payment Issues:**

**Issue: Customer pays wrong amount**
- Solution: Contact customer immediately, record actual amount received, issue credit note or request balance

**Issue: Payment received but no invoice reference**
- Solution: Contact customer for invoice number, match payment to invoice manually

**Issue: Duplicate payment recorded**
- Solution: Void duplicate payment record, issue refund or credit note

**Issue: Late payment**
- Solution: Send payment reminder 3 days after due date, follow up by phone after 7 days

---

## Do's and Don'ts

### Order Management

**DO:**
- ✅ Verify customer contact information before creating order
- ✅ Confirm service location address is accurate
- ✅ Assign orders at least 1 day before scheduled date
- ✅ Monitor order progress on Kanban board
- ✅ Follow up with technician if order stuck in one status >24 hours
- ✅ Document all order changes in notes (reschedule, reassign, cancel)
- ✅ Generate invoice within 24 hours of service completion

**DON'T:**
- ❌ Create orders without customer confirmation
- ❌ Assign orders to unavailable technicians
- ❌ Skip order notes (needed for context and history)
- ❌ Forget to notify technician of assignment
- ❌ Leave orders in COMPLETED status >48 hours without invoicing
- ❌ Cancel orders without documenting reason

### Technician Management

**DO:**
- ✅ Distribute workload evenly among technicians
- ✅ Match technician skills to service type
- ✅ Provide clear service instructions in order notes
- ✅ Ensure technician has necessary tools and materials
- ✅ Follow up on service quality (review photos and reports)
- ✅ Provide feedback to technicians on report quality

**DON'T:**
- ❌ Overload one technician while others are idle
- ❌ Assign complex repairs to junior technicians without supervision
- ❌ Skip technician training on new equipment
- ❌ Ignore technician feedback on service issues
- ❌ Forget to approve addon requests from technicians

### Invoicing & Payment

**DO:**
- ✅ Generate invoices within 24 hours of service completion
- ✅ Review service report before generating invoice
- ✅ Verify material costs match addon catalog
- ✅ Send invoices via email with PDF attachment
- ✅ Set realistic payment terms (7-14 days retail, 30 days corporate)
- ✅ Track payment status daily
- ✅ Send payment reminders 3 days before due date
- ✅ Record payments within 24 hours of receipt
- ✅ Issue payment receipts immediately
- ✅ Reconcile payments weekly

**DON'T:**
- ❌ Generate invoices before service completion
- ❌ Skip invoice review (causes pricing errors)
- ❌ Send invoices without payment instructions
- ❌ Set unrealistic due dates (same day for corporate)
- ❌ Forget to follow up on overdue invoices
- ❌ Record payments without verification
- ❌ Mix personal and business payments
- ❌ Skip payment reconciliation

### Customer Service

**DO:**
- ✅ Respond to customer inquiries within 24 hours
- ✅ Confirm service appointments 1 day before
- ✅ Notify customers of technician arrival time
- ✅ Follow up after service completion (quality check)
- ✅ Address customer complaints immediately
- ✅ Document all customer interactions in order notes
- ✅ Maintain professional communication at all times
- ✅ Provide clear service explanations and recommendations

**DON'T:**
- ❌ Ignore customer calls or messages
- ❌ Skip appointment confirmations (causes no-shows)
- ❌ Arrive late without notification
- ❌ Dismiss customer complaints
- ❌ Use technical jargon customers don't understand
- ❌ Promise service dates you can't meet
- ❌ Forget to follow up on service quality

---

## Troubleshooting

### Common Business Process Issues

**Issue: Order stuck in PENDING for >3 days**

**Symptoms:**
- Order created but not assigned
- Customer waiting for service
- No technician assigned

**Root Causes:**
- Forgot to assign technician
- No available technicians
- Waiting for customer confirmation

**Solutions:**
1. Check technician availability
2. Assign to available technician immediately
3. If no technicians available, reschedule order
4. Contact customer to confirm service date
5. Document reason for delay in order notes

---

**Issue: Technician not receiving push notifications**

**Symptoms:**
- Technician unaware of new assignments
- Delayed service start
- Customer complaints about no-show

**Root Causes:**
- Push notifications not enabled
- VAPID keys not configured
- Service worker not registered
- Technician denied notification permission

**Solutions:**
1. Verify VAPID keys in environment variables
2. Ask technician to enable notifications in profile
3. Check service worker registration in browser DevTools
4. Fallback: Call technician directly to notify

---

**Issue: Invoice amount doesn't match service report**

**Symptoms:**
- Customer disputes invoice amount
- Materials cost mismatch
- Service items missing or incorrect

**Root Causes:**
- Technician recorded wrong materials
- Admin adjusted prices without documentation
- Service catalog prices outdated
- Materials not in addon catalog

**Solutions:**
1. Review service report photos and materials list
2. Verify material costs in addon catalog
3. Contact technician to confirm materials used
4. Adjust invoice with documented reason
5. Update addon catalog if prices changed

---

**Issue: Payment recorded but order still shows INVOICED**

**Symptoms:**
- Finance recorded payment
- Order status not updated to PAID
- Customer confused about payment status

**Root Causes:**
- Payment amount doesn't match invoice total (partial payment)
- Payment recorded for wrong order
- System error in status update

**Solutions:**
1. Verify payment amount matches invoice total
2. Check payment is linked to correct order
3. If partial payment, record remaining balance
4. If full payment, manually update order status to PAID
5. Contact tech support if system error persists

---

**Issue: Customer requests refund after service**

**Symptoms:**
- Customer unsatisfied with service quality
- Requests full or partial refund
- Threatens negative review

**Root Causes:**
- Service quality below expectations
- Technician behavior issues
- Miscommunication about service scope
- Pricing disputes

**Solutions:**
1. Review service report and photos
2. Contact technician for their account
3. Offer re-service at no charge (if quality issue)
4. Offer partial refund if appropriate
5. Document resolution in order notes
6. Follow up to ensure customer satisfaction

---

**Issue: Proforma invoice amount differs significantly from final invoice**

**Symptoms:**
- Customer surprised by final invoice amount
- Disputes additional charges
- Refuses to pay balance

**Root Causes:**
- Proforma estimate too low
- Additional materials needed (not estimated)
- Service scope expanded during work
- Pricing errors in proforma

**Solutions:**
1. Review service report for additional work
2. Explain additional materials/services to customer
3. Provide itemized breakdown of differences
4. Offer discount if estimate was significantly off
5. Improve proforma estimation process
6. Document all scope changes during service

---

## Conclusion

This business process guide covers the complete order lifecycle from creation to payment, including detailed payment scenarios for different customer types.

**Key Takeaways:**

1. **Order Lifecycle**: Follow the 8-state workflow strictly (PENDING → ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED → INVOICED → PAID)

2. **Payment Scenarios**: Choose appropriate payment structure based on customer type:
   - Retail: Full payment upfront
   - Corporate: Deposit + balance or installment
   - Contract: Deposit + monthly retainer

3. **Communication**: Keep customers and technicians informed at every stage

4. **Documentation**: Record all actions, changes, and decisions in order notes

5. **Quality Control**: Review service reports and photos before invoicing

6. **Follow-up**: Track payment status and follow up on overdue invoices

**For Technical Documentation:**
- See [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture
- See [api.md](api.md) for REST API reference
- See [README.md](../README.md) for quick start guide

**For Support:**
- Contact system administrator for technical issues
- Contact finance team for payment disputes
- Contact operations manager for process improvements

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-01  
**Maintained By:** Operations Team