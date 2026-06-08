export interface LineItem {
  type: 'BASE_SERVICE' | 'ADDON'
  description: string
  quantity: number
  unitPrice: number
  total: number
  addonId?: string
}

export const getBaseServiceNames = (items: LineItem[]) => {
  return items.flatMap((item) =>
    item.type === 'BASE_SERVICE' ? [item.description.split(' (')[0]] : []
  )
}

export const getBaseServiceItems = (items: LineItem[]) => {
  return items.flatMap((item, index) =>
    item.type === 'BASE_SERVICE' ? [{ item, index }] : []
  )
}
