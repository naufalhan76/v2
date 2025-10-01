# Additional Database Column Fixes - SELECT Queries

## Problem
Previous fix only updated the **search queries** and **form parameters**, but forgot to update the **SELECT queries** that fetch data from Supabase. This caused the app to try selecting non-existent columns like `address`, `city`, `model`, etc.

---

## Files Fixed

### 1. ✅ `src/lib/actions/ac-units.ts`

#### Fixed `getAcUnits()` - Line ~22:
```typescript
// OLD
locations (
  location_id,
  address,           // ❌ Column doesn't exist
  city,              // ❌ Column doesn't exist
  customers (...)
)

// NEW
locations (
  location_id,
  building_name,     // ✅ Correct
  floor,             // ✅ Correct
  room_number,       // ✅ Correct
  description,       // ✅ Correct
  customers (...)
)
```

#### Fixed `getAcUnitById()` - Line ~83:
```typescript
// OLD
locations (
  location_id,
  address,           // ❌
  city,              // ❌
  province,          // ❌
  postal_code,       // ❌
  customers (...)
)

technicians (
  technician_id,
  name,              // ❌ Column doesn't exist
  phone              // ❌ Column doesn't exist
)

// NEW
locations (
  location_id,
  building_name,     // ✅
  floor,             // ✅
  room_number,       // ✅
  description,       // ✅
  customers (...)
)

technicians (
  technician_id,
  technician_name,   // ✅ Correct
  contact_number     // ✅ Correct
)
```

---

### 2. ✅ `src/lib/actions/locations.ts`

#### Fixed `getLocationById()` - Line ~73:
```typescript
// OLD
ac_units (
  ac_unit_id,
  brand,
  model,             // ❌ Column doesn't exist
  serial_number,
  status
)

// NEW
ac_units (
  ac_unit_id,
  brand,
  model_number,      // ✅ Correct
  serial_number,
  status
)
```

---

### 3. ✅ `src/lib/actions/orders.ts`

#### Fixed `getOrders()` - Line ~31:
```typescript
// OLD
locations (
  location_id,
  address,           // ❌
  city               // ❌
)

// NEW
locations (
  location_id,
  building_name,     // ✅
  floor,             // ✅
  room_number,       // ✅
  description        // ✅
)
```

#### Fixed `getOrderById()` - Line ~97:
```typescript
// OLD
locations (
  location_id,
  address,           // ❌
  city,              // ❌
  province,          // ❌
  postal_code        // ❌
)

technicians (
  technician_id,
  name,              // ❌
  phone              // ❌
)

ac_units (
  ac_unit_id,
  brand,
  model,             // ❌
  serial_number
)

// NEW
locations (
  location_id,
  building_name,     // ✅
  floor,             // ✅
  room_number,       // ✅
  description        // ✅
)

technicians (
  technician_id,
  technician_name,   // ✅
  contact_number     // ✅
)

ac_units (
  ac_unit_id,
  brand,
  model_number,      // ✅
  serial_number
)
```

---

## Summary of Changes

### Locations Table - Fixed in 3 files:
| File | Function | Fixed |
|------|----------|-------|
| ac-units.ts | getAcUnits() | ✅ |
| ac-units.ts | getAcUnitById() | ✅ |
| orders.ts | getOrders() | ✅ |
| orders.ts | getOrderById() | ✅ |

**Changed:**
- ❌ `address`, `city`, `province`, `postal_code`
- ✅ `building_name`, `floor`, `room_number`, `description`

---

### Technicians Table - Fixed in 2 files:
| File | Function | Fixed |
|------|----------|-------|
| ac-units.ts | getAcUnitById() | ✅ |
| orders.ts | getOrderById() | ✅ |

**Changed:**
- ❌ `name`, `phone`
- ✅ `technician_name`, `contact_number`

---

### AC Units Table - Fixed in 2 files:
| File | Function | Fixed |
|------|----------|-------|
| locations.ts | getLocationById() | ✅ |
| orders.ts | getOrderById() | ✅ |

**Changed:**
- ❌ `model`
- ✅ `model_number`

---

## What Was Missing Before?

Previous fix (DATABASE_COLUMN_FIXES.md) only updated:
1. ✅ Search query parameters (WHERE clause)
2. ✅ Form data structures
3. ✅ Interface types
4. ✅ UI table columns
5. ❌ **SELECT queries** - THIS WAS MISSING!

This caused errors like:
```
column "address" does not exist
column "city" does not exist
column "model" does not exist
column "name" does not exist in technicians table
```

---

## Testing Checklist

### ✅ AC Units:
- [ ] Fetch list of AC units (should show location building name)
- [ ] View AC unit details (should show location details)
- [ ] Check if location info displays correctly

### ✅ Locations:
- [ ] Fetch location details
- [ ] Check if AC units linked to location show model_number

### ✅ Orders:
- [ ] Fetch list of orders (should show location building name)
- [ ] View order details (should show location, technician, AC unit correctly)
- [ ] Check technician name displays correctly
- [ ] Check AC unit model number displays correctly

---

## All Fixed Files Summary

### Previous Fix:
1. ✅ src/lib/actions/locations.ts (search + update params)
2. ✅ src/lib/actions/technicians.ts (search + CRUD params)
3. ✅ src/lib/actions/ac-units.ts (search + CRUD params)
4. ✅ src/app/dashboard/manajemen/lokasi/page.tsx
5. ✅ src/app/dashboard/manajemen/teknisi/page.tsx
6. ✅ src/app/dashboard/manajemen/ac-units/page.tsx

### This Fix (SELECT queries):
7. ✅ src/lib/actions/ac-units.ts (SELECT queries)
8. ✅ src/lib/actions/locations.ts (SELECT queries)
9. ✅ src/lib/actions/orders.ts (SELECT queries)

---

## Status

✅ **All SELECT queries now match database structure!**

The app should now work correctly when fetching:
- AC units with location info
- Locations with AC units
- Orders with location, technician, and AC unit info
- AC unit details with service records and technicians

Ready to test! 🚀
