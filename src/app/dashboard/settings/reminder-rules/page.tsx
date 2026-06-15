'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { RulesTable } from './_components/rules-table'
import { RuleFormModal } from './_components/rule-form-modal'
import type { ReminderRuleFormData } from './_components/rule-form-modal'
import { DeleteConfirmDialog } from './_components/delete-confirm-dialog'
import {
  getReminderRules,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
} from '@/lib/actions/reminders'
import type { ReminderRule } from '@/lib/reminder-utils'

export default function ReminderRulesPage() {
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<ReminderRule | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      setIsFetching(true)
      const result = await getReminderRules()
      if (!result.success) throw new Error(result.error)
      const data = 'data' in result ? result.data : []
      setRules(Array.isArray(data) ? data : [])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat daftar reminder rules',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const handleOpenDialog = (rule?: ReminderRule) => {
    setEditingRule(rule ?? null)
    setIsDialogOpen(true)
  }

  const onSubmit = async (data: ReminderRuleFormData) => {
    try {
      setIsLoading(true)
      const result = editingRule
        ? await updateReminderRule(editingRule.rule_id, data)
        : await createReminderRule(data)

      if (!result.success) throw new Error(result.error)

      toast({
        title: 'Berhasil',
        description: editingRule
          ? 'Reminder rule berhasil diupdate'
          : 'Reminder rule berhasil ditambahkan',
      })

      setIsDialogOpen(false)
      setEditingRule(null)
      loadRules()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan reminder rule',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRule) return
    try {
      setIsLoading(true)
      const result = await deleteReminderRule(deletingRule.rule_id)
      if (!result.success) throw new Error(result.error)
      toast({ title: 'Berhasil', description: 'Reminder rule berhasil dihapus' })
      setIsDeleteDialogOpen(false)
      setDeletingRule(null)
      loadRules()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menghapus reminder rule',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Reminder Rules
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Kelola template dan threshold pengingat service rutin AC
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Tambah Rule
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 shadow-sm bg-card">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-foreground">Daftar Reminder Rules</h2>
          <p className="text-sm text-muted-foreground">{rules.length} rule terdaftar</p>
        </div>
        <div className="px-6 pb-6">
          <RulesTable
            rules={rules}
            isFetching={isFetching}
            onEdit={(rule) => handleOpenDialog(rule)}
            onDelete={(rule) => {
              setDeletingRule(rule)
              setIsDeleteDialogOpen(true)
            }}
            onAdd={() => handleOpenDialog()}
          />
        </div>
      </div>

      <RuleFormModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingRule={editingRule}
        isLoading={isLoading}
        onSubmit={onSubmit}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        ruleName={deletingRule?.name ?? ''}
        isLoading={isLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}
