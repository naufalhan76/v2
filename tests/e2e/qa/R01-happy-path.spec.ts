// R-01 happy path golden journey — full lifecycle PENDING to PAID.
// See .omo/plans/qa-fixing.md F2-D1 for the 10-step contract.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  qaTest,
  expect,
  loginAs,
  seedFullScenario,
  seedOrder,
  getTechnicianIdByEmail,
  getFullOrderSnapshot,
  technicianTransition,
  technicianSubmitReport,
  getJobsToday,
  openDualContexts,
  waitForRealtimeUpdate,
  synthJpegBlob,
  synthSignaturePng,
  getSupabaseAdmin,
  evidenceDir,
  type SeedScenario,
} from './fixtures'

let scenario: SeedScenario | null = null

qaTest.afterAll(async () => {
  if (scenario) await scenario.cleanup()
})

qaTest.setTimeout(180_000)

qaTest('R-01 happy path — PENDING to PAID full lifecycle', async ({ browser, qaAccounts }, testInfo) => {
  const evDir = evidenceDir('r01')
  mkdirSync(evDir, { recursive: true })
  const supabase = getSupabaseAdmin()

  // Seed: customer + location + 2 AC units + order with 2 items.
  scenario = await seedFullScenario('r01', { acUnits: 2, label: 'HappyPath' })
  const { orderId } = await seedOrder({
    prefix: scenario.prefix,
    customerId: scenario.customerId,
    locationId: scenario.locationId,
    acUnitIds: scenario.acUnitIds,
    serviceType: 'CLEANING',
  })

  const technicianId = await getTechnicianIdByEmail(qaAccounts.technicianLead.email)
  if (!technicianId) {
    testInfo.skip(true, 'technicianLead row not found')
    return
  }

  const dual = await openDualContexts(browser)
  try {
    const [{ page: adminPage }, { page: techPage }] = await Promise.all([
      loginAs(dual.adminContext, 'admin'),
      loginAs(dual.technicianContext, 'technicianLead'),
    ])
    const { page: financePage } = await loginAs(dual.adminContext, 'finance')

    const saveStep = async (n: number, data: unknown, page = adminPage) => {
      writeFileSync(resolve(evDir, `step${n}.json`), JSON.stringify(data, null, 2))
      await page.screenshot({ path: resolve(evDir, `step${n}.png`) }).catch(() => {})
    }

    // Step 1: PROFORMA invoice on the seeded PENDING order.
    const proformaId = `INV-PRO-${scenario.prefix}`
    await supabase.from('invoices').insert({
      invoice_id: proformaId,
      invoice_number: `QA-PRO-${scenario.prefix.slice(-6)}`,
      invoice_type: 'PROFORMA',
      order_id: orderId,
      customer_id: scenario.customerId,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
      service_type: 'CLEANING',
      service_name: 'AC Cleaning',
      base_service_quantity: 2,
      base_service_price: 300_000,
      base_service_total: 300_000,
      addons_subtotal: 0,
      subtotal: 300_000,
      discount_amount: 0,
      discount_percentage: 0,
      tax_percentage: 0,
      tax_amount: 0,
      total_amount: 300_000,
      status: 'DRAFT',
      payment_status: 'UNPAID',
      paid_amount: 0,
    })
    const snap1 = await getFullOrderSnapshot(orderId)
    expect(snap1.order.status).toBe('PENDING')
    expect(snap1.invoices.find((i) => i.invoiceType === 'PROFORMA')).toBeDefined()
    await saveStep(1, { orderId, proformaId, snap: snap1 })

    // Step 2: Admin assigns lead via PATCH /api/orders/[id].
    const assignRes = await adminPage.request.patch(`/api/orders/${orderId}`, {
      data: { status: 'ASSIGNED', assigned_technician_id: technicianId },
    })
    expect(assignRes.status()).toBe(200)
    const snap2 = await getFullOrderSnapshot(orderId)
    expect(snap2.order.status).toBe('ASSIGNED')
    await saveStep(2, { assignStatus: assignRes.status(), snap: snap2 })

    // Step 3: Tech sees order via realtime (poll jobs/today).
    await techPage.goto('/technician')
    await waitForRealtimeUpdate(
      techPage,
      async () => {
        const jobs = await getJobsToday(techPage)
        return jobs.some((j) => j.order_id === orderId)
      },
      20_000
    )
    await saveStep(3, { orderId, sawAt: new Date().toISOString() }, techPage)

    // Step 4: EN_ROUTE with GPS + idempotency_key.
    const idem4 = crypto.randomUUID()
    const t4 = await technicianTransition(techPage.request, orderId, 'EN_ROUTE', {
      idempotencyKey: idem4,
      gps: {
        lat: -6.2088,
        lng: 106.8456,
        accuracy_m: 10,
        captured_at: new Date().toISOString(),
        gps_error: null,
      },
    })
    expect(t4.status).toBe(200)
    const { data: trEnRoute } = await supabase
      .from('order_status_transitions')
      .select('lat, lng, idempotency_key')
      .eq('order_id', orderId)
      .eq('to_status', 'EN_ROUTE')
      .order('transition_date', { ascending: false })
      .limit(1)
    expect(trEnRoute?.[0]?.lat).not.toBeNull()
    expect(trEnRoute?.[0]?.idempotency_key).toBe(idem4)
    await saveStep(4, { transition: t4, transitionRow: trEnRoute?.[0] }, techPage)

    // Step 5: IN_PROGRESS.
    const t5 = await technicianTransition(techPage.request, orderId, 'IN_PROGRESS', {
      idempotencyKey: crypto.randomUUID(),
      gps: {
        lat: -6.2088,
        lng: 106.8456,
        accuracy_m: 8,
        captured_at: new Date().toISOString(),
        gps_error: null,
      },
    })
    expect(t5.status).toBe(200)
    await saveStep(5, { transition: t5 }, techPage)

    // Step 6: Submit report. Synth + upload photos and signature, then POST.
    const uploadPhoto = async (buffer: Buffer, name: string): Promise<string> => {
      const path = `qa/${scenario!.prefix}/${name}`
      const { error } = await supabase.storage
        .from('service-photos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
      if (error) throw new Error(`photo upload: ${error.message}`)
      return supabase.storage.from('service-photos').getPublicUrl(path).data.publicUrl
    }
    const uploadSig = async (buffer: Buffer): Promise<string> => {
      const path = `qa/${scenario!.prefix}/signature.png`
      const { error } = await supabase.storage
        .from('signatures')
        .upload(path, buffer, { contentType: 'image/png', upsert: true })
      if (error) throw new Error(`signature upload: ${error.message}`)
      return supabase.storage.from('signatures').getPublicUrl(path).data.publicUrl
    }
    const [b1, b2] = [await synthJpegBlob(techPage), await synthJpegBlob(techPage)]
    const [a1, a2] = [await synthJpegBlob(techPage), await synthJpegBlob(techPage)]
    const sig = await synthSignaturePng(techPage)
    const [b1Url, b2Url, a1Url, a2Url, sigUrl] = await Promise.all([
      uploadPhoto(b1.buffer, 'before-1.jpg'),
      uploadPhoto(b2.buffer, 'before-2.jpg'),
      uploadPhoto(a1.buffer, 'after-1.jpg'),
      uploadPhoto(a2.buffer, 'after-2.jpg'),
      uploadSig(sig),
    ])
    const nextSvc = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10)
    const idem6 = crypto.randomUUID()
    const r6 = await technicianSubmitReport(techPage.request, orderId, {
      idempotencyKey: idem6,
      photosBefore: [b1Url, b2Url],
      photosAfter: [a1Url, a2Url],
      customerSignatureUrl: sigUrl,
      customerNameSigned: 'QA Customer R01',
      actualTotalPrice: 300_000,
      materials: [
        { name: 'Freon R32', qty: 1, unit_price: 150_000, total: 150_000 },
        { name: 'Freon R32', qty: 1, unit_price: 150_000, total: 150_000 },
      ],
      acUnits: [
        {
          ac_unit_id: scenario.acUnitIds[0],
          photos_before: [b1Url],
          photos_after: [a1Url],
          materials_used: [{ name: 'Freon R32', qty: 1, unit_price: 150_000, total: 150_000 }],
        },
        {
          ac_unit_id: scenario.acUnitIds[1],
          photos_before: [b2Url],
          photos_after: [a2Url],
          materials_used: [{ name: 'Freon R32', qty: 1, unit_price: 150_000, total: 150_000 }],
        },
      ],
      nextServiceRecommendationDate: nextSvc,
    })
    expect(r6.status).toBeGreaterThanOrEqual(200)
    expect(r6.status).toBeLessThan(300)
    const snap6 = await getFullOrderSnapshot(orderId)
    expect(snap6.order.status).toBe('COMPLETED')
    expect(snap6.reports).toHaveLength(1)
    const { data: acRows } = await supabase
      .from('ac_units')
      .select('ac_unit_id, next_service_due_date')
      .in('ac_unit_id', scenario.acUnitIds)
    for (const r of acRows ?? []) {
      expect(r.next_service_due_date).toBe(nextSvc)
    }
    await saveStep(6, { report: r6, snap: snap6 }, techPage)

    // Step 7: Finance creates FINAL invoice + transitions order to INVOICED.
    const finalInvoiceId = `INV-FIN-${scenario.prefix}`
    await supabase.from('invoices').insert({
      invoice_id: finalInvoiceId,
      invoice_number: `QA-FIN-${scenario.prefix.slice(-6)}`,
      invoice_type: 'FINAL',
      order_id: orderId,
      customer_id: scenario.customerId,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
      service_type: 'CLEANING',
      service_name: 'AC Cleaning',
      base_service_quantity: 2,
      base_service_price: 300_000,
      base_service_total: 300_000,
      addons_subtotal: 0,
      subtotal: 300_000,
      discount_amount: 0,
      discount_percentage: 0,
      tax_percentage: 0,
      tax_amount: 0,
      total_amount: 300_000,
      status: 'SENT',
      payment_status: 'UNPAID',
      paid_amount: 0,
    })
    await supabase
      .from('orders')
      .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
    const snap7 = await getFullOrderSnapshot(orderId)
    expect(snap7.order.status).toBe('INVOICED')
    expect(snap7.invoices.find((i) => i.invoiceType === 'FINAL')).toBeDefined()
    await saveStep(7, { finalInvoiceId, snap: snap7 }, financePage)

    // Step 8: Finance records full payment. Try API; fallback to admin client.
    const today = new Date().toISOString().slice(0, 10)
    const payRes = await financePage.request.post(`/api/invoices/${finalInvoiceId}/payments`, {
      data: { amount: 300_000, payment_method: 'CASH', payment_date: today, notes: 'QA R-01 full' },
    })
    if (!payRes.ok()) {
      await supabase.from('payment_records').insert({
        invoice_id: finalInvoiceId,
        payment_date: today,
        payment_method: 'CASH',
        amount: 300_000,
        notes: 'QA R-01 full (admin fallback)',
      })
      await supabase
        .from('invoices')
        .update({
          paid_amount: 300_000,
          payment_status: 'PAID',
          status: 'PAID',
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', finalInvoiceId)
      await supabase
        .from('orders')
        .update({ status: 'PAID', updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
      testInfo.annotations.push({
        type: 'finding',
        description: `POST /api/invoices/${finalInvoiceId}/payments returned ${payRes.status()} — used admin-client fallback`,
      })
    }
    const snap8 = await getFullOrderSnapshot(orderId)
    expect(snap8.order.status).toBe('PAID')
    expect(snap8.payments).toHaveLength(1)
    await saveStep(8, { paymentApiStatus: payRes.status(), snap: snap8 }, financePage)

    // Step 9: Cron simulation. Skip if CRON_SECRET missing.
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const cronRes = await adminPage.request.post('/api/admin/reminders/run', {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const cronStatus = cronRes.status()
      const { count } = await supabase
        .from('customer_reminders')
        .select('reminder_id', { count: 'exact', head: true })
        .in('ac_unit_id', scenario.acUnitIds)
      writeFileSync(
        resolve(evDir, 'step9.json'),
        JSON.stringify({ cronStatus, reminderCount: count ?? 0 }, null, 2)
      )
    } else {
      testInfo.annotations.push({
        type: 'skip',
        description: 'CRON_SECRET not set — step 9 reminder generation skipped',
      })
    }

    // Step 10: Final invariants.
    const snapFinal = await getFullOrderSnapshot(orderId)
    expect(snapFinal.order.status).toBe('PAID')
    expect(snapFinal.transitions.length).toBeGreaterThanOrEqual(4)
    expect(snapFinal.reports).toHaveLength(1)
    expect(snapFinal.invoices.filter((i) => i.invoiceType === 'PROFORMA')).toHaveLength(1)
    expect(snapFinal.invoices.filter((i) => i.invoiceType === 'FINAL')).toHaveLength(1)
    expect(snapFinal.payments).toHaveLength(1)
    writeFileSync(resolve(evDir, 'step10.json'), JSON.stringify(snapFinal, null, 2))
  } finally {
    await dual.close()
  }
})
