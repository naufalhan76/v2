'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// ==========================================
// SERVICE TYPES
// ==========================================
export async function getServiceTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createServiceType(input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_types').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function updateServiceType(id: string, input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_types').update(input).eq('service_type_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function deleteServiceType(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('service_types').delete().eq('service_type_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// UNIT TYPES
// ==========================================
export async function getUnitTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('unit_types')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createUnitType(input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('unit_types').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function updateUnitType(id: string, input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('unit_types').update(input).eq('unit_type_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function deleteUnitType(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('unit_types').delete().eq('unit_type_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// CAPACITY RANGES
// ==========================================
export async function getCapacityRanges(unitTypeId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('capacity_ranges')
    .select('*, unit_types(*)')
    .order('display_order', { ascending: true })
    .order('capacity_label', { ascending: true })
  
  if (unitTypeId) {
    query = query.eq('unit_type_id', unitTypeId)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createCapacityRange(input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('capacity_ranges').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function updateCapacityRange(id: string, input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('capacity_ranges').update(input).eq('capacity_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function deleteCapacityRange(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('capacity_ranges').delete().eq('capacity_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}


// ==========================================
// AC BRANDS
// ==========================================
export async function getAcBrands() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ac_brands')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createAcBrand(input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('ac_brands').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function updateAcBrand(id: string, input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('ac_brands').update(input).eq('brand_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function deleteAcBrand(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('ac_brands').delete().eq('brand_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

// ==========================================
// SERVICE CATALOG
// ==========================================
export async function getServiceCatalog(filters?: {
  unitTypeId?: string,
  capacityId?: string,
  serviceTypeId?: string,
  search?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('service_catalog')
    .select(`
      *,
      unit_types(name),
      capacity_ranges(capacity_label),
      service_types(name, code)
    `)
    .order('created_at', { ascending: false })

  if (filters?.unitTypeId) query = query.eq('unit_type_id', filters.unitTypeId)
  if (filters?.capacityId) query = query.eq('capacity_id', filters.capacityId)
  if (filters?.serviceTypeId) query = query.eq('service_type_id', filters.serviceTypeId)
  if (filters?.search) {
     query = query.or(`msn_code.ilike.%${filters.search}%,service_name.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createServiceCatalogEntry(input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_catalog').insert(input).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function updateServiceCatalogEntry(id: string, input: any) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('service_catalog').update(input).eq('catalog_id', id).select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, data }
}

export async function deleteServiceCatalogEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('service_catalog').delete().eq('catalog_id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true }
}

export async function bulkImportServiceCatalog(csvText: string) {
  const supabase = await createClient();
  
  // Parse CSV (Custom parser or assuming clean split)
  // Format: MSN Code, Type AC, Capacity, Tipe Service, Price
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  
  if (lines.length < 2) {
    return { success: false, error: "CSV format is invalid or empty" };
  }

  // Headers are in index 0
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  // Determine if it is actually comma-separated or tab-separated
  const delimiter = headers.length > 1 ? '\t' : ',';
  const records = lines.slice(1).map(l => l.split(delimiter));

  try {
     let createdCount = 0;

     // Cache to minimize DB calls during import
     const unitTypesMap = new Map();
     const capacityMap = new Map();
     const serviceTypesMap = new Map();

     for (const record of records) {
        if (record.length < 5) continue;
        const [msnCodeRaw, typeActRaw, capacityRaw, svcTypeRaw, priceRaw] = record;
        
        const msn_code = msnCodeRaw.trim();
        const unitTypeName = typeActRaw.trim();
        const capacityLabel = capacityRaw.trim();
        const serviceName = svcTypeRaw.trim(); // User's CSV uses service name
        
        let price = parseFloat(priceRaw.replace(/[^0-9.-]+/g,""));
        if (isNaN(price)) price = 0;

        // 1. Get or Create Unit Type
        let unitTypeId = unitTypesMap.get(unitTypeName);
        if (!unitTypeId) {
            let { data: ut } = await supabase.from('unit_types').select('unit_type_id').ilike('name', unitTypeName).single();
            if (!ut) {
               const { data: newUt } = await supabase.from('unit_types').insert({ name: unitTypeName }).select().single();
               ut = newUt;
            }
            if (ut) {
               unitTypeId = ut.unit_type_id;
               unitTypesMap.set(unitTypeName, unitTypeId);
            }
        }

        // 2. Get or Create Capacity Range
        let capacityId = capacityMap.get(`${unitTypeId}-${capacityLabel}`);
        if (!capacityId && unitTypeId) {
            let { data: cap } = await supabase.from('capacity_ranges')
                .select('capacity_id')
                .eq('unit_type_id', unitTypeId)
                .ilike('capacity_label', capacityLabel)
                .single();
            if (!cap) {
               const { data: newCap } = await supabase.from('capacity_ranges')
                   .insert({ unit_type_id: unitTypeId, capacity_label: capacityLabel })
                   .select().single();
               cap = newCap;
            }
            if (cap) {
                capacityId = cap.capacity_id;
                capacityMap.set(`${unitTypeId}-${capacityLabel}`, capacityId);
            }
        }

        // 3. Service Type mapping 
        // In the CSV, "Jasa Service Room Air (Checking)" is a name. We need to map it to a generic service type or create it.
        // For simplicity, we can create a service_type based on the generic part or just assign it. 
        // Let's create a generic "IMPORTED" service type or try to map if it contains keywords like checking/cleaning.
        let serviceTypeId;
        const serviceCode = serviceName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50);
        let { data: st } = await supabase.from('service_types').select('service_type_id').eq('code', serviceCode).single();
        
        if (!st) {
            const { data: newSt } = await supabase.from('service_types').insert({ 
               code: serviceCode, 
               name: serviceName 
            }).select().single();
            st = newSt;
        }

        if (st) serviceTypeId = st.service_type_id;

        if (unitTypeId && capacityId && serviceTypeId) {
           // Insert Catalog Entry
           const { error } = await supabase.from('service_catalog').upsert({
              msn_code,
              unit_type_id: unitTypeId,
              capacity_id: capacityId,
              service_type_id: serviceTypeId,
              service_name: serviceName,
              base_price: price,
              is_active: true
           }, { onConflict: 'msn_code' })
           
           if (!error) createdCount++;
        }
     }
     
     revalidatePath('/dashboard/konfigurasi/service-config');
     return { success: true, message: `Successfully imported ${createdCount} items.` };

  } catch (err: any) {
     return { success: false, error: err.message || "Failed to process import" };
  }
}

export async function bulkImportUnitTypes(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))

  let createdCount = 0
  for (const record of records) {
    if (record.length < 1) continue
    const name = record[0].trim()
    const description = record.length > 1 ? record[1].trim() : null
    
    if (name) {
      const { error } = await supabase.from('unit_types').insert({ name, description })
      if (!error) createdCount++
    }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} unit types.` }
}

export async function bulkImportCapacityRanges(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))

  let createdCount = 0
  for (const record of records) {
    if (record.length < 2) continue
    const unitTypeName = record[0].trim()
    const capacityLabel = record[1].trim()

    if (unitTypeName && capacityLabel) {
      let { data: ut } = await supabase.from('unit_types').select('unit_type_id').ilike('name', unitTypeName).single()
      if (!ut) {
         const { data: newUt } = await supabase.from('unit_types').insert({ name: unitTypeName }).select().single()
         ut = newUt
      }
      if (ut?.unit_type_id) {
        const { error } = await supabase.from('capacity_ranges').insert({ 
          unit_type_id: ut.unit_type_id, 
          capacity_label: capacityLabel 
        })
        if (!error) createdCount++
      }
    }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} capacity ranges.` }
}

export async function bulkImportAcBrands(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))

  let createdCount = 0
  for (const record of records) {
    if (record.length < 1) continue
    const name = record[0].trim()
    if (name) {
      const { error } = await supabase.from('ac_brands').insert({ name })
      if (!error) createdCount++
    }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} brands.` }
}

export async function bulkImportServiceTypes(csvText: string) {
  const supabase = await createClient()
  const lines = csvText.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return { success: false, error: 'CSV format is invalid or empty' }
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const delimiter = headers.length > 1 ? '\t' : ','
  const records = lines.slice(1).map(l => l.split(delimiter))

  let createdCount = 0
  for (const record of records) {
    if (record.length < 2) continue
    const codeRaw = record[0].trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
    const name = record[1].trim()
    const description = record.length > 2 ? record[2].trim() : null

    if (codeRaw && name) {
      const { error } = await supabase.from('service_types').insert({ 
        code: codeRaw, 
        name, 
        description 
      })
      if (!error) createdCount++
    }
  }
  revalidatePath('/dashboard/konfigurasi/service-config')
  return { success: true, message: `Successfully imported ${createdCount} service types.` }
}
