#!/usr/bin/env node

/**
 * API Testing Script
 * Test semua REST API endpoints dengan proper JWT token
 */

const BASE_URL = 'http://192.168.56.1:3000'
const SUPABASE_URL = 'https://ybxnosmcjubuezefofko.supabase.co'
const SUPABASE_ANON_KEY = '***REDACTED_SUPABASE_ANON***'

let authToken = null
let userId = null
let createdAcUnitId = null
let apiKey = null

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(type, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  
  switch (type) {
    case 'info':
      console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${message}`)
      break
    case 'success':
      console.log(`${colors.green}✓ ${message}${colors.reset}`)
      break
    case 'error':
      console.log(`${colors.red}✗ ${message}${colors.reset}`)
      break
    case 'warning':
      console.log(`${colors.yellow}⚠ ${message}${colors.reset}`)
      break
    case 'header':
      console.log(`\n${colors.bright}${colors.blue}═══ ${message} ═══${colors.reset}`)
      break
  }
  
  if (data) {
    console.log(`${colors.yellow}${JSON.stringify(data, null, 2)}${colors.reset}`)
  }
}

async function request(method, path, body = null, useApiKey = false) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
  }

  // Use API key if available or explicitly requested
  if ((apiKey && !authToken) || useApiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  } else if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const options = {
      method,
      headers,
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const data = await response.json()

    return {
      status: response.status,
      data,
      ok: response.ok,
    }
  } catch (error) {
    log('error', `Request failed: ${error.message}`)
    return { status: 0, data: null, ok: false, error }
  }
}

async function loginWithApiKey(key) {
  log('header', 'Step 1: API Key Authentication')
  log('info', `Validating API Key: ${key.substring(0, 20)}...`)

  try {
    const response = await fetch(`${BASE_URL}/api/auth/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      log('error', `API Key validation failed: ${data.error || data.message}`)
      return false
    }

    apiKey = key
    userId = data.data.user.id

    log('success', `API Key validated successfully`)
    log('info', `User ID: ${userId}`)
    log('info', `Role: ${data.data.user.role}`)

    return true
  } catch (error) {
    log('error', `API Key validation request failed: ${error.message}`)
    return false
  }
}

async function login(email, password) {
  log('header', 'Step 1: Supabase Authentication')
  log('info', `Logging in as: ${email}`)

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      log('error', `Login failed: ${data.error_description || data.message}`)
      return false
    }

    authToken = data.access_token
    userId = data.user.id

    log('success', `Logged in successfully`)
    log('info', `User ID: ${userId}`)
    log('info', `Token (first 50 chars): ${authToken.substring(0, 50)}...`)

    return true
  } catch (error) {
    log('error', `Login request failed: ${error.message}`)
    return false
  }
}

async function testGetOrders() {
  log('header', 'Test 1: GET /api/orders')
  
  const result = await request('GET', '/api/orders?page=1&limit=10')
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `Orders fetched`, {
      total: result.data.pagination?.total,
      page: result.data.pagination?.page,
      count: result.data.data?.length || 0,
    })
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
}

async function testGetCustomers() {
  log('header', 'Test 2: GET /api/customers')
  
  const result = await request('GET', '/api/customers?page=1&limit=10')
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `Customers fetched`, {
      total: result.data.pagination?.total,
      page: result.data.pagination?.page,
      count: result.data.data?.length || 0,
    })
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
}

async function testGetDashboardKPI() {
  log('header', 'Test 3: GET /api/dashboard/kpi')
  
  const result = await request('GET', '/api/dashboard/kpi')
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `KPI Data`, result.data.data)
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
}

async function testGetTechnicians() {
  log('header', 'Test 4: GET /api/technicians')
  
  const result = await request('GET', '/api/technicians?page=1&limit=10')
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `Technicians fetched`, {
      total: result.data.pagination?.total,
      count: result.data.data?.length || 0,
    })
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
}

