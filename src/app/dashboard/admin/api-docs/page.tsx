'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Package,
  Zap,
  Lock,
  Database,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ApiKeysManagement } from '@/components/api-keys-management'
import { ApiKeyDisplay } from '@/components/api-key-display'

const API_ENDPOINTS = [
  {
    category: 'Orders',
    icon: Package,
    endpoints: [
      {
        method: 'GET',
        path: '/api/orders',
        description: 'List all orders with filtering and pagination',
        params: ['page', 'limit', 'status', 'statusIn', 'customerId', 'dateFrom', 'dateTo'],
        auth: true,
        example: '/api/orders?page=1&limit=20&status=NEW',
      },
      {
        method: 'POST',
        path: '/api/orders/create',
        description: 'Create a new order',
        body: {
          customerId: 'uuid (required)',
          locationId: 'uuid (required)',
          orderType: 'string (required)',
          description: 'string (optional)',
        },
        auth: true,
      },
      {
        method: 'POST',
        path: '/api/orders/[id]/status',
        description: 'Update order status with validation. When status is RESCHEDULE, req_visit_date is required and technician assignments are auto-reset.',
        body: {
          newStatus: 'enum (required)',
          req_visit_date: 'ISO 8601 datetime (required when newStatus = RESCHEDULE)',
        },
        auth: true,
      },
    ],
  },
  {
    category: 'Customers',
    icon: Database,
    endpoints: [
      {
        method: 'GET',
        path: '/api/customers',
        description: 'List customers with search and pagination',
        params: ['search', 'page', 'limit'],
        auth: true,
        example: '/api/customers?search=Jakarta&page=1',
      },
      {
        method: 'POST',
        path: '/api/customers',
        description: 'Create a new customer',
        body: {
          customerName: 'string (required)',
          phoneNumber: 'string (required)',
          email: 'string (optional)',
          primaryContactPerson: 'string (optional)',
          billingAddress: 'string (optional)',
        },
        auth: true,
      },
    ],
  },
  {
    category: 'Dashboard',
    icon: Zap,
    endpoints: [
      {
        method: 'GET',
        path: '/api/dashboard/kpi',
        description: 'Fetch KPI metrics and statistics',
        params: ['dateFrom', 'dateTo', 'customerId', 'technicianId'],
        auth: true,
        example: '/api/dashboard/kpi?dateFrom=2024-01-01&dateTo=2024-01-31',
      },
    ],
  },
  {
    category: 'Technicians',
    icon: FileText,
    endpoints: [
      {
        method: 'GET',
        path: '/api/technicians',
        description: 'List technicians with search',
        params: ['search', 'page', 'limit'],
        auth: true,
        example: '/api/technicians?search=Tono',
      },
    ],
  },
  {
    category: 'Service Records',
    icon: CheckCircle2,
    endpoints: [
      {
        method: 'POST',
        path: '/api/service-records/[id]/complete',
        description: 'Mark service record as completed',
        body: {
          descriptionOfWork: 'string (optional)',
          cost: 'number (optional)',
          nextServiceDue: 'ISO datetime (optional)',
        },
        auth: true,
      },
    ],
  },
  {
    category: 'AC Units',
    icon: Filter,
    endpoints: [
      {
        method: 'GET',
        path: '/api/ac-units',
        description: 'List AC units with filtering, search and pagination',
        params: ['page', 'limit', 'search', 'location_id'],
        auth: true,
        example: '/api/ac-units?page=1&limit=20&search=Daikin',
      },
      {
        method: 'POST',
        path: '/api/ac-units',
        description: 'Create a new AC unit',
        body: {
          location_id: 'uuid (required)',
          brand: 'string (required)',
          model_number: 'string (required)',
          serial_number: 'string (required)',
          ac_type: 'string (required)',
          capacity_btu: 'number (required)',
          installation_date: 'ISO datetime (optional)',
          status: 'string (optional, default: ACTIVE)',
        },
        auth: true,
      },
      {
        method: 'GET',
        path: '/api/ac-units/[id]',
        description: 'Fetch specific AC unit with related data',
        params: ['id'],
        auth: true,
        example: '/api/ac-units/550e8400-e29b-41d4-a716-446655440000',
      },
      {
        method: 'PUT',
        path: '/api/ac-units/[id]',
        description: 'Update AC unit details',
        body: {
          brand: 'string (optional)',
          model_number: 'string (optional)',
          serial_number: 'string (optional)',
          ac_type: 'string (optional)',
          capacity_btu: 'number (optional)',
          installation_date: 'ISO datetime (optional)',
          status: 'string (optional)',
        },
        auth: true,
      },
      {
        method: 'DELETE',
        path: '/api/ac-units/[id]',
        description: 'Delete AC unit (if no service records exist)',
        params: ['id'],
        auth: true,
      },
    ],
  },
]

const HTTP_STATUS_CODES = [
  { code: 200, meaning: 'OK', description: 'Successful GET/POST request' },
  { code: 201, meaning: 'Created', description: 'Resource successfully created' },
  { code: 400, meaning: 'Bad Request', description: 'Validation error or malformed request' },
  { code: 401, meaning: 'Unauthorized', description: 'Missing or invalid authentication token' },
  { code: 403, meaning: 'Forbidden', description: 'User lacks required permissions' },
  { code: 404, meaning: 'Not Found', description: 'Resource does not exist' },
  { code: 409, meaning: 'Conflict', description: 'Duplicate entry or constraint violation' },
  { code: 500, meaning: 'Server Error', description: 'Unexpected server-side error' },
]

