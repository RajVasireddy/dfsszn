import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || 'mlb'

    const keys = {
      mlb: process.env.SPORTSDATA_MLB_KEY,
      nba: process.env.SPORTSDATA_NBA_KEY,
      nfl: process.env.SPORTSDATA_NFL_KEY,
    }

    const urls = {
      mlb: `https://api.sportsdata.io/v3/mlb/scores/json/InjuredPlayers?key=${keys.mlb}`,
      nba: `https://api.sportsdata.io/v3/nba/scores/json/InjuredPlayers?key=${keys.nba}`,
      nfl: `https://api.sportsdata.io/v3/nfl/scores/json/InjuredPlayers?key=${keys.nfl}`,
    }

    const res = await fetch(urls[sport], { next: { revalidate: 1800 } })
    if (!res.ok) throw new Error('Failed to fetch injuries')
    const data = await res.json()

    return NextResponse.json({ success: true, sport, injuries: Array.isArray(data) ? data : [] })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
