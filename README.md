# AC Service Management Dashboard

A comprehensive web-based management system for AC (Air Conditioning) service operations. Built with modern technologies including Next.js 14, TypeScript, Supabase, and shadcn/ui component library for enterprise-level performance and user experience.

## ✨ Fitur Lengkap

### 🏠 Dashboard & Analytics
- **Real-time KPI Cards**: Monitoring revenue, total orders, pending orders, dan active orders dengan update otomatis
- **Advanced Date Range Picker**: Unified date range selector dengan calendar 2-bulan, Indonesian locale (DD/MM/YYYY format)
- **Live Jakarta Time**: Clock widget dengan timezone WIB yang update setiap detik
- **Revenue Chart**: Visualisasi pendapatan bulanan dengan Recharts
- **Quick Actions**: Tombol akses cepat ke fitur utama (Accept Order, Assign Order, Monitoring)

### 👥 Manajemen Master Data

#### User Management
- CRUD operations dengan role-based access (SUPERADMIN, ADMIN, TECHNICIAN, FINANCE)
- Email validation dan password requirements
- Status toggle (active/inactive) dengan expanding button animation
- Delete confirmation dengan warning message
- Search dan filtering real-time

#### Customer Management  
- Profile pelanggan lengkap (nama, email, phone, address)
- Service history tracking per customer
- CRUD operations dengan form validation
- Expanding action buttons (Edit/Delete) dengan smooth animation

#### Technician Management
- Profile teknisi dengan skill levels dan specialization
- Status availability tracking (Available/Busy/Off-duty)
- Assignment history dan performance metrics
- Contact information management

#### AC Unit Management
- Katalog lengkap unit AC dengan brand, model, capacity
- Specifications dan maintenance requirements
- Unit location tracking
- Installation date recording

#### Location Management
- Daftar lokasi service dengan hierarchical structure
- Address details dan coverage area
- Assignment to service areas

### 📋 Operasional Service

#### Accept Order
- Order intake dengan form validation lengkap
- Customer selection dengan search/filter
- AC unit selection per customer
- Service type dan priority level
- Appointment scheduling dengan date picker
- Expanding action buttons (Accept/Cancel dengan smooth animation)
- Confirmation dialog sebelum submit

#### Assign Order  
- List pending orders yang belum di-assign
- Technician selector dengan availability check
- Assignment date picker
- Success page dengan navigation options
- Auto-refresh setelah assignment

#### Monitoring Ongoing
- Real-time tracking untuk orders yang sedang dikerjakan
- Unified date range filter (match Dashboard pattern)
- Status badges dengan color coding
- Progress indicator per order
- Quick actions untuk update status

#### Monitoring History
- Historical data semua completed/cancelled orders
- Advanced filtering dengan unified date range picker
- Export capabilities untuk reporting
- Remind button dengan expanding animation
- Search across all fields

### ⚙️ Konfigurasi

#### Service Pricing
- Price list management untuk berbagai tipe service
- Bulk update capabilities
- Price history tracking
- Category-based pricing

#### Service SLA
- Service Level Agreement configuration
- Response time targets
- Resolution time standards
- Priority-based SLA rules

### 👤 User Profile
- Profile information editing
- Password change functionality
- Session management
- Dark mode support dengan theme persistence

### 🎨 UI/UX Features

#### Modern Design System
- **Dark Mode**: Full dark mode support dengan next-themes, seamless toggle di navbar
- **Responsive Layout**: Mobile-first design, collapsible sidebar untuk tablet/mobile
- **Expanding Buttons**: Smooth icon-only buttons yang expand ketika hover/focus menampilkan label
- **Consistent Spacing**: Fixed-width action columns mencegah table shifting
- **Theme Tokens**: CSS custom properties untuk consistent styling (bg-background, bg-card, text-muted-foreground)

#### Component Library
- **shadcn/ui**: 20+ pre-configured components dengan Radix UI primitives
- **Lucide Icons**: Modern icon set dengan consistent sizing
- **Toast Notifications**: Real-time feedback untuk user actions
- **Dialog Modals**: Confirmation dialogs dan forms
- **Data Tables**: Sortable, filterable tables dengan pagination

