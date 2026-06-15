import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type ProformaOptionsProps = {
  createProforma: boolean
  onProformaChange: (checked: boolean) => void
}

export function ProformaOptions({ createProforma, onProformaChange }: ProformaOptionsProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-4">
      <Checkbox
        id="create-proforma"
        checked={createProforma}
        onCheckedChange={(v) => onProformaChange(v === true)}
      />
      <div className="flex-1">
        <Label htmlFor="create-proforma" className="cursor-pointer text-sm font-medium">
          Buat Proforma Invoice otomatis
        </Label>
        <p className="text-xs text-muted-foreground">
          Proforma invoice akan dibuat dengan harga estimasi. Bisa direvisi setelah
          service selesai dilakukan.
        </p>
      </div>
    </div>
  )
}
