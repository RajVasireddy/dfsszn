import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { players, sport, platform, slate, numLineups, stackTeam, stackExposures, slateNotes } = body

    const pitchers = players.filter(p =>
      p.operatorPosition === 'SP' || p.operatorPosition === 'RP'
    )
    const hitters = players
      .filter(p => p.operatorPosition !== 'SP' && p.operatorPosition !== 'RP')
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))

    const teamGroups = {}
    hitters.forEach(p => {
      if (!teamGroups[p.team]) teamGroups[p.team] = []
      teamGroups[p.team].push(p)
    })

    const games = slate?.DfsSlateGames || []

    const systemPrompt = `You are a professional MLB DFS tournament player whose objective is to maximize long-term ROI in large-field GPP tournaments (50,000-200,000 entries).

Never optimize for median projection. Always optimize for expected value (EV), leverage, and first-place equity.

Use this decision framework on every slate, in order:

STEP 1 - Understand the slate before evaluating players.
Analyze: number of viable pitchers, chalk concentration, team totals, weather, park factors, salary structure, ownership concentration, value hitting, value pitching.
Classify the slate as one of: Pitching-heavy, Hitting-heavy, Balanced, Chalk-heavy, Wide-open.

STEP 2 - Identify Chalk.
Determine the highest-owned pitchers, highest-owned stacks, and highest-owned value plays. Never fade chalk automatically — determine if ownership exceeds true win probability.

STEP 3 - Find Leverage.
Look for teams with similar ceilings but much lower ownership, pitchers with similar upside but lower ownership, salary pivots, and under-owned stacks. Leverage means ownership inefficiency, not just low ownership for its own sake.

STEP 4 - Build Correlation.
Prioritize a 5-man primary stack plus a 3-man secondary stack. Avoid random one-offs unless they significantly improve leverage.

STEP 5 - Evaluate the Entire Portfolio.
Always compare each recommended build against the field. Ask: how many lineups will look like this? If this lineup wins, how unique is it? The objective is to maximize probability of finishing first, not cashing. Never recommend plays simply because they project highest — recommend plays because they maximize expected tournament ROI.

You must respond with ONLY valid JSON in this exact structure, no markdown, no prose outside the JSON:
{
  "slate_classification": {
    "type": "Pitching-heavy|Hitting-heavy|Balanced|Chalk-heavy|Wide-open",
    "reasoning": "why the slate fits this classification based on viable pitchers, chalk concentration, totals, weather, park factors, salary structure"
  },
  "chalk_analysis": {
    "highest_owned_pitchers": [{"name": "Pitcher Name", "team": "TEAM", "est_ownership": "25-30%", "is_ownership_justified": true, "note": "is this chalk's ownership justified by true win probability or inflated"}],
    "highest_owned_stacks": [{"team": "TEAM", "est_ownership": "20-25%", "is_ownership_justified": false, "note": "..."}],
    "highest_owned_value_plays": [{"name": "Player Name", "note": "..."}]
  },
  "leverage_spots": [
    {
      "type": "stack|pitcher|salary_pivot",
      "name_or_team": "Team or Player Name",
      "comparable_chalk": "what higher-owned option this is being compared against",
      "ownership_gap": "e.g. 8% owned vs 22% owned comparable",
      "ceiling_similarity": "how similar the ceiling/upside is despite the ownership gap",
      "reason": "why this is true leverage (ownership inefficiency) not just a worse play that happens to be low-owned"
    }
  ],
  "slate_summary": "2-3 sentence overview combining the slate classification and overall portfolio strategy",
  "exposure_plan": [
    {
      "team": "TEAM_ABBREV",
      "strategy": "short label e.g. Chalk / High Ceiling / Leverage / Contrarian / Punt",
      "percentage": 15,
      "reason": "why this exposure level, referencing chalk/leverage analysis above",
      "ownership_note": "field ownership expectation for this stack",
      "leverage_note": "leverage/contrarian angle, or 'this IS the chalk' if applicable",
      "ceiling_note": "tournament ceiling reasoning",
      "secondary_stack_team": "the recommended 3-man secondary stack team to pair with this primary 5-man stack"
    }
  ],
  "stack_shapes": [
    {"shape": "1-2-3-4-5", "usage_percentage": 30, "reason": "why this batting order shape"}
  ],
  "one_off_pool": {
    "elite_power": ["Player Name"],
    "speed": ["Player Name"],
    "salary_savers": ["Player Name"],
    "low_owned_leverage": ["Player Name"]
  },
  "pitcher_notes": [
    {
      "name": "Pitcher Name",
      "exposure_percentage": 20,
      "note": "why this exposure level, ownership and matchup reasoning, and whether this is chalk or leverage",
      "gpp_rating": "elite|good|ok|avoid"
    }
  ],
  "global_value_plays": [
    {"name": "Player Name", "team": "TEAM", "salary": 3500, "reason": "why"}
  ],
  "global_avoid": [
    {"name": "Player Name", "reason": "why"}
  ],
  "portfolio_uniqueness_check": {
    "estimated_field_overlap": "low|medium|high - how similar this portfolio's top builds will be to the rest of the 50k+ field",
    "differentiation_note": "what specifically makes this portfolio different from a field that just maximizes projection"
  },
  "portfolio_rules": {
    "max_hitter_exposure_pct": 40,
    "max_pitcher_exposure_pct": 35,
    "min_salary_used": 49000,
    "avg_salary_leftover": 150,
    "randomness_pct": 15,
    "ownership_cap_pct": 35,
    "max_hitters_vs_opposing_pitcher": 0,
    "min_unique_hitters_between_lineups": 3,
    "stack_diversity_note": "explanation of why this many unique stacks across the portfolio"
  }
}

The exposure_plan percentages MUST sum to exactly 100. Only recommend teams that have at least 5 viable hitters in the data provided. Each exposure_plan entry should reference the chalk_analysis and leverage_spots you identified — don't let the two sections contradict each other.`

    const userPrompt = `SLATE DATA FOR ANALYSIS:

GAMES (with Vegas lines and weather):
${games.map(sg => {
  const g = sg.Game || {}
  return `${g.AwayTeam}@${g.HomeTeam} | O/U:${g.OverUnder} | Spread:${g.PointSpread} | AwayML:${g.AwayTeamMoneyLine} | HomeML:${g.HomeTeamMoneyLine} | Wind:${g.ForecastWindSpeed}mph | Temp:${g.ForecastTempHigh}F`
}).join('\n')}

STARTING PITCHERS:
${pitchers.map(p =>
  `${p.operatorPlayerName} | ${p.team} | $${p.operatorSalary} | Proj:${p.projectedPoints || 0}pts | Own:${p.ownershipProjection || 0}%`
).join('\n')}

HITTERS BY TEAM (with implied team context where available):
${Object.entries(teamGroups).map(([team, plist]) =>
  `${team}: ${plist.map(p =>
    `${p.operatorPlayerName}(${p.operatorPosition},$${p.operatorSalary},${p.projectedPoints || 0}pts,${p.ownershipProjection || 0}%own)`
  ).join(' | ')}`
).join('\n')}

TOTAL LINEUPS BEING BUILT FOR THIS PORTFOLIO: ${numLineups}
${stackTeam ? `USER HAS A PREFERENCE FOR: ${stackTeam} (factor this in but don't be constrained by it if data suggests otherwise)` : ''}
${slateNotes ? `\nUSER SLATE NOTES (treat these as high-priority context — injury news, lineup changes, weather, matchup insights the user has researched):\n${slateNotes}` : ''}

Analyze this slate per your system instructions and return the JSON structure specified.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error response:', errText)
      throw new Error(`Claude API error: ${response.status}`)
    }

    const claudeData = await response.json()
    const content = claudeData.content[0]?.text || ''

    let analysis
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    } catch (e) {
      console.error('Initial parse failed, attempting repair. Content length:', content.length)
      console.error('Last 200 chars:', content.slice(-200))

      try {
        let repaired = content.match(/\{[\s\S]*/)?.[0] || content

        const openBraces = (repaired.match(/\{/g) || []).length
        const closeBraces = (repaired.match(/\}/g) || []).length
        const openBrackets = (repaired.match(/\[/g) || []).length
        const closeBrackets = (repaired.match(/\]/g) || []).length

        const lastCompleteComma = Math.max(
          repaired.lastIndexOf('},'),
          repaired.lastIndexOf('],'),
          repaired.lastIndexOf('",')
        )
        if (lastCompleteComma > 0 && lastCompleteComma > repaired.length - 300) {
          repaired = repaired.slice(0, lastCompleteComma + 1)
        }

        const missingBrackets = openBrackets - closeBrackets
        const missingBraces = openBraces - closeBraces

        for (let i = 0; i < missingBrackets; i++) repaired += ']'
        for (let i = 0; i < missingBraces; i++) repaired += '}'

        analysis = JSON.parse(repaired)
        console.log('Successfully repaired truncated JSON')
      } catch (repairError) {
        console.error('Repair attempt also failed:', repairError.message)
        return NextResponse.json({
          success: false,
          error: 'AI response was too long and got cut off. Try analyzing a smaller player pool, or try again.'
        })
      }
    }

    return NextResponse.json({ success: true, analysis })

  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
