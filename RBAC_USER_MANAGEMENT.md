# Role-Based Access Control (RBAC)

## User Management Page - SUPERADMIN Only

### Overview
Halaman User Management (`/dashboard/manajemen/user`) hanya bisa diakses oleh user dengan role **SUPERADMIN**. User dengan role lain (ADMIN, OPERATOR, STAFF) tidak akan melihat menu ini dan tidak bisa mengakses halaman tersebut.

---

## Implementation

### 1. **Sidebar Menu Filtering** ✅
File: `src/components/sidebar.tsx`

**Features:**
- Menu "User" di sidebar hanya muncul untuk SUPERADMIN
- Fetch user role dari database saat sidebar mount
- Filter menu items berdasarkan `requireRole` property
- If semua children di parent menu tidak visible, parent juga hide

**Code:**
```typescript
// Menu item dengan role requirement
{
  title: 'User',
  href: '/dashboard/manajemen/user',
  requireRole: 'SUPERADMIN', // Only SUPERADMIN can see this
}

// Fetch user role
useEffect(() => {
  const fetchUserRole = async () => {
    const { data: userData } = await supabase
      .from('user_management')
      .select('role')
      .eq('auth_user_id', session.user.id)
      .single()
      
    setUserRole(userData?.role || null)
  }
  fetchUserRole()
}, [])

// Filter menu items
const filterMenuItems = (items: any[]) => {
  return items.filter(item => {
    if (item.requireRole && userRole !== item.requireRole) {
      return false
    }
    return true
  })
}
```

**Result:**
- ✅ SUPERADMIN → Menu "User" **muncul**
- ❌ ADMIN/OPERATOR/STAFF → Menu "User" **tidak muncul**

---

### 2. **Middleware Route Protection** ✅
File: `src/middleware.ts`

**Features:**
- Check role di middleware sebelum allow access
- Redirect ke `/dashboard` jika bukan SUPERADMIN
- Run sebelum page load (server-side check)

**Code:**
```typescript
// Role-based access control for specific routes
if (req.nextUrl.pathname.startsWith('/dashboard/manajemen/user')) {
  // Only SUPERADMIN can access user management
  if (userData.role !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
}
```

**Result:**
- ✅ SUPERADMIN → Access granted
- ❌ Non-SUPERADMIN → Redirect ke `/dashboard`

**Security:**
- Server-side check (tidak bisa dibypass dari client)
- Run sebelum page render
- Automatic redirect tanpa error message (silent redirect)

---

## User Flow

### SUPERADMIN Flow:

```
Login as SUPERADMIN
    ↓
Dashboard loaded
    ↓
Sidebar shows "User" menu ✅
    ↓
Click "User" menu
    ↓
Middleware check role → PASS ✅
    ↓
User Management page loaded ✅
```

### Non-SUPERADMIN Flow:

```
Login as ADMIN/OPERATOR/STAFF
    ↓
Dashboard loaded
    ↓
Sidebar: "User" menu HIDDEN ❌
    ↓
Try access URL directly: /dashboard/manajemen/user
    ↓
Middleware check role → FAIL ❌
    ↓
Redirect to /dashboard
```

---

## Security Layers

### Layer 1: UI/UX (Sidebar Hiding)
- **Purpose:** User experience - hide menu yang tidak bisa diakses
- **Location:** Client-side (sidebar component)
- **Can be bypassed?** Yes (via direct URL)
- **Result if bypassed:** Middleware will catch and redirect

### Layer 2: Middleware (Route Protection)
- **Purpose:** Security - prevent unauthorized access
- **Location:** Server-side (middleware)
- **Can be bypassed?** NO - server-side check
- **Result:** Automatic redirect to dashboard

### Layer 3: RLS Policies (Database)
- **Purpose:** Data security - prevent unauthorized queries
- **Location:** Database (Supabase RLS)
- **Can be bypassed?** NO - enforced by database
- **Result:** Query returns empty or error

---

## Adding More Role-Based Routes

### Contoh: Admin Only Page