export default function ApiDocsPage() {
  const { toast } = useToast()
  const [copiedCode, setCopiedCode] = useState<string>('')

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    toast({
      title: 'Copied to clipboard',
      duration: 2000,
    })
    setTimeout(() => setCopiedCode(''), 2000)
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-800'
      case 'POST':
        return 'bg-green-100 text-green-800'
      case 'PUT':
        return 'bg-orange-100 text-orange-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-8 w-8 text-blue-600" />
          <h1 className="text-4xl font-bold">API Documentation</h1>
        </div>
        <p className="text-gray-600">
          Complete REST API reference for the AC Service Management System
        </p>
      </div>

      {/* API Key Section */}
      <ApiKeyDisplay />

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {API_ENDPOINTS.reduce((acc, cat) => acc + cat.endpoints.length, 0)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Across 5 categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-600" />
              <span className="font-medium">JWT or API Key</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Bearer token or API key in header</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-gray-100 p-1 rounded">
              {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
            </code>
            <p className="text-xs text-gray-600 mt-1">/api/*</p>
          </CardContent>
        </Card>
      </div>

      {/* Endpoints Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>
            All endpoints require authentication via Bearer token in Authorization header
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="Orders" className="w-full">
            <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
              {API_ENDPOINTS.map(category => (
                <TabsTrigger key={category.category} value={category.category}>
                  {category.category}
                </TabsTrigger>
              ))}
            </TabsList>

            {API_ENDPOINTS.map(category => (
              <TabsContent key={category.category} value={category.category} className="space-y-4 mt-6">
                <div className="space-y-4">
                  {category.endpoints.map((endpoint, idx) => (
                    <Card key={`${category.category}-${idx}`} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <Badge className={getMethodColor(endpoint.method)}>
                              {endpoint.method}
                            </Badge>
                            <code className="text-sm bg-gray-100 p-2 rounded font-mono">
                              {endpoint.path}
                            </code>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(endpoint.path, `${category.category}-${idx}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{endpoint.description}</p>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Query Parameters */}
                        {(endpoint as any).params && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <Filter className="h-4 w-4" />
                              Query Parameters
                            </h4>
                            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                              {(endpoint as any).params.map((param: string) => (
                                <div key={param} className="font-mono text-xs">
                                  {param}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {endpoint.body && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Request Body</h4>
                            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                              {Object.entries(endpoint.body).map(([key, value]) => (
                                <div key={key} className="font-mono text-xs">
                                  <span className="text-blue-600">{key}</span>
                                  <span className="text-gray-600">: {value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Example */}
                        {(endpoint as any).example && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Example</h4>
                            <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono">
                              <div>GET {(endpoint as any).example}</div>
                              <div className="text-gray-500 mt-1">Authorization: Bearer YOUR_TOKEN</div>
                            </div>
                          </div>
                        )}

                        {/* Auth Badge */}
                        {endpoint.auth && (
                          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                            <Lock className="h-3 w-3" />
                            Authentication Required
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* HTTP Status Codes */}
      <Card>
        <CardHeader>
          <CardTitle>HTTP Status Codes</CardTitle>
          <CardDescription>
            Common response status codes returned by the API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HTTP_STATUS_CODES.map(status => (
              <div
                key={status.code}
                className="border rounded-lg p-4 flex items-start gap-3"
              >
                <div className="flex-shrink-0">
                  {status.code < 400 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-mono font-semibold">
                    {status.code} {status.meaning}
                  </div>
                  <p className="text-sm text-gray-600">{status.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Authentication Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            How to authenticate API requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Authorization Header Format</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm">
              Authorization: Bearer {'<JWT_TOKEN>'}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Getting Your Token</h4>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm space-y-2">
              <p>1. Login to the application at <code className="bg-white px-2 py-1 rounded">/login</code></p>
              <p>2. Your session automatically includes a Supabase JWT token</p>
              <p>3. Include this token in the Authorization header for all API requests</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Example Request</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <div>curl -X GET http://localhost:3000/api/orders \</div>
              <div>{'  '}-H &quot;Authorization: Bearer YOUR_TOKEN&quot; \</div>
              <div>{'  '}-H &quot;Content-Type: application/json&quot;</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>
            Generate and manage API keys for programmatic access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysManagement />
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card>
        <CardHeader>
          <CardTitle>Response Format</CardTitle>
          <CardDescription>
            Standard response structure for all endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Success Response</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              {`{
  "success": true,
  "data": { /* resource data */ },
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}`}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Error Response</h4>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              {`{
  "success": false,
  "error": "Validation failed: customerId must be a UUID",
  "message": "[{\\"field\\": \\"customerId\\", \\"message\\": \\"Invalid UUID\\"}]"
}`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Additional Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            For detailed information about API implementation, please refer to:
          </p>
          <ul className="space-y-2">
            <li>
              <a href="#" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                <ExternalLink className="h-3 w-3" />
                REST API Guide (REST_API_GUIDE.md)
              </a>
            </li>
            <li>
              <a href="#" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                <ExternalLink className="h-3 w-3" />
                API Endpoints Reference (API_ENDPOINTS.md)
              </a>
            </li>
            <li>
              <a href="#" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                <ExternalLink className="h-3 w-3" />
                Implementation Status (REST_API_PHASE1_COMPLETE.md)
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-600">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p>API Version: 1.0 (Phase 1)</p>
      </div>
    </div>
  )
}
