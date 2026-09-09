import { NextResponse } from 'next/server'

const NFL_KEY = process.env.SPORTSDATA_NFL_KEY

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const platform = searchParams.get('platform') || 'draftkings'

        const today = new Date()
        const ET = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        const date = ET.toISOString().split('T')[0]

        const slatesRes = await fetch(
            `https://api.sportsdata.io/v3/nfl/projections/json/DfsSlatesByDate/${date}?key=${NFL_KEY}`,
            { next: { revalidate: 1800 } }
        )

        if (!slatesRes.ok) {
            throw new Error('Failed to fetch slates')
        }

        const slates = await slatesRes.json()

        const filtered = slates
            .filter(slate =>
                slate.Operator?.toLowerCase().includes(platform.toLowerCase())
            )
            .map(slate => ({
                ...slate,
                players: slate.DfsSlatePlayers || []
            }))

        return NextResponse.json({
            success: true,
            date,
            platform,
            slates: filtered
        })

    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}