**Step 1: Add requireRole to menu item**
```typescript
{
  title: 'Reports',
  href: '/dashboard/reports',
  requireRole: 'ADMIN', // Only ADMIN and above
}
```

**Step 2: Add middleware check**
```typescript
if (req.nextUrl.pathname.startsWith('/dashboard/reports')) {
  if (userData.role !== 'ADMIN' && userData.role !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
}
```

**Step 3: Add RLS policy (optional)**
```sql
CREATE POLICY "Admin can access reports"
  ON reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_management
      WHERE auth_user_id = auth.uid()
      AND role IN ('ADMIN', 'SUPERADMIN')
    )
  );
```

---

## Role Hierarchy

```
SUPERADMIN
    ↓ (highest privilege)
ADMIN
    ↓
OPERATOR
    ↓
STAFF
    ↓ (lowest privilege)
```

**Access Patterns:**
- SUPERADMIN: Full access semua menu
- ADMIN: Access semua kecuali User Management
- OPERATOR: Access operasional + dashboard
- STAFF: Access terbatas (view only)

---

## Testing Checklist

### SUPERADMIN User:
- [ ] Login as SUPERADMIN
- [ ] Check sidebar → Menu "User" muncul
- [ ] Click menu "User" → Page loaded
- [ ] Can create/edit/delete users
- [ ] Can toggle user status
- [ ] Access via URL: `/dashboard/manajemen/user` → Success

### ADMIN User:
- [ ] Login as ADMIN
- [ ] Check sidebar → Menu "User" **TIDAK** muncul
- [ ] Try access URL: `/dashboard/manajemen/user` → Redirect ke `/dashboard`
- [ ] Check console → No error (silent redirect)
- [ ] Can access other menu (AC Units, Teknisi, etc)

### OPERATOR User:
- [ ] Login as OPERATOR
- [ ] Check sidebar → Menu "User" **TIDAK** muncul
- [ ] Try access URL: `/dashboard/manajemen/user` → Redirect ke `/dashboard`
- [ ] Can access operasional menu

### STAFF User:
- [ ] Login as STAFF
- [ ] Check sidebar → Menu "User" **TIDAK** muncul
- [ ] Try access URL: `/dashboard/manajemen/user` → Redirect ke `/dashboard`
- [ ] Limited access to other menus

---

## Debugging

### Menu tidak muncul untuk SUPERADMIN:

**Check 1: User role di database**
```sql
SELECT user_id, full_name, email, role 
FROM user_management 
WHERE email = 'your-superadmin@email.com';
```
Expected: `role = 'SUPERADMIN'`

**Check 2: Console log di sidebar**
```typescript
console.log('User Role:', userRole)
console.log('Filtered Children:', filteredChildren)
```

**Check 3: useEffect running?**
Check if useEffect is triggered (add console.log)

### Redirect tidak bekerja:

**Check 1: Middleware config**
Check `matcher` di middleware includes the route

**Check 2: Session valid?**
```typescript
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

**Check 3: User data fetch**
```typescript
console.log('User Data:', userData)
console.log('User Role:', userData?.role)
```

---

## Best Practices

### ✅ DO:
- Always add both UI hiding (sidebar) and route protection (middleware)
- Use server-side checks (middleware) for security
- Add RLS policies for sensitive data
- Test with all roles
- Log security events for audit

### ❌ DON'T:
- Rely only on UI hiding (dapat dibypass)
- Hard-code role checks in many places (use centralized RBAC)
- Forget to test with different roles
- Show error messages for unauthorized access (use silent redirect)
- Mix client-side and server-side role checks without server validation

---

## Summary

**User Management Page:**
- 🔒 Only accessible by SUPERADMIN
- 👁️ Menu hidden for non-SUPERADMIN (UI/UX)
- 🛡️ Route protected by middleware (Security)
- 🚫 Direct URL access blocked (Redirect)
- ✅ No error shown (Silent redirect to dashboard)

**Security Approach:**
```
UI Hiding (UX) → Middleware (Security) → RLS (Data Protection)
     ↓                    ↓                        ↓
  Optional           Required                  Optional
```

**Result:**
Clean, secure, user-friendly RBAC implementation! 🎉
