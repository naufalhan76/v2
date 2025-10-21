# Panduan Optimasi Performa Web Panel

## 📋 Overview

Dokumen ini menjelaskan fitur-fitur optimasi performa yang telah diimplementasikan dalam web panel untuk meningkatkan user experience.

## 🦴 Skeleton/Placeholder Stabil

### Komponen yang Tersedia
- `Skeleton` - Skeleton dasar untuk elemen tunggal
- `CardSkeleton` - Skeleton untuk card dengan layout yang fixed
- `TableSkeleton` - Skeleton untuk tabel dengan baris dan kolom
- `KpiCardSkeleton` - Skeleton khusus untuk KPI cards di dashboard
- `ChartSkeleton` - Skeleton untuk chart area
- `FormSkeleton` - Skeleton untuk form dengan field yang konsisten
- `ListSkeleton` - Skeleton untuk list items

### Cara Penggunaan
```tsx
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'

// Untuk loading cards
<CardSkeleton />

// Untuk loading tabel
<TableSkeleton rows={5} columns={4} />
```

### Manfaat
- Mencegah layout shift (CLS)
- Memberikan indikasi visual yang konsisten
- Meningkatkan perceived performance

## ⚡ Optimistic UI

### Hook yang Tersedia
- `useOptimisticToggle` - Untuk aksi toggle/switch
- `useOptimisticArray` - Untuk operasi array (add, remove, update)
- `useOptimisticForm` - Untuk submit form
- `useOptimisticLike` - Untuk like/unlike functionality
- `useOptimisticDelete` - Untuk delete dengan confirmation

### Cara Penggunaan
```tsx
import { useOptimisticArray } from '@/hooks/use-optimistic'

// Untuk delete operation
const { optimisticArray, handleArrayAction } = useOptimisticArray(
  initialData,
  async ({ type, item, id }) => {
    if (type === 'remove') {
      const response = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      return { success: response.ok }
    }
  }
)

// Optimistic delete
const handleDelete = (id: string) => {
  handleArrayAction({ type: 'remove', item: {}, id })
  // API call akan dieksekusi di background
}
```

### Manfaat
- Responsifitas instan untuk user
- Pengalaman yang lebih smooth
- Otomatis rollback jika error

## 🚀 Priority Loading

### Komponen yang Tersedia
- `HeroImage` - Image dengan fetchpriority high
- `PriorityScript` - Script loading dengan strategi berbeda
- `ResourceHints` - DNS prefetch dan preconnect
- `PreloadResource` - Preload critical resources
- `CriticalCSS` - Inline critical CSS

### Cara Penggunaan
```tsx
import { HeroImage, ResourceHints } from '@/components/ui/priority-components'

// Hero image dengan priority
<HeroImage 
  src="/hero-image.jpg" 
  alt="Hero" 
  priority={true}
  fetchPriority="high"
/>

// Resource hints untuk domain eksternal
<ResourceHints 
  domains={['api.supabase.co', 'fonts.googleapis.com']} 
/>
```

### Manfaat
- Loading critical resources lebih cepat
- Mengurangi loading time
- Meningkatkan Core Web Vitals

## ⏳ Loading States Informatif

### Komponen yang Tersedia
- `LoadingState` - Loading dengan timeout dan fallback
- `LoadingOverlay` - Overlay untuk konten yang sedang loading
- `ProgressiveLoading` - Progressive image loading
- `LoadingDots` - Animated dots indicator
- `LoadingBar` - Progress bar untuk loading

### Cara Penggunaan
```tsx
import { LoadingState, LoadingOverlay } from '@/components/ui/loading-state'

// Loading state dengan timeout
<LoadingState
  isLoading={loading}
  timeout={10000}
  message="Loading data..."
  showRetry={true}
  onRetry={retryFunction}
>
  <YourContent />
</LoadingState>

// Loading overlay untuk button
<LoadingOverlay isLoading={isSubmitting}>
  <Button>Submit</Button>
</LoadingOverlay>
```

### Manfaat
- Informasi yang jelas kepada user
- Fallback mechanism jika loading terlalu lama
- Option untuk retry jika terjadi error

## 📊 Implementasi di Dashboard

### Dashboard Page
- Skeleton loading untuk KPI cards dan chart
- Resource hints untuk critical resources
- Loading state dengan timeout

### Customer Management
- Optimistic UI untuk delete operation
- Table skeleton untuk loading state
- Loading overlay untuk tombol aksi
- Resource hints untuk API calls

## 🎯 Best Practices

### 1. Skeleton Components
- Gunakan skeleton yang sesuai dengan konten
- Pastikan dimensi skeleton sama dengan konten asli
- Hindari animasi yang terlalu cepat atau lambat

### 2. Optimistic UI
- Implementasikan rollback mechanism
- Berikan feedback visual untuk status
- Gunakan untuk operasi yang predictable

### 3. Priority Loading
- Identifikasi critical resources
- Gunakan fetchpriority untuk hero images
- Preload resources yang penting

### 4. Loading States
- Set timeout yang reasonable (8-10 detik)
- Sediakan opsi retry untuk user
- Berikan pesan yang informatif

## 🔧 Konfigurasi

### Timeout Settings
```tsx
// Default timeout untuk loading states
const DEFAULT_TIMEOUT = 10000 // 10 detik

// Timeout untuk critical resources
const CRITICAL_TIMEOUT = 5000 // 5 detik
```

### Priority Levels
```tsx
// High priority untuk hero content
fetchPriority="high"

// Auto untuk normal content
fetchPriority="auto"

// Low untuk secondary content
fetchPriority="low"
```

## 📈 Performance Metrics

Dengan implementasi fitur-fitur ini, diharapkan:
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FID (First Input Delay)**: < 100ms
- **LCP (Largest Contentful Paint)**: < 2.5s
- **TTI (Time to Interactive)**: < 3.8s

## 🚨 Troubleshooting

### Layout Shift Masih Terjadi
- Pastikan skeleton memiliki dimensi yang sama dengan konten
- Cek untuk font loading yang menyebabkan shift
- Gunakan CSS aspect ratio untuk media

### Optimistic UI Tidak Berfungsi
- Pastikan action function mengembalikan promise
- Cek implementasi error handling
- Verifikasi data structure untuk optimistic updates

### Loading Terlalu Lama
- Periksa network connection
- Optimasi API calls
- Implementasikan caching strategy

## 📝 Catatan Tambahan

- Selalu test implementasi di berbagai device dan network conditions
- Monitor Core Web Vitals secara regular
- Update komponen sesuai kebutuhan aplikasi
- Dokumentasikan penggunaan kustom untuk tim development