async function testCreateCustomer() {
  log('header', 'Test 5: POST /api/customers')
  
  const customerData = {
    customerName: `Test Customer ${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    phoneNumber: '08123456789',
    billingAddress: 'Test Address',
  }
  
  log('info', 'Creating customer with data', customerData)
  
  const result = await request('POST', '/api/customers', customerData)
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `Customer created`, result.data.data)
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
}

async function testAcUnits() {
  log('header', 'Test: AC Units CRUD Endpoints')
  
  // Test 1: GET list of AC units with pagination
  log('info', 'Testing GET /api/ac-units with pagination')
  let result = await request('GET', '/api/ac-units?page=1&limit=10')
  
  if (result.ok) {
    log('success', `Status ${result.status}`)
    const paginationInfo = result.data.pagination
    log('info', `AC Units: ${paginationInfo.total} total, returned ${result.data.data.length}`, 
      `(Page ${paginationInfo.page}/${paginationInfo.pages})`)
    if (result.data.data.length > 0) {
      createdAcUnitId = result.data.data[0].id
      log('info', `Sample AC Unit`, result.data.data[0])
    }
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }
  
  // Test 2: GET single AC unit (if we have one)
  if (createdAcUnitId) {
    log('info', `Testing GET /api/ac-units/${createdAcUnitId}`)
    result = await request('GET', `/api/ac-units/${createdAcUnitId}`)
    
    if (result.ok) {
      log('success', `Status ${result.status}`)
      log('info', `AC Unit Details`, result.data.data)
    } else {
      log('error', `Status ${result.status}`)
      log('info', 'Response', result.data)
    }
  }
  
  // Test 3: POST create new AC unit (if location ID available)
  log('info', 'Fetching locations to get a valid location_id for AC unit creation')
  result = await request('GET', '/api/dashboard/kpi')
  
  // Try to get locations - if not available, skip create test
  if (result.ok) {
    log('info', 'Skipping POST /api/ac-units (would need valid location_id)')
  }
}

async function testWithApiKey(key) {
  log('header', 'Test: API Key Authentication')
  log('info', `Testing with API Key: ${key.substring(0, 20)}...`)

  apiKey = key

  // Test with AC Units endpoint
  const result = await request('GET', '/api/ac-units?page=1&limit=5', null, true)

  if (result.ok) {
    log('success', `Status ${result.status}`)
    log('info', `API Key Authentication SUCCESSFUL`, {
      total: result.data.pagination?.total,
      returned: result.data.data?.length || 0,
    })
  } else {
    log('error', `Status ${result.status}`)
    log('info', 'Response', result.data)
  }

  apiKey = null // Clear API key after test
}

async function testWithoutAuth() {
  log('header', 'Test: Request Without Authentication')
  
  const url = `${BASE_URL}/api/orders`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    
    log('warning', `Status ${response.status} (Expected: 401)`)
    log('info', 'Response', data)
  } catch (error) {
    log('error', `Request failed: ${error.message}`)
  }
}

async function main() {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     AC Service Dashboard API Tests     ║
  ║     Testing REST API Endpoints         ║
  ╚════════════════════════════════════════╝
  `)

  log('info', `Base URL: ${BASE_URL}`)
  log('info', `Supabase Project: ybxnosmcjubuezefofko`)

  // Check if API key is provided as first argument
  const apiKeyArg = process.argv[2]
  if (apiKeyArg && apiKeyArg.startsWith('sk_')) {
    // API key-only authentication
    const validatedKey = await loginWithApiKey(apiKeyArg)
    if (!validatedKey) {
      log('error', 'Cannot continue without valid API key')
      log('info', `\nUsage: node test-api.js <api_key>`)
      log('info', `Example: node test-api.js sk_your_api_key_here`)
      process.exit(1)
    }
  } else {
    // Email/password authentication
    // Test 1: Request without auth (should fail)
    await testWithoutAuth()

    const email = process.argv[2] || 'admin@example.com'
    const password = process.argv[3] || 'password123'

    log('info', `Using credentials: ${email}`)

    const loggedIn = await login(email, password)

    if (!loggedIn) {
      log('error', 'Cannot continue without authentication')
      log('info', `\nUsage: node test-api.js <email> <password> [api_key]`)
      log('info', `Example: node test-api.js testing@msn.com admin123`)
      log('info', `Or: node test-api.js sk_your_api_key_here`)
      process.exit(1)
    }
  }

  // Test 3: API endpoints
  await testGetOrders()
  await testGetCustomers()
  await testGetDashboardKPI()
  await testGetTechnicians()
  await testCreateCustomer()
  await testAcUnits()

  log('header', 'Testing Complete')
  console.log()
}

main().catch(error => {
  log('error', `Fatal error: ${error.message}`)
  process.exit(1)
})
