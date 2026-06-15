interface RulePreviewProps {
  template: string
  isActive: boolean
  autoSend: boolean
}

export function RulePreview({
  template,
  isActive,
  autoSend,
}: RulePreviewProps) {
  const previewText = template || 'Belum ada template pesan'

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Preview Pesan
      </div>
      <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground">
        {previewText}
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Status: {isActive ? 'Aktif' : 'Nonaktif'}</span>
        <span>|</span>
        <span>Pengiriman: {autoSend ? 'Otomatis' : 'Manual'}</span>
      </div>
    </div>
  )
}