#### Animation & Interactions
- Smooth expanding button animations (w-10 → w-24/w-28 on hover)
- Fade-in text labels dengan transition-opacity
- Loading states untuk async operations
- Skeleton loaders untuk better perceived performance

### 🔒 Security & Authentication
- **Supabase Auth**: Email/password authentication dengan secure session management
- **RBAC (Role-Based Access Control)**: Fine-grained permissions per role
- **Protected Routes**: Middleware protection untuk authenticated routes
- **RLS Policies**: Row Level Security di database level
- **Session Persistence**: Secure cookie-based sessions

### ⚡ Performance & Real-time
- **Server-Side Rendering**: Faster initial page loads dengan Next.js App Router
- **React Query Caching**: Smart caching dan invalidation strategies
- **Supabase Realtime**: WebSocket subscriptions untuk live updates
- **Optimistic Updates**: Instant UI feedback dengan background sync
- **Code Splitting**: Automatic route-based code splitting

## 🏗️ Arsitektur & Tech Stack

### Frontend Framework
- **Next.js 14.2.33**: React framework dengan App Router untuk server-side rendering dan routing modern
- **TypeScript 5+**: Type-safe development dengan full IDE support
- **React 18**: Latest React features dengan concurrent rendering

### Styling & UI
- **Tailwind CSS 3.3**: Utility-first CSS framework dengan custom configuration
- **shadcn/ui**: Component library built on Radix UI primitives
  - 20+ pre-installed components: `button`, `calendar`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `select`, `switch`, `table`, `tabs`, `textarea`, `toast`, dan lainnya
- **next-themes 0.4.6**: Dark mode implementation dengan system preference detection
- **Lucide React 0.294**: Icon library dengan 1000+ consistent icons
- **class-variance-authority (CVA)**: Type-safe component variants
- **tailwind-merge**: Intelligent Tailwind class merging
- **tailwindcss-animate**: Pre-configured animations

### State Management & Data Fetching
- **TanStack Query (React Query) 5.8.4**: 
  - Server state management dengan automatic caching
  - Background refetching dan stale-while-revalidate pattern
  - Optimistic updates untuk better UX
  - Query invalidation strategies
- **React Query Devtools**: Development tools untuk debugging queries

### Form Management
- **React Hook Form 7.48.2**: Performant form library dengan minimal re-renders
- **Zod 3.22.4**: TypeScript-first schema validation
- **@hookform/resolvers 3.3.2**: Zod resolver untuk React Hook Form integration

### Backend & Database
- **Supabase 2.39.0**: 
  - PostgreSQL database dengan REST API auto-generation
  - Row Level Security (RLS) policies
  - Realtime WebSocket subscriptions
  - Built-in authentication
  - Storage untuk file uploads
- **@supabase/auth-helpers-nextjs 0.8.7**: Next.js specific auth utilities dengan middleware support

### Date & Time Handling
- **date-fns 2.30.0**: Modern date utility library dengan Indonesian locale
- **react-day-picker 9.11.0**: Flexible date picker component untuk calendar UI

### Data Visualization
- **Recharts 2.15.4**: Composable charting library untuk revenue analytics
- **@tanstack/react-table 8.10.7**: Headless table library untuk advanced data tables

### Development Tools
- **ESLint 8**: Code linting dengan Next.js config
- **Prettier 3.1.0**: Code formatting untuk consistent style
- **TypeScript Compiler**: Strict type checking
- **PostCSS 8**: CSS processing dengan autoprefixer

### Deployment
- **Docker**: Multi-stage builds untuk production
- **Docker Compose**: Orchestration untuk local development
- **Vercel-ready**: Optimized untuk Vercel deployment

### Project Architecture

