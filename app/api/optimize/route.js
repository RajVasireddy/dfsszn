import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()

    const res = await fetch('http://localhost:5001/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Optimizer service unavailable. Make sure Python service is running.' },
      { status: 500 }
    )
  }
}