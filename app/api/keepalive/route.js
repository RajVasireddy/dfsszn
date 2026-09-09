import { NextResponse } from 'next/server'

export async function GET() {
  const results = {}

  // Ping optimizer
  try {
    const optimizerUrl = process.env.OPTIMIZER_URL ||
      'http://localhost:5001'
    const res = await fetch(`${optimizerUrl}/health`, {
      signal: AbortSignal.timeout(10000)
    })
    const data = await res.json()
    results.optimizer = {
      status: res.ok ? 'awake' : 'error',
      response: data
    }
  } catch (err) {
    results.optimizer = {
      status: 'sleeping',
      error: err.message
    }
  }

  // Ping Supabase
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        signal: AbortSignal.timeout(5000)
      }
    )
    results.supabase = {
      status: res.ok ? 'awake' : 'error'
    }
  } catch (err) {
    results.supabase = {
      status: 'error',
      error: err.message
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    services: results
  })
}