```
webpanel/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth layout group
│   │   │   ├── login/               # Login page
│   │   │   └── confirm/             # Email confirmation
│   │   ├── dashboard/               # Main dashboard
│   │   │   ├── page.tsx            # Dashboard home dengan KPIs
│   │   │   ├── layout.tsx          # Dashboard layout (Sidebar + Navbar)
│   │   │   ├── konfigurasi/        # Configuration module
│   │   │   │   ├── harga-service/  # Service pricing management
│   │   │   │   └── sla-service/    # SLA configuration
│   │   │   ├── manajemen/          # Master data management
│   │   │   │   ├── user/           # User management (RBAC)
│   │   │   │   ├── customer/       # Customer CRUD
│   │   │   │   ├── teknisi/        # Technician management
│   │   │   │   ├── ac-units/       # AC unit catalog
│   │   │   │   └── lokasi/         # Location management
│   │   │   ├── operasional/        # Service operations
│   │   │   │   ├── accept-order/   # Order intake
│   │   │   │   ├── assign-order/   # Technician assignment
│   │   │   │   ├── monitoring-ongoing/  # Active orders
│   │   │   │   └── monitoring-history/  # Order history
│   │   │   └── profile/            # User profile settings
│   │   ├── api/                     # API routes
│   │   │   ├── customers/          # Customer API endpoints
│   │   │   └── cleanup-orphaned-users/  # Maintenance tasks
│   │   └── layout.tsx              # Root layout (Providers, fonts)
│   ├── components/                  # React components
│   │   ├── ui/                     # shadcn/ui components (20+ components)
│   │   ├── navbar.tsx              # Top navigation dengan dark mode toggle
│   │   ├── sidebar.tsx             # Collapsible sidebar navigation
│   │   ├── query-provider.tsx      # React Query setup
│   │   └── theme-provider.tsx      # next-themes provider
│   ├── lib/                        # Utility libraries & configs
│   │   ├── supabase-browser.ts    # Client-side Supabase client
│   │   ├── supabase-server.ts     # Server-side Supabase client (cookies)
│   │   ├── supabase-admin.ts      # Admin Supabase client (service role)
│   │   ├── auth.ts                # Authentication utilities
│   │   ├── rbac.ts                # Role-based access control logic
│   │   ├── realtime.ts            # Realtime subscription helpers
│   │   ├── utils.ts               # Common utilities (cn, formatters)
│   │   └── actions/               # Server actions
│   │       ├── customers.ts       # Customer operations
│   │       ├── dashboard.ts       # Dashboard data fetching
│   │       ├── orders.ts          # Order operations
│   │       ├── profile.ts         # Profile operations
│   │       ├── technicians.ts     # Technician operations
│   │       ├── users.ts           # User management operations
│   │       ├── ac-units.ts        # AC unit operations
│   │       ├── locations.ts       # Location operations
│   │       └── service-records.ts # Service record operations
│   ├── hooks/                      # Custom React hooks
│   │   └── use-toast.ts           # Toast notification hook
│   ├── styles/                     # Global styles
│   │   └── globals.css            # Tailwind directives, CSS variables
│   └── middleware.ts               # Next.js middleware (auth protection)
├── public/                          # Static assets
├── docker-compose.yml              # Docker orchestration
├── Dockerfile                      # Production container
├── next.config.js                  # Next.js configuration
├── tailwind.config.js              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── postcss.config.js               # PostCSS configuration
├── components.json                 # shadcn/ui configuration
└── package.json                    # Dependencies & scripts
```

### Key Architectural Patterns

1. **Server Components First**: Menggunakan React Server Components sebagai default, Client Components hanya untuk interactivity
2. **Server Actions**: Data mutations menggunakan Next.js Server Actions di `lib/actions/`
3. **Optimistic UI**: Immediate UI updates dengan background sync via React Query
4. **Route Groups**: Organized routing dengan `(auth)` group untuk authentication pages
5. **Layout Nesting**: Shared layouts untuk dashboard pages (Sidebar + Navbar)
6. **Middleware Protection**: Authentication check di edge sebelum page render
7. **CSS Variables**: Theme-aware styling dengan CSS custom properties
8. **Component Composition**: Reusable primitives dari Radix UI + custom styling

## 📋 Prerequisites

Sebelum memulai, pastikan sudah terinstall:

