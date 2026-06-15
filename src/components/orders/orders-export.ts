import {
  getLeadTechnicianName,
  getPrimaryLocation,
  getPrimaryServiceType,
  getUrgencyLevel,
  type OrderForDisplay,
  type Urgency,
} from '@/lib/order-utils'
import type { CsvColumn } from '@/lib/csv-export'

export const ORDER_CSV_COLUMNS: CsvColumn<OrderForDisplay>[] = [
  { header: 'Order ID', value: (order) => order.order_id },
  { header: 'Pelanggan', value: (order) => order.customers?.customer_name },
  { header: 'Status', value: (order) => order.status },
  { header: 'Layanan Utama', value: getPrimaryServiceType },
  { header: 'Teknisi Lead', value: getLeadTechnicianName },
  { header: 'Tanggal Kunjungan', value: (order) => order.scheduled_visit_date ?? order.req_visit_date },
  { header: 'Urgensi', value: getUrgencyLevel },
  { header: 'Alamat', value: getPrimaryLocation },
]

export function isUrgency(v: string | null): v is Urgency {
  return v === 'overdue' || v === 'today' || v === 'future' || v === 'terminal'
}
