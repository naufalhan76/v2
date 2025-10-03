# AC Service Management Dashboard

A comprehensive dashboard for managing AC (Air Conditioning) service operations built with Next.js 14, TypeScript, and Supabase.

## ✨ Features

- **🏠 Dashboard**: Interactive KPI cards with sophisticated date range picker and real-time Jakarta time
- **👥 Customer Management**: Complete customer profiles and service history
- **🔧 Technician Management**: Manage technician profiles, skills, and assignments  
- **📋 Order Management**: Service order tracking with multiple status levels
- **❄️ AC Unit Management**: Comprehensive AC unit catalog and specifications
- **💰 Payment Tracking**: Revenue analytics with Indonesian Rupiah formatting
- **🔒 Authentication**: Secure login with role-based access control
- **📱 Responsive Design**: Modern UI with shadcn/ui components and collapsible sidebar
- **⏰ Real-time Updates**: Live data updates and Jakarta timezone clock
- **📅 Advanced Date Filtering**: Calendar component with Indonesian localization (dd/MM/yyyy)

## 🛠 Tech Stack

- **Framework**: Next.js 14.2.33 (App Router)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS + shadcn/ui components
- **UI Components**: Radix UI primitives with custom styling
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Date/Time**: date-fns with Indonesian locale
- **Icons**: Lucide React
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth with middleware
- **Realtime**: Supabase Realtime subscriptions
- **Deployment**: Docker with multi-stage builds

## 📋 Prerequisites

- **Node.js**: 18 or higher
- **Package Manager**: npm or yarn
- **Database**: Supabase project (free tier works)
- **Git**: For version control

## 🚀 Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/naufalhan76/webpanel.git
cd webpanel
```

### 2. Install All Dependencies

```bash
# Clean install (recommended for new setup)
npm ci

# Or regular install
npm install

# Install shadcn/ui components (if needed)
npx shadcn@latest add alert-dialog avatar badge button calendar card checkbox dialog dropdown-menu input label popover radio-group select separator sheet switch table tabs textarea toast
```

### 3. Environment Configuration

```bash
cp .env.example .env.local
```

**Configure your `.env.local`**:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Development Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ Important**: Never commit `.env.local` to git - it contains sensitive credentials!

### 4. Initialize shadcn/ui

```bash
npx shadcn@latest init
```

Follow the prompts to set up shadcn/ui with the following configuration:

- Style: Default
- Base color: Slate
- CSS variables: Yes

### 5. Set up the database

Make sure your Supabase project has the following tables:

- `user_management`
- `technicians`
- `customers`
- `locations`
- `ac_units`
- `orders`
- `service_records`
- `payments`
- `service_pricing`
- `service_sla`

You can use the SQL migrations in the `supabase/migrations` directory to set up these tables.

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
  app/                    # Next.js app directory
    (auth)/              # Authentication pages
      login/             # Login page
    dashboard/           # Dashboard page
    konfigurasi/         # Configuration pages
      harga-service/     # Service pricing
      sla-service/       # Service SLA
    manajemen/           # Management pages
      user/              # User management
      ac-units/          # AC units
      teknisi/           # Technicians
      lokasi/            # Locations
    operasional/         # Operational pages
      assign-order/      # Order assignment
      monitoring-ongoing/ # Ongoing monitoring
      monitoring-history/ # History monitoring
      accept-order/      # Order acceptance
    profile/             # User profile
    api/                 # API routes
    layout.tsx           # Root layout
    globals.css          # Global styles
    middleware.ts        # Authentication middleware
  components/            # Reusable components
    ui/                  # shadcn/ui components
    kpi-card.tsx         # KPI card component
    data-table.tsx       # Data table component
    search-bar.tsx       # Search bar component
    status-badge.tsx     # Status badge component
    order-status-stepper.tsx # Order status stepper
    navbar.tsx           # Navigation bar
    sidebar.tsx          # Sidebar
    query-provider.tsx   # Query provider
  lib/                  # Utility libraries
    supabase-browser.ts  # Supabase browser client
    supabase-server.ts   # Supabase server client
    auth.ts             # Authentication utilities
    rbac.ts             # Role-based access control
    realtime.ts         # Realtime subscriptions
    utils.ts            # Utility functions
  styles/               # Style files
    theme.css           # Theme configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Docker Deployment

### Build the Docker image

```bash
docker build -t technician-service-erp .
```

### Run with Docker Compose

```bash
docker-compose up -d
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Environment Variables for Docker

Make sure to set the environment variables in a `.env` file before running with Docker Compose.

## Authentication

The application uses Supabase Auth for authentication. After login, the system reads the `user_management` table to resolve the user's role.

### Roles

- **SUPERADMIN**: Full access including User Management for any role
- **ADMIN**: No access to SUPERADMIN/ADMIN rows in User Management; can manage `TECHNICIAN` & `FINANCE` users, CRUD masters, assign orders, dashboards
- **TECHNICIAN/FINANCE**: Not part of this admin panel (future)

## Realtime Subscriptions

The application uses Supabase Realtime for live updates on:

- Orders
- Payments
- Service records
- Service pricing
- Service SLA

## 🚨 Troubleshooting

### Common Issues When Setting Up on New Device

**1. Missing shadcn/ui components after clone:**
```bash
# Install all required UI components
npx shadcn@latest add alert-dialog avatar badge button calendar card checkbox dialog dropdown-menu input label popover radio-group select separator sheet switch table tabs textarea toast
```

**2. TypeScript errors:**
```bash
# Clean reinstall all dependencies
npm run reinstall
npm run type-check
```

**3. Environment variables not working:**
- Ensure `.env.local` exists (copy from `.env.example`)
- Restart dev server after env changes: `npm run dev`
- Verify Supabase credentials are correct

**4. Database connection issues:**
- Check Supabase project status
- Verify RLS policies are applied
- Ensure service role key permissions

**5. Calendar component errors:**
```bash
npm install date-fns react-day-picker
npx shadcn@latest add calendar popover
```

### Quick Setup for New Device

```bash
# 1. Clone and install
git clone https://github.com/naufalhan76/webpanel.git
cd webpanel
npm ci

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Install UI components (if needed)
npm run setup

# 4. Start development
npm run dev
```

## 📦 Complete Dependencies

### Required for New Setup
- **Next.js**: `14.2.33` (React framework)
- **TypeScript**: `5+` (Type safety)
- **Supabase**: Database and auth
- **shadcn/ui**: UI component library
- **TanStack Query**: State management
- **date-fns**: Indonesian date formatting
- **Lucide React**: Icon library

### UI Components Installed
All shadcn/ui components are pre-configured:
`alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `radio-group`, `select`, `separator`, `sheet`, `switch`, `table`, `tabs`, `textarea`, `toast`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for efficient AC service management**
**Last Updated**: October 2025