- **Node.js**: Version 18.x atau lebih tinggi ([Download](https://nodejs.org/))
- **npm**: Biasanya sudah include dengan Node.js (atau gunakan yarn/pnpm)
- **Git**: Untuk clone repository ([Download](https://git-scm.com/))
- **Supabase Account**: Free tier sudah cukup ([Sign up](https://supabase.com/))
- **Code Editor**: VS Code recommended dengan extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

## 🚀 Cara Install dan Menjalankan

### Step 1: Clone Repository

```bash
git clone https://github.com/naufalhan76/webpanel.git
cd webpanel
```

### Step 2: Install Dependencies

```bash
# Clean install (recommended untuk setup baru)
npm ci

# Atau kalau mau install biasa
npm install
```

**Catatan**: `npm ci` lebih cepat dan consistent karena install exact versions dari `package-lock.json`.

### Step 3: Setup Environment Variables

Buat file `.env.local` di root directory:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

Edit `.env.local` dengan credentials Supabase kamu:

```env
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Application URL (OPTIONAL - auto-detected in development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**🔐 Cara dapat Supabase credentials:**
1. Login ke [Supabase Dashboard](https://app.supabase.com/)
2. Pilih project kamu
3. Go to **Settings** → **API**
4. Copy **Project URL** → paste ke `NEXT_PUBLIC_SUPABASE_URL`
5. Copy **anon/public key** → paste ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Copy **service_role key** → paste ke `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ IMPORTANT**: 
- **JANGAN** commit `.env.local` ke Git (sudah ada di `.gitignore`)
- **JANGAN** share service role key ke public
- Restart dev server setelah ubah env variables

### Step 4: Setup Database (Supabase)

#### A. Cara Manual (Via Supabase Dashboard)

1. Login ke [Supabase Dashboard](https://app.supabase.com/)
2. Pilih project → Go to **SQL Editor**
3. Run SQL scripts berikut secara berurutan:

**Tables yang dibutuhkan:**
- `user_management` - User accounts dengan roles
- `customers` - Customer profiles
- `technicians` - Technician data
- `ac_units` - AC unit catalog
- `locations` - Service locations
- `orders` - Service orders
- `service_records` - Service history
- `payments` - Payment records
- `service_pricing` - Price list
- `service_sla` - SLA configurations

**SQL Migration Files** (ada di repo ini):
- `setup-profile-storage.sql` - Setup storage bucket
- `check-user-profile.sql` - Verify user profiles
- `fix-user-profile.sql` - Fix profile issues
- `delete-duplicate-users.sql` - Clean duplicate data

#### B. Enable Row Level Security (RLS)

Di Supabase Dashboard → **Authentication** → **Policies**:

Contoh RLS policy untuk `user_management`:
```sql
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON user_management FOR SELECT
  USING (auth.uid() = user_id);

-- Allow SUPERADMIN to read all
CREATE POLICY "Superadmin can read all users"
  ON user_management FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_management
      WHERE user_id = auth.uid() AND role = 'SUPERADMIN'
    )
  );
```

#### C. Enable Realtime (Optional tapi Recommended)

Di Supabase Dashboard → **Database** → **Replication**:
- Enable Realtime untuk tables: `orders`, `payments`, `service_records`
- Ini untuk live updates di dashboard

### Step 5: Run Development Server

```bash
npm run dev
```

Aplikasi akan jalan di: **http://localhost:3000**

**Output yang benar:**
```
▲ Next.js 14.2.33
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 2.5s
```

### Step 6: Login ke Dashboard

1. Buka browser → **http://localhost:3000/login**
2. Kalau belum ada user, buat account via Supabase Dashboard:
   - **Authentication** → **Users** → **Add user**
   - Email: `admin@example.com`
   - Password: (buat password)
3. Insert user ke table `user_management`:
   ```sql
   INSERT INTO user_management (user_id, email, role, full_name)
   VALUES (
     'uuid-from-auth-users',
     'admin@example.com',
     'SUPERADMIN',
     'Super Admin'
   );
   ```
4. Login dengan email/password tersebut

### Step 7: Verify Installation

Checklist setelah login:
- ✅ Dashboard loading dengan KPI cards
- ✅ Sidebar navigation berfungsi
- ✅ Dark mode toggle works (icon di navbar)
- ✅ Date range picker buka calendar 2-bulan
- ✅ Semua menu management accessible
- ✅ Tidak ada error di browser console (F12)

---

## 🐳 Cara Jalankan dengan Docker

### Build Docker Image

```bash
docker build -t webpanel-ac-service .
```

### Run dengan Docker Compose

```bash
# Start container
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop container
docker-compose down
```

**Environment Variables untuk Docker:**

Edit `docker-compose.yml` atau buat `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Aplikasi akan available di: **http://localhost:3000**

### Production Build (tanpa Docker)

```bash
# Build production bundle
npm run build

# Start production server
npm run start
```

Output location: `.next` directory

---

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start dev server dengan hot reload
npm run build            # Build production bundle
npm run start            # Start production server (after build)

# Code Quality
npm run lint             # Run ESLint untuk check code issues
npm run lint:fix         # Auto-fix ESLint issues
npm run type-check       # TypeScript type checking tanpa emit

# Maintenance
npm run clean            # Clean .next dan cache
npm run reinstall        # Fresh install semua dependencies
npm run setup            # Install + setup shadcn/ui components
```

**Penggunaan Umum:**

```bash
# Sebelum commit
npm run lint && npm run type-check

# Fix formatting issues
npm run lint:fix

# Clean build setelah pull changes
npm run clean && npm run dev

# Fresh install (kalau ada dependency issues)
npm run reinstall
```

## 🔐 Authentication & Authorization

### Authentication Flow

Aplikasi menggunakan **Supabase Auth** dengan email/password authentication:

1. User login via `/login` page
2. Supabase Auth verify credentials
3. Session cookie created (auto-managed oleh Supabase)
4. Middleware check authentication di setiap request
5. User data fetched dari table `user_management` untuk resolve role

### Role-Based Access Control (RBAC)

System memiliki 4 role levels dengan permissions berbeda:

| Role | Permissions | Access Level |
|------|------------|--------------|
| **SUPERADMIN** | Full access ke semua fitur | Manage semua users including ADMIN & SUPERADMIN |
| **ADMIN** | Manage operations & master data | Manage TECHNICIAN & FINANCE users, tidak bisa edit ADMIN/SUPERADMIN |
| **TECHNICIAN** | View assigned orders | Accept & update service orders (future mobile app) |
| **FINANCE** | View financial data | Manage payments & invoices (future feature) |

### Protected Routes

Semua routes di `/dashboard/*` protected oleh middleware di `src/middleware.ts`:

```typescript
// Contoh middleware check
if (!session) {
  return NextResponse.redirect('/login')
}
```

### Row Level Security (RLS)

Database security di-handle via Supabase RLS policies:

- Users hanya bisa read/update profile mereka sendiri
- ADMIN tidak bisa modify SUPERADMIN/ADMIN users
- SUPERADMIN bisa access semua data
- Technicians hanya bisa lihat assigned orders mereka

---

## ⚡ Real-time Features

### Supabase Realtime Subscriptions

Aplikasi menggunakan WebSocket subscriptions untuk live updates:

**Tables dengan Realtime enabled:**
- `orders` - Live order status updates
- `payments` - Real-time payment notifications
- `service_records` - Service progress updates

**Implementation:**

```typescript
// Example di lib/realtime.ts
const subscription = supabase
  .channel('orders')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      // Invalidate React Query cache
      queryClient.invalidateQueries(['orders'])
    }
  )
  .subscribe()
```

**Auto-refresh Behavior:**
- Dashboard KPIs update setiap ada perubahan order/payment
- Monitoring pages refresh ketika order status berubah
- Toast notifications untuk realtime events

---

## 🚨 Troubleshooting

### Common Issues & Solutions

#### 1. **Compilation Errors setelah Clone**

```bash
# Fresh install dependencies
npm run reinstall

# Type check
npm run type-check
```

**Kemungkinan penyebab:**
- Node modules corrupt
- Package version mismatch
- Cache issues

#### 2. **Environment Variables Tidak Terdeteksi**

```bash
# Restart dev server setelah edit .env.local
# Ctrl+C untuk stop, lalu:
npm run dev
```

**Checklist:**
- ✅ File bernama `.env.local` (bukan `.env` atau `.env.development`)
- ✅ Tidak ada space di sekitar `=` (contoh: `KEY=value`, bukan `KEY = value`)
- ✅ Variables dengan prefix `NEXT_PUBLIC_` untuk client-side access

#### 3. **Supabase Connection Error**

**Error:** `Failed to fetch` atau `Network error`

**Solutions:**
1. Check Supabase project status di dashboard
2. Verify credentials di `.env.local`:
   ```bash
   # Test connection
   curl https://your-project.supabase.co/rest/v1/
   ```
3. Check RLS policies - might be too restrictive
4. Ensure anon key is correct (bukan service_role key untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

#### 4. **Calendar/Date Picker Errors**

```bash
# Install required dependencies
npm install date-fns react-day-picker
npx shadcn@latest add calendar popover
```

**Common errors:**
- `Cannot find module 'date-fns'` → Install date-fns
- `Calendar component not found` → Install shadcn calendar

#### 5. **Dark Mode Tidak Berfungsi**

**Checklist:**
- ✅ `ThemeProvider` ada di root layout
- ✅ CSS variables defined di `globals.css`
- ✅ Components menggunakan theme tokens (`bg-background`, bukan `bg-white`)

**Fix:**
```tsx
// app/layout.tsx harus wrap dengan ThemeProvider
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

#### 6. **Table Columns Shifting ketika Hover Button**

**Solved!** Sudah fixed dengan pattern:

```tsx
<TableCell>
  <div className="flex justify-end gap-2 w-[180px] ml-auto">
    {/* Buttons here */}
  </div>
</TableCell>
```

Fixed width `w-[XXpx]` + `ml-auto` mencegah shifting.

#### 7. **Redirect Loop di Login**

**Penyebab:** Middleware redirect logic bentrok

**Fix:**
```typescript
// middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    // Don't match /login or /api
  ]
}
```

#### 8. **Build Errors (Production)**

```bash
# Check for type errors first
npm run type-check

# Clean build
npm run clean
npm run build
```

**Common issues:**
- Unused imports → Remove atau ignore dengan `// eslint-disable-next-line`
- Type errors → Fix TypeScript issues
- Missing env vars → Ensure production env vars set

---

## 🛠️ Development Tips

### Quick Setup untuk Device Baru

Skenario: Clone repo di laptop/PC baru

```bash
# 1. Clone & install
git clone https://github.com/naufalhan76/webpanel.git
cd webpanel
npm ci

# 2. Setup env
Copy-Item .env.example .env.local
# Edit .env.local dengan Supabase credentials

# 3. Start dev
npm run dev
```

**Total time:** ~5 menit (tergantung internet speed)

### Hot Reload Not Working

```bash
# Clear Next.js cache
npm run clean
npm run dev
```

### Port 3000 Sudah Dipakai

```bash
# Use different port
PORT=3001 npm run dev

# Or kill process di port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### VS Code Extensions Recommended

Install extensions ini untuk better DX:

1. **ES7+ React/Redux/React-Native snippets** - React snippets
2. **Tailwind CSS IntelliSense** - Autocomplete Tailwind classes
3. **Prettier - Code formatter** - Auto format on save
4. **ESLint** - Linting di editor
5. **TypeScript Hero** - Auto import suggestions
6. **Auto Rename Tag** - Rename paired HTML/JSX tags
7. **Error Lens** - Inline error messages

### Debugging

```bash
# Enable React Query Devtools (sudah installed)
# Akan muncul di bottom-right corner saat dev mode

# Check network requests
# Browser DevTools → Network tab → Filter: Fetch/XHR

# Check Supabase logs
# Supabase Dashboard → Logs → Edge Functions / Database
```

---

## 📦 Dependencies Deep Dive

### Core Dependencies (Production)

```json
{
  "@supabase/supabase-js": "^2.39.0",           // Supabase client
  "@tanstack/react-query": "^5.8.4",            // State management
  "next": "^14.2.33",                            // React framework
  "react": "^18",                                 // UI library
  "react-dom": "^18",                            // React DOM renderer
  "next-themes": "^0.4.6",                       // Dark mode
  "date-fns": "^2.30.0",                         // Date utilities
  "lucide-react": "^0.294.0",                    // Icons
  "tailwindcss": "^3.3.0",                       // CSS framework
  "zod": "^3.22.4",                              // Schema validation
  "react-hook-form": "^7.48.2",                  // Forms
  "@radix-ui/*": "various",                      // UI primitives
  "recharts": "^2.15.4"                          // Charts
}
```

### shadcn/ui Components Installed

20+ pre-configured components:

- ✅ `alert-dialog` - Confirmation modals
- ✅ `avatar` - User avatars
- ✅ `badge` - Status badges
- ✅ `button` - All button variants
- ✅ `calendar` - Date picker
- ✅ `card` - Container cards
- ✅ `checkbox` - Form checkboxes
- ✅ `dialog` - Modal dialogs
- ✅ `dropdown-menu` - Dropdown menus
- ✅ `input` - Text inputs
- ✅ `label` - Form labels
- ✅ `popover` - Popover containers
- ✅ `radio-group` - Radio buttons
- ✅ `select` - Select dropdowns
- ✅ `separator` - Divider lines
- ✅ `sheet` - Sliding panels (sidebar)
- ✅ `switch` - Toggle switches
- ✅ `table` - Data tables
- ✅ `tabs` - Tab navigation
- ✅ `textarea` - Multi-line text input
- ✅ `toast` - Notifications

**Semua components customizable via Tailwind classes!**

---

## 🤝 Contributing

### How to Contribute

1. **Fork repository** di GitHub
2. **Clone fork** kamu:
   ```bash
   git clone https://github.com/your-username/webpanel.git
   ```
3. **Create feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make changes** dan test thoroughly
5. **Commit dengan clear message**:
   ```bash
   git commit -m "Add: Feature untuk auto-assign technician based on location"
   ```
6. **Push ke branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open Pull Request** di GitHub dengan description lengkap

### Commit Message Convention

```
Type: Short description

Detailed description (optional)

- Bullet points for changes
- Include breaking changes
- Reference issues if any
```

**Types:**
- `Add:` - New feature/file
- `Fix:` - Bug fix
- `Update:` - Modify existing feature
- `Remove:` - Delete code/file
- `Refactor:` - Code restructure without behavior change
- `Style:` - UI/CSS changes
- `Docs:` - Documentation updates

### Code Style Guidelines

- Follow ESLint rules: `npm run lint`
- Use TypeScript strict mode
- Prefer named exports over default exports
- Use CSS custom properties untuk colors (tidak hardcode colors)
- Component naming: PascalCase untuk components, camelCase untuk utilities
- Keep components small (<300 lines)

---

## 📄 License

This project is licensed under the **MIT License**.

**What this means:**
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ Liability protection
- ❌ Warranty provided

See the [LICENSE](LICENSE) file for full details.

---

## 📞 Support & Contact

**Questions?** Open an issue di GitHub repository:
- 🐛 Bug reports: Use "Bug" label
- 💡 Feature requests: Use "Enhancement" label
- ❓ Questions: Use "Question" label

**Repository:** https://github.com/naufalhan76/webpanel

---

## 🎯 Roadmap

### Planned Features

- [ ] Mobile app untuk Technician (React Native/Flutter)
- [ ] WhatsApp notification integration
- [ ] Advanced reporting dengan PDF export
- [ ] Service history timeline visualization
- [ ] Inventory management untuk spare parts
- [ ] Customer portal untuk track orders
- [ ] Payment gateway integration (Midtrans/Xendit)
- [ ] Multi-language support (EN/ID)
- [ ] Performance analytics dashboard
- [ ] Automated SLA violation alerts

### Recent Updates (October 2024)

- ✅ Unified date range picker across all pages
- ✅ Expanding button animations dengan smooth transitions
- ✅ Fixed table column shifting issues
- ✅ Dark mode support dengan theme persistence
- ✅ Indonesian locale untuk date formatting
- ✅ Real-time KPI updates di dashboard
- ✅ Collapsible sidebar untuk responsive design

---

**Built with ❤️ untuk efficient AC service management**

**Last Updated:** Oktober 2024  
**Version:** 1.0.0  
**Maintained by:** Naufal