import { NextResponse } from 'next/server'
import { cleanupOrphanedAuthUsers } from '@/lib/actions/users'

/**
 * TEMPORARY ENDPOINT FOR CLEANUP
 * DELETE THIS FILE AFTER CLEANUP IS DONE!
 * 
 * Usage:
 * 1. Uncomment this file
 * 2. Navigate to: http://localhost:3000/api/cleanup-orphaned-users
 * 3. Check the response
 * 4. Delete this file after cleanup
 * 
 * Security: Add authentication check before using in production!
 */

export async function GET() {
  // UNCOMMENT BELOW TO ENABLE THIS ENDPOINT
  // return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 })
  
  try {
    const result = await cleanupOrphanedAuthUsers()
    
    return NextResponse.json({
      success: result.success,
      cleaned: result.cleaned,
      message: result.message || result.error,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in cleanup endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cleanup orphaned users',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
