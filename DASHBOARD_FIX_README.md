# 🔥 DASHBOARD FIX GUIDE
## Troubleshooting Data Issues & Database Requirements

---

## 🚨 **Current Issues**

### **1. Dashboard KPIs Not Loading (0 values)**
**Error**: `column payments.amount does not exist`

**Root Cause**: Database schema mismatch antara code dan actual Supabase tables

**Symptoms**:
- Dashboard menampilkan angka 0 semua
- Console error: `Error fetching dashboard KPIs`
- KPI cards kosong (Total Orders, Revenue, dll)

---

## 📋 **DATABASE REQUIREMENTS CHECKLIST**

### **✅ Tables Yang Harus Ada:**

#### **1. orders**
```sql
CREATE TABLE orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  location_id UUID REFERENCES locations(location_id),
  order_date TIMESTAMP DEFAULT NOW(),
  order_type TEXT,
  description TEXT,
  status TEXT DEFAULT 'NEW',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Required Status Values**:
- `NEW`, `ACCEPTED`, `ASSIGNED`, `OTW`, `ARRIVED`, `IN_PROGRESS`
- `TO_WORKSHOP`, `IN_WORKSHOP`, `READY_TO_RETURN`
- `DONE`, `DELIVERED`, `INVOICED`, `PAID`, `CLOSED`
- `CANCELLED`

#### **2. customers**
```sql
CREATE TABLE customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  primary_contact_person TEXT,
  email TEXT,
  phone_number TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **3. technicians**
```sql
CREATE TABLE technicians (
  technician_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_name TEXT NOT NULL,
  company TEXT,
  contact_number TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **4. payments** ⚠️ **MISSING COLUMN**
```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES service_records(service_id),
  customer_id UUID REFERENCES customers(customer_id),
  payment_date TIMESTAMP DEFAULT NOW(),
  amount_paid NUMERIC NOT NULL,  -- ❌ Code expects 'amount', table has 'amount_paid'
  payment_method TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**🔥 CRITICAL**: Code mencari `payments.amount` tapi table punya `payments.amount_paid`

#### **5. locations**
```sql
CREATE TABLE locations (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  building_name TEXT,
  floor TEXT,
  room_number TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **6. service_records**
```sql
CREATE TABLE service_records (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ac_unit_id UUID REFERENCES ac_units(ac_unit_id),
  technician_id UUID REFERENCES technicians(technician_id),
  order_id UUID REFERENCES orders(order_id),
  service_date TIMESTAMP DEFAULT NOW(),
  service_type TEXT,
  description_of_work TEXT,
  cost NUMERIC,
  next_service_due TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **7. ac_units**
```sql
CREATE TABLE ac_units (
  ac_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT,
  model_number TEXT,
  serial_number TEXT,
  ac_type TEXT,
  capacity_btu INTEGER,
  installation_date TIMESTAMP,
  location_id UUID REFERENCES locations(location_id),
  status TEXT DEFAULT 'ACTIVE',
  last_service_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛠️ **IMMEDIATE FIXES NEEDED**

### **Fix 1: Payments Table Column**

**Option A - Rename Column (Recommended)**:
```sql
-- Rename 'amount_paid' to 'amount' in payments table
ALTER TABLE payments RENAME COLUMN amount_paid TO amount;
```

**Option B - Update Code**:
```typescript
// In src/lib/actions/dashboard.ts, line 52-56
const { data: paymentsData, error: paymentsError } = await supabase
  .from('payments')
  .select('amount_paid')  // Change 'amount' to 'amount_paid'
  .eq('status', 'PAID')
```

### **Fix 2: Customer Table Column**

**Check customers table**:
```sql
-- Code expects 'name' but table might have 'customer_name'
-- In getRecentOrders(), line 95-99
SELECT customers.name  -- ❌ Might not exist
-- vs
SELECT customers.customer_name  -- ✅ Actual column
```

**Update code or rename column**:
```sql
-- Option A: Rename column
ALTER TABLE customers RENAME COLUMN customer_name TO name;

-- Option B: Update code to use 'customer_name'
```

### **Fix 3: Test Data**

**Add sample data untuk testing**:
```sql
-- Insert sample customers
INSERT INTO customers (customer_name, email, phone_number) VALUES
('PT. Contoh Jaya', 'admin@contohjaya.com', '081234567890'),
('CV. Test Company', 'info@testco.com', '087654321098');

-- Insert sample technicians
INSERT INTO technicians (technician_name, company, email) VALUES
('John Doe', 'AC Service Pro', 'john@acpro.com'),
('Jane Smith', 'Cool Tech', 'jane@cooltech.com');

-- Insert sample orders
INSERT INTO orders (customer_id, order_type, description, status) 
SELECT customer_id, 'MAINTENANCE', 'AC Cleaning Service', 'COMPLETED'
FROM customers LIMIT 2;

-- Insert sample payments
INSERT INTO payments (customer_id, amount, status)
SELECT customer_id, 500000, 'PAID'
FROM customers LIMIT 2;
```

---

## 🔍 **DEBUGGING STEPS**

### **Step 1: Check Table Structure**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'customers', 'technicians', 'payments');

-- Check payments table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments';

-- Check customers table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers';
```

### **Step 2: Check Data**
```sql
-- Count records in each table
SELECT 'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'technicians', COUNT(*) FROM technicians
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

-- Check payments data
SELECT * FROM payments LIMIT 5;

-- Check customers data
SELECT * FROM customers LIMIT 5;
```

### **Step 3: Test Dashboard Queries**
```sql
-- Test total orders count
SELECT COUNT(*) as total_orders FROM orders;

-- Test revenue calculation (adjust column name if needed)
SELECT SUM(amount) as total_revenue 
FROM payments 
WHERE status = 'PAID';
-- OR
SELECT SUM(amount_paid) as total_revenue 
FROM payments 
WHERE status = 'PAID';

-- Test orders with customers join
SELECT o.*, c.customer_name 
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LIMIT 5;
```

---

## 📝 **ACTION ITEMS**

### **High Priority (Fix Dashboard)**
- [ ] **Fix payments.amount column issue**
- [ ] **Verify customers.name vs customer_name**  
- [ ] **Add sample test data**
- [ ] **Test dashboard KPIs loading**

### **Medium Priority (Data Setup)**
- [ ] **Populate orders dengan berbagai status**
- [ ] **Add real payment records**
- [ ] **Setup technicians data**
- [ ] **Create sample service records**

### **Low Priority (Optimization)**
- [ ] **Add database indexes**
- [ ] **Setup RLS policies**
- [ ] **Add data validation**

---

## 🚀 **TESTING CHECKLIST**

After fixes:
- [ ] Dashboard loads without console errors
- [ ] KPI numbers display correctly (not all 0s)
- [ ] Recent orders list shows data
- [ ] Revenue calculation works
- [ ] All 7 KPI cards show real data

---

## 📞 **Quick Fix Commands**

```bash
# 1. Check current database structure
# Run in Supabase SQL Editor

# 2. If payments table has 'amount_paid' instead of 'amount':
ALTER TABLE payments RENAME COLUMN amount_paid TO amount;

# 3. If customers table has 'customer_name' instead of 'name':
ALTER TABLE customers RENAME COLUMN customer_name TO name;

# 4. Add sample data for testing
# (Copy SQL from "Fix 3: Test Data" section above)

# 5. Test dashboard
# Refresh http://localhost:3000/dashboard
```

---

**💡 TIP**: Start with fixing the `payments.amount` column issue first - ini yang paling critical untuk dashboard KPIs!