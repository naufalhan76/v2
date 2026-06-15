'use client'

import { useState, useMemo } from 'react'
import { getAvailableServiceTypes, calcPriceFromCatalog, findCatalogMatch, type SelectedAcLine } from '../_utils/service-line-helpers'

export type { SelectedAcLine }

export function useServiceLines(masterData: Record<string, unknown> | undefined) {
  const [serviceLines, setServiceLines] = useState<SelectedAcLine[]>([])
  const [lineCatalogMissing, setLineCatalogMissing] = useState<Record<string, boolean>>({})

  const catalog = (masterData?.serviceCatalog || []) as Array<Record<string, unknown>>
  const serviceTypes = (masterData?.serviceTypes || []) as Array<Record<string, unknown>>

  const getAvailableServiceTypesForLine = (unitTypeId: string, capacityId: string) =>
    getAvailableServiceTypes(catalog, serviceTypes, unitTypeId, capacityId)

  const updateServiceLine = (lineId: string, patch: Partial<SelectedAcLine>) => {
    let nextUnitType = ''
    let nextCapacity = ''
    let configChanged = false
    let updatedLines: SelectedAcLine[] = []

    setServiceLines((prev) => {
      updatedLines = prev.map((l) => {
        if (l.line_id !== lineId) return l
        const updated = { ...l, ...patch }
        nextUnitType = updated.unit_type_id || ''
        nextCapacity = updated.capacity_id || ''

        const isConfigChanging =
          'unit_type_id' in patch || 'capacity_id' in patch || 'service_type_id' in patch
        configChanged = isConfigChanging

        if (isConfigChanging && !updated.manual_price) {
          const { price, catalogId, msnCode, found } = calcPriceFromCatalog(
            catalog,
            updated.service_type_id,
            updated.unit_type_id || '',
            updated.capacity_id || '',
          )
          updated.estimated_price = price
          updated.catalog_id = catalogId
          updated.msn_code = msnCode

          const noMatch =
            !!updated.service_type_id && !!updated.unit_type_id && !!updated.capacity_id && !found
          setLineCatalogMissing((prev) => ({ ...prev, [lineId]: noMatch }))
        }

        return updated
      })
      return updatedLines
    })

    if (configChanged && nextUnitType && nextCapacity) {
      const line = updatedLines.find((l) => l.line_id === lineId)
      if (line?.service_type_id) {
        const hasMatch = catalog.some(
          (c) =>
            c.is_active !== false &&
            c.service_type_id === line.service_type_id &&
            c.unit_type_id === nextUnitType &&
            c.capacity_id === nextCapacity,
        )
        setLineCatalogMissing((prev) => ({ ...prev, [lineId]: !hasMatch }))
      }
    }
  }

  const updateServiceLineForGroup = (unitInstanceId: string, patch: Partial<SelectedAcLine>) => {
    const nextUnitType = patch.unit_type_id || ''
    const nextCapacity = patch.capacity_id || ''
    const configChanged = 'unit_type_id' in patch || 'capacity_id' in patch

    let updatedLines: SelectedAcLine[] = []
    setServiceLines((prev) => {
      updatedLines = prev.map((l) => {
        if (l.unit_instance_id !== unitInstanceId) return l
        const updated = { ...l, ...patch }

        if (configChanged && !updated.manual_price) {
          const { price, catalogId, msnCode } = calcPriceFromCatalog(
            catalog,
            updated.service_type_id,
            nextUnitType,
            nextCapacity,
          )
          updated.estimated_price = price
          updated.catalog_id = catalogId
          updated.msn_code = msnCode
        }

        return updated
      })
      return updatedLines
    })

    if (configChanged) {
      updatedLines
        .filter((l) => l.unit_instance_id === unitInstanceId)
        .forEach((l) => {
          const match = findCatalogMatch(catalog, l.service_type_id, nextUnitType, nextCapacity)
          const noMatch = match ? false : !!l.service_type_id && !!nextUnitType && !!nextCapacity
          setLineCatalogMissing((prev) => ({ ...prev, [l.line_id]: noMatch }))
        })
    }
  }

  const pickServiceForLine = (lineId: string, serviceTypeId: string) => {
    const st = serviceTypes.find((s) => s.service_type_id === serviceTypeId)
    if (!st) return
    const code = String(st.code || '')
    const name = String(st.name || code)
    updateServiceLine(lineId, { service_type_id: serviceTypeId, service_type_code: code, service_name: name })
  }

  const uniqueUnitInstanceIds = useMemo(() => {
    const ids: string[] = []
    serviceLines.forEach((line) => {
      if (!ids.includes(line.unit_instance_id)) ids.push(line.unit_instance_id)
    })
    return ids
  }, [serviceLines])

  const totalEstimatedPrice = useMemo(
    () => serviceLines.reduce((sum, l) => sum + l.estimated_price * l.quantity, 0),
    [serviceLines],
  )

  return {
    serviceLines,
    setServiceLines,
    lineCatalogMissing,
    getAvailableServiceTypesForLine,
    updateServiceLine,
    updateServiceLineForGroup,
    pickServiceForLine,
    uniqueUnitInstanceIds,
    totalEstimatedPrice,
  }
}
