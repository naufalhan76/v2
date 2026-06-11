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
import { JobCompletionWizard } from '@/components/technician/job-completion-wizard'

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
    it('matches the new floating rounded island nav design', () => {
      render(<BottomTabBar />)
      const nav = screen.getByRole('navigation')
      
      const container = nav.parentElement
      expect(container).toHaveClass('fixed', 'bottom-4', 'inset-x-6', 'z-50')
      
      expect(nav).toHaveClass('pointer-events-auto', 'bg-white', 'rounded-3xl', 'shadow-[0_4px_15px_rgba(0,0,0,0.05)]')
    })
  })

  describe('2. Today View (TechnicianTodayPage)', () => {
    it('matches tokenized navy header and overlap cards layout (-mt-10 overlap)', () => {
      render(<TechnicianTodayPage />)
      
      const homePage = screen.getByTestId('technician-home')
      
      const headerBanner = homePage.querySelector('.bg-navy-deep')
      expect(headerBanner).toBeInTheDocument()
      expect(headerBanner).toHaveClass('rounded-b-[40px]', 'text-white')

      const listContainer = screen.getByTestId('today-jobs-list').parentElement
      expect(listContainer).toHaveClass('-mt-10') 
      expect(listContainer).toHaveClass('relative', 'z-10') 
    })
  })

  describe('3. History View', () => {
    it('matches tokenized history visual contract with layout structure', () => {
      render(<TechnicianHistoryPage />)
      const historyPage = screen.getByTestId('technician-history')
      expect(historyPage).toHaveClass('bg-bg-gray-faded')
      
      const headerBanner = historyPage.querySelector('.bg-navy-deep')
      expect(headerBanner).toBeInTheDocument()
      expect(headerBanner).toHaveClass('rounded-b-[40px]', 'text-white')

      expect(screen.getByText('Riwayat Pekerjaan')).toBeInTheDocument()
    })
  })

  describe('4. Profile View', () => {
    it('matches tokenized profile header layout contract', () => {
      render(<TechnicianProfilePage />)
      const profilePage = screen.getByTestId('technician-profile')
      expect(profilePage).toHaveClass('bg-bg-gray-faded')
      
      const headerBanner = profilePage.querySelector('.bg-navy-deep')
      expect(headerBanner).toBeInTheDocument()
      expect(headerBanner).toHaveClass('rounded-b-[40px]', 'text-white')

      expect(screen.getByText('Profil')).toBeInTheDocument()
    })
  })

  describe('5. Job Card (Concrete Data)', () => {
    it('[RED BASELINE] renders concrete data with required UI tokens (expects WO-TEC-001, missing in UI)', () => {
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
      
      expect(screen.getByText('WO-TEC-001')).toBeInTheDocument()
      expect(screen.getByText('CV Beta Sample')).toBeInTheDocument()
      expect(screen.getByText(/Jl\. Gatot Subroto No\. 200/)).toBeInTheDocument()
      
      expect(screen.getByText(/Rp\s*850\.000/)).toBeInTheDocument()

      const cardContainer = screen.getByText('WO-TEC-001').closest('div.rounded-xl')
      expect(cardContainer).toHaveClass('shadow-sm')
    })
  })

  describe('6. Media/Forms', () => {
    it('[RED BASELINE] renders native-like square camera buttons in PhotoUpload (expects Ambil Foto text)', () => {
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
      
      const uploadArea = screen.getByText('Ambil Foto').closest('button') || screen.getByText('Ambil Foto').closest('label')
      expect(uploadArea).toHaveClass('aspect-square', 'border-dashed')
    })
  })

  describe('7. Sync/Conflict', () => {
    it('[RED BASELINE] shows destructive badge for cancelled conflict (expects Dibatalkan text)', () => {
      const conflicts = [
        {
          id: '1',
          orderId: 'WO-TEC-001',
          kind: 'CANCELLED' as const,
          reportSnapshot: null,
          transitionSnapshot: null,
          createdAt: Date.now(),
          serverMessage: 'Job was cancelled'
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

  describe('8. Wizard Visuals (JobCompletionWizard)', () => {
    it('[RED BASELINE] renders wizard step indicators with correct styling', () => {
      const mockSnapshot = {
        orderId: 'WO-WIZ-001',
        status: 'IN_PROGRESS',
        customer: { name: 'Test', address: 'Test' },
        scheduledDate: new Date().toISOString(),
        orderItems: [],
        technicianId: 'tech-1',
        syncedAt: Date.now(),
        locked: false
      }
      render(<JobCompletionWizard orderId="WO-WIZ-001" snapshot={mockSnapshot as any} />)
      
      // Step indicator (e.g., "1/3", "2/3")
      const stepIndicator = screen.getByText(/Langkah/i)
      expect(stepIndicator).toBeInTheDocument()
      
      // Should have a progress bar or step active styling
      // E.g., looking for the class that represents the active step
      const activeStep = screen.getByTestId('wizard-active-step')
      expect(activeStep).toHaveClass('text-navy-deep', 'font-bold')
    })
  })

  describe('9. Status Pills', () => {
    it('[RED BASELINE] renders status pills with correct rounded-full styling', () => {
      const mockJob = {
        order_id: 'WO-TEC-002',
        status: 'Diproses',
        canonical_status: 'IN_PROGRESS' as const,
        scheduled_visit_date: new Date().toISOString(),
        customers: {
          customer_name: 'CV Alpha',
          primary_contact_person: 'Mr. Alpha',
          phone_number: '081234567891'
        },
        order_items: [],
        technician_order: []
      }

      render(<TodayJobCard job={mockJob as any} isOffline={false} />)
      
      const statusPill = screen.getByText('Menunggu')
      expect(statusPill).toHaveClass('rounded-full', 'px-2', 'py-1')
      
      // Since it's Diproses (in progress), it might have blue/green colors,
      // but visual contract just checks for pill shape
    })
  })
