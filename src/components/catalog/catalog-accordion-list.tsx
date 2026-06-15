import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { type ServiceCatalogEntry } from '@/lib/actions/service-catalog'
import { CatalogGroupTable } from './catalog-group-table'
import { type useCatalogToggleMutation } from './catalog-group-table'

interface CatalogAccordionListProps {
  groupedData: Record<string, ServiceCatalogEntry[]>
  groupKeys: string[]
  expandedItems: string[]
  onValueChange: (items: string[]) => void
  toggleMutation: ReturnType<typeof useCatalogToggleMutation>
  onEdit: (entry: ServiceCatalogEntry) => void
}

export function CatalogAccordionList({
  groupedData,
  groupKeys,
  expandedItems,
  onValueChange,
  toggleMutation,
  onEdit,
}: CatalogAccordionListProps) {
  if (groupKeys.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="Tidak ada catalog entry"
        description="Belum ada data catalog."
      />
    )
  }

  return (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={onValueChange}
      className="space-y-2"
    >
      {groupKeys.map((groupName) => {
        const entries = groupedData[groupName]
        const entryCount = entries?.length ?? 0

        return (
          <AccordionItem
            key={groupName}
            value={groupName}
            className="rounded-xl border border-border shadow-sm"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-surface-muted rounded-t-xl [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-[460]">{groupName}</span>
                <Badge variant="secondary" className="text-sm font-mono">
                  {entryCount}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 py-2">
              <CatalogGroupTable
                data={entries}
                onEdit={onEdit}
                toggleMutation={toggleMutation}
              />
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
