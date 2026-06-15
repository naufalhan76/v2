export interface MaterialItem {
  addon_id?: string | null
  name: string
  qty: number
  unit_price: number
  total: number
  category?: string | null
  unit_of_measure?: string | null
  description?: string | null
  is_manual: boolean
}
