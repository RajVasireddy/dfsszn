import { NextResponse } from 'next/server'

const MLB_KEY = process.env.SPORTSDATA_MLB_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'draftkings'
    const passedDate = searchParams.get('date')

    let date = passedDate
    if (!date) {
      const today = new Date()
      const ET = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      date = ET.toISOString().split('T')[0]
    }

    const slatesRes = await fetch(
      `https://api.sportsdata.io/v3/mlb/projections/json/DfsSlatesByDate/${date}?key=${MLB_KEY}`,
      { next: { revalidate: 1800 } }
    )

    if (!slatesRes.ok) {
      throw new Error('Failed to fetch slates')
    }

    const rawSlates = await slatesRes.json()

    const filtered = rawSlates
      .filter(slate =>
        slate.Operator?.toLowerCase().includes(platform.toLowerCase())
      )
      .map(slate => {
        const players = slate.DfsSlatePlayers || []
        return {
          SlateID: slate.SlateID,
          Operator: slate.Operator,
          OperatorName: slate.OperatorName,
          OperatorDay: slate.OperatorDay,
          OperatorStartTime: slate.OperatorStartTime,
          NumberOfGames: slate.NumberOfGames,
          SalaryCap: slate.SalaryCap,
          SlateRosterSlots: slate.SlateRosterSlots,
          OperatorGameType: slate.OperatorGameType,
          DfsSlateGames: slate.DfsSlateGames,
          players: players
        }
      })

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