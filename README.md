# Technician Service ERP Admin Panel

A production-ready admin panel for Technician Service ERP built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Authentication & Authorization**: Role-based access control with Supabase Auth
- **Dashboard**: KPI cards and charts for order monitoring
- **Configuration Management**: Service pricing and SLA configuration
- **User Management**: Role-based user administration
- **Order Management**: Assign, monitor, and track service orders
- **Real-time Updates**: Live updates for orders, payments, and service records
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Database**: Supabase
- **Authentication**: Supabase Auth
- **Realtime**: Supabase Realtime
- **Deployment**: Docker

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase project

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd technician-service-erp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root of your project:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App Configuration
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.