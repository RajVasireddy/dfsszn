import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const optimizerUrl = process.env.OPTIMIZER_URL ||
      'http://localhost:5001'

    console.log(`Calling optimizer at: ${optimizerUrl}`)

    // Vercel's Hobby (free) plan caps serverless functions at 60s (see
    // vercel.json's maxDuration) unless Fluid Compute is enabled. A 120s
    // internal timeout here would never fire — the platform kills the
    // function first with its own generic error, silently replacing the
    // friendly "waking up" message below. Stay safely under that ceiling.
    const res = await fetch(`${optimizerUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000)
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Optimizer error response:', errText)
      return NextResponse.json(
        {
          success: false,
          error: `Optimizer returned ${res.status}: ${errText}`
        },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Optimizer fetch error:', error)

    if (error.name === 'TimeoutError' ||
        error.name === 'AbortError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Optimizer timed out. It may be waking up from sleep — please try again in 30 seconds.'
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Optimizer service unavailable. Make sure it is running.'
      },
      { status: 500 }
    )
  }
}
