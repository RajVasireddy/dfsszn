import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { players, slate, sport, platform, numTotalLineups, slateNotes } = body

    const pitchers = players.filter(p => p.operatorPosition === 'SP' || p.operatorPosition === 'RP')
    const hitters = players.filter(p => p.operatorPosition !== 'SP' && p.operatorPosition !== 'RP')

    const teamGroups = {}
    hitters.forEach(p => {
      if (!teamGroups[p.team]) teamGroups[p.team] = []
      teamGroups[p.team].push(p)
    })

    const systemPrompt = `You are an expert DFS GPP tournament analyst specializing in MLB DraftKings contests. Your goal is maximum first-place equity through identifying optimal multi-stack portfolio construction.

FRAMEWORK:
1. SLATE ASSESSMENT — Identify the 2-4 best games for stacking (high totals, favorable parks, weak pitching)
2. STACK IDENTIFICATION — Find 3-5 teams worth stacking, rank by ceiling + ownership efficiency
3. PITCHER SELECTION — Identify 2-4 pitchers with high K upside against weak offenses
4. COMMON POOL — Find 2-4 players who provide leverage across multiple lineups
5. PORTFOLIO BALANCE — Distribute lineups across stacks to maximize field differentiation

Return ONLY valid JSON matching this exact schema:
{
  "suggested_stacks": [
    {
      "team": "PHI",
      "players": ["Player Name 1", "Player Name 2", "Player Name 3", "Player Name 4", "Player Name 5"],
      "lineupCount": 15,
      "reasoning": "1-2 sentence explanation",
      "ownership_source": "estimated"
    }
  ],
  "suggested_pitcher_pool": [
    {
      "name": "Pitcher Name",
      "maxExposurePct": 40,
      "reasoning": "why",
      "conflicts": []
    }
  ],
  "suggested_common_pool": [
    {
      "name": "Player Name",
      "maxExposurePct": 50,
      "reasoning": "why"
    }
  ],
  "suggested_exposure_caps": {
    "Player Name": 70
  },
  "slate_summary": "2-3 sentence slate narrative",
  "ownership_disclaimer": "Ownership projections are model estimates based on salary and projection data, not from a live DFS ownership feed"
}`

    const userPrompt = `Analyze this ${sport?.toUpperCase() || 'MLB'} DraftKings slate for GPP multi-stack portfolio construction.

PITCHERS (${pitchers.length}):
${pitchers.map(p => `${p.operatorPlayerName}($${p.operatorSalary},${p.projectedPoints}pts,${p.ownershipProjection}%own)`).join(' | ')}

HITTERS BY TEAM:
${Object.entries(teamGroups).map(([team, plist]) =>
  `${team}: ${plist.slice(0, 8).map(p =>
    `${p.operatorPlayerName}(${p.operatorPosition},$${p.operatorSalary},${p.projectedPoints}pts,${p.ownershipProjection}%own)`
  ).join(' | ')}`
).join('\n')}

TOTAL LINEUPS IN PORTFOLIO: ${numTotalLineups || 50}
${slateNotes ? `\nUSER RESEARCH NOTES (high-confidence real-time intel):\n${slateNotes}` : ''}

Identify the best 3-5 stacks for this slate with specific player recommendations. Focus on teams with:
- High implied team totals
- Favorable matchups vs weak/injured pitching
- Good lineup construction (top of order)
- Ownership differentiation opportunities

Return JSON only.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Claude API error:', err)
      return NextResponse.json({ success: false, error: `API error: ${response.status}` })
    }

    const aiData = await response.json()
    const content = aiData.content?.[0]?.text || ''

    let analysis
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      analysis = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('Parse failed:', e.message)
      return NextResponse.json({ success: false, error: 'Failed to parse AI response' })
    }

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    console.error('AI stack analysis error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
