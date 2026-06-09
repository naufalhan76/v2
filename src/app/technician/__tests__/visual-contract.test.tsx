import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import TechnicianTodayPage from '@/app/technician/page'
import TechnicianHistoryPage from '@/app/technician/history/page'
import TechnicianProfilePage from '@/app/technician/profile/page'
import { BottomTabBar } from '@/components/technician/bottom-tab-bar'
import { TodayJobCard } from '@/components/technician/today-job-card'
import { PhotoUpload } from '@/components/technician/photo-upload'
import { ConflictResolution } from '@/components/technician/conflict-resolution'

// Mock dependencies
vi.mock('next/navigation', () => ({
  usePathname: () => '/technician',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}))

vi.mock('@/components/technician/home-header', () => ({
  HomeHeader: () => <div data-testid="home-header">HomeHeader</div>
}))
vi.mock('@/components/technician/today-jobs-list', () => ({
  TodayJobsList: () => <div data-testid="today-jobs-list">TodayJobsList</div>
}))
vi.mock('@/components/technician/history-list', () => ({
  HistoryList: () => <div data-testid="history-list">HistoryList</div>
}))
vi.mock('@/components/technician/profile-content', () => ({
  ProfileContent: () => <div data-testid="profile-content">ProfileContent</div>
}))
vi.mock('@/components/technician/sync-status', () => ({
  SyncStatus: () => <div data-testid="sync-status">SyncStatus</div>
}))

describe('Technician UI Visual Contract (Red Baseline)', () => {
  describe('1. Shell/Nav (BottomTabBar)', () => {
    it('matches the fixed bottom nav reference design', () => {
      render(<BottomTabBar />)
      const nav = screen.getByRole('navigation')
      
      expect(nav).toHaveClass('fixed', 'bottom-0', 'inset-x-0', 'pb-safe')
      
      const selectedTab = screen.getByText('Hari Ini').closest('a')
      expect(selectedTab).toHaveClass('text-[#1C195F]')
      // Active indicator dot
      expect(selectedTab?.querySelector('.bg-\\[\\#1C195F\\]')).toBeInTheDocument()
    })
  })

  describe('2. Today View (TechnicianTodayPage)', () => {
    it('matches navy curved header and overlap cards layout', () => {
      render(<TechnicianTodayPage />)
      
      const homePage = screen.getByTestId('technician-home')
      
      const headerBanner = homePage.querySelector('.bg-\\[\\#1C195F\\]')
      expect(headerBanner).toBeInTheDocument()
      expect(headerBanner).toHaveClass('rounded-b-[40px]', 'text-white')

      const listContainer = screen.getByTestId('today-jobs-list').parentElement
      expect(listContainer).toHaveClass('-mt-6') 
      expect(listContainer).toHaveClass('relative', 'z-10') 
    })
  })

  describe('3. History View', () => {
    it('matches history visual contract with right structure', () => {
      render(<TechnicianHistoryPage />)
      const historyPage = screen.getByTestId('technician-history')
      expect(historyPage).toHaveClass('bg-canvas-soft')
      expect(screen.getByText('Riwayat Pekerjaan')).toBeInTheDocument()
    })
  })

  describe('4. Profile View', () => {
    it('matches profile header layout contract', () => {
      render(<TechnicianProfilePage />)
      const profilePage = screen.getByTestId('technician-profile')
      expect(profilePage).toHaveClass('bg-background')
      expect(screen.getByText('Profil')).toBeInTheDocument()
    })
  })

  describe('5. Job Card (Concrete Data)', () => {
    it('renders concrete data with required UI tokens', () => {
      const mockJob = {
        order_id: 'WO-TEC-001',
        status: 'Diproses',
        canonical_status: 'IN_PROGRESS' as const,
        scheduled_visit_date: new Date().toISOString(),
        customers: {
          customer_name: 'CV Beta Sample',
          primary_contact_person: 'Mr. Beta',
          phone_number: '081234567890'
        },
        order_items: [
          {
            service_type: 'Service AC',
            locations: { full_address: 'Jl. Gatot Subroto No. 200' },
            quantity: 1,
            unit_price: 850000,
            total_price: 850000
          }
        ],
        technician_order: []
      }

      render(<TodayJobCard job={mockJob as any} isOffline={false} />)
      
      // Concrete data matching
      expect(screen.getByText('WO-TEC-001')).toBeInTheDocument()
      expect(screen.getByText('CV Beta Sample')).toBeInTheDocument()
      expect(screen.getByText(/Jl\. Gatot Subroto No\. 200/)).toBeInTheDocument()
      
      // Expected total price formatting
      expect(screen.getByText(/Rp\s*850\.000/)).toBeInTheDocument()

      // Card should be elevated
      const cardContainer = screen.getByText('WO-TEC-001').closest('div.rounded-xl')
      expect(cardContainer).toHaveClass('shadow-sm', 'border-hairline')
    })
  })

  describe('6. Media/Forms', () => {
    it('renders native-like square camera buttons in PhotoUpload', () => {
      render(
        <PhotoUpload
          label="Foto Sebelum"
          bucket="test"
          pathPrefix="test"
          value={[]}
          onChange={vi.fn()}
        />
      )
      
      const label = screen.getByText('Foto Sebelum')
      expect(label).toBeInTheDocument()
      
      // Look for the "upload" label or icon visually representing the camera
      const uploadArea = screen.getByText('Ambil Foto').closest('button') || screen.getByText('Ambil Foto').closest('label')
      expect(uploadArea).toHaveClass('aspect-square', 'border-dashed')
    })
  })

  describe('7. Sync/Conflict', () => {
    it('shows destructive badge for cancelled conflict', () => {
      const conflicts = [
        {
          id: '1',
          url: '/api/something',
          method: 'POST',
          body: {},
          timestamp: Date.now(),
          conflict_kind: 'CANCELLED',
          server_message: 'Job was cancelled'
        }
      ]
      render(
        <ConflictResolution 
          open={true} 
          onOpenChange={vi.fn()} 
          conflicts={conflicts} 
          onDiscard={vi.fn()} 
          onExport={vi.fn()} 
        />
      )
      
      const badge = screen.getByText('Dibatalkan')
      expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground')
    })
  })
})
