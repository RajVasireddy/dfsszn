import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { players, sport, platform, slate, numLineups, stackTeam, stackExposures, slateNotes } = body

    const isNfl = sport === 'nfl'

    // "pitchers" is the pool of players broken out separately from the team-grouped
    // list. For MLB that's starting SP/RP; NFL has no equivalent split — QBs stay
    // grouped with their team's skill players so the model can see the whole stack.
    const pitchers = isNfl
      ? []
      : players.filter(p => p.operatorPosition === 'SP' || p.operatorPosition === 'RP')
    const hitters = players
      .filter(p => isNfl || (p.operatorPosition !== 'SP' && p.operatorPosition !== 'RP'))
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))

    const teamGroups = {}
    hitters.forEach(p => {
      if (!teamGroups[p.team]) teamGroups[p.team] = []
      teamGroups[p.team].push(p)
    })

    const games = slate?.DfsSlateGames || []

    const mlbSystemPrompt = `You are a professional MLB DFS tournament player whose objective is to maximize long-term ROI in large-field GPP tournaments (50,000-200,000 entries).

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

    const nflSystemPrompt = `You are an elite NFL DFS tournament strategist specializing in DraftKings/FanDuel-style 150-max GPPs (large-field tournaments).

Your philosophy:
- Optimize for first-place equity in large-field GPPs, never median projection.
- QB stacking is the foundation: a QB paired with 2+ pass catchers (WR/TE) from his own team is the primary build.
- Bring back at least 1 pass catcher (WR/TE/RB) from the opposing QB's team so the stack is exposed to both sides of a shootout.
- Game script matters: identify pass-heavy, high-total game environments over run-heavy/low-total ones.
- Vegas totals and spreads drive which games to stack — target the highest full-game totals and the more competitive spreads (script correlates to passing volume).
- Ownership leverage: a QB stack with a similar ceiling to the chalk stack but lower ownership is the highest-EV lever available.
- DST: prefer defenses at home facing weak/limited offenses, and never roster the DST of the team you're playing against with your stack (anti-correlated with your own stack's success).

NFL-specific rules:
- Primary stack: QB + WR1 + (WR2 or TE) from the same team.
- Secondary: 1 pass catcher (WR/TE/RB) from the opposing team as the bring-back.
- Never pair a QB stack with that same team's own DST.
- Prefer concentrated exposure (2-3 teams) on small slates (4-6 games), and broader exposure (5-6 teams) on large slates (10+ games).

You must respond with ONLY valid JSON in this exact structure, no markdown, no prose outside the JSON. Map the schema to NFL concepts as follows: "pitcher"/"hitter" language below refers to QB/skill-position players respectively — there is no NFL equivalent of an MLB starting pitcher, so treat every "pitcher_notes"-style field as QB notes, and set any purely MLB field (e.g. max_hitters_vs_opposing_pitcher) to 0.
{
  "slate_classification": {
    "type": "Pitching-heavy|Hitting-heavy|Balanced|Chalk-heavy|Wide-open",
    "reasoning": "why this slate fits (game totals/spreads, chalk concentration, weather, salary structure) — reinterpret 'Pitching-heavy' as 'run-heavy/defensive slate' and 'Hitting-heavy' as 'shootout slate'"
  },
  "chalk_analysis": {
    "highest_owned_pitchers": [{"name": "QB Name", "team": "TEAM", "est_ownership": "25-30%", "is_ownership_justified": true, "note": "is this QB's ownership justified by his true stack ceiling or inflated"}],
    "highest_owned_stacks": [{"team": "TEAM", "est_ownership": "20-25%", "is_ownership_justified": false, "note": "..."}],
    "highest_owned_value_plays": [{"name": "Player Name", "note": "..."}]
  },
  "leverage_spots": [
    {
      "type": "stack|pitcher|salary_pivot",
      "name_or_team": "Team or QB Name",
      "comparable_chalk": "what higher-owned QB stack this is being compared against",
      "ownership_gap": "e.g. 8% owned vs 22% owned comparable",
      "ceiling_similarity": "how similar the shootout/ceiling upside is despite the ownership gap",
      "reason": "why this is true leverage, not just a worse play that happens to be low-owned"
    }
  ],
  "slate_summary": "2-3 sentence overview combining the slate classification and overall portfolio strategy",
  "exposure_plan": [
    {
      "team": "TEAM_ABBREV",
      "strategy": "short label e.g. Chalk / High Ceiling / Leverage / Contrarian / Punt",
      "percentage": 15,
      "reason": "why this exposure level for this QB-anchored stack",
      "ownership_note": "field ownership expectation for this stack",
      "leverage_note": "leverage/contrarian angle, or 'this IS the chalk' if applicable",
      "ceiling_note": "shootout/tournament ceiling reasoning",
      "secondary_stack_team": "the recommended bring-back (opposing) team to pair with this primary QB stack"
    }
  ],
  "stack_shapes": [
    {"shape": "QB-WR1-WR2", "usage_percentage": 30, "reason": "why this skill-position combo (e.g. QB+2WR vs QB+WR+TE) fits this team's target distribution"}
  ],
  "one_off_pool": {
    "elite_power": ["Player Name (workhorse RBs with bell-cow volume)"],
    "speed": ["Player Name (big-play/deep-threat WRs)"],
    "salary_savers": ["Player Name"],
    "low_owned_leverage": ["Player Name"]
  },
  "pitcher_notes": [
    {
      "name": "QB Name",
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
    "stack_diversity_note": "explanation of why this many unique QB stacks across the portfolio"
  }
}

The exposure_plan percentages MUST sum to exactly 100. Only recommend teams that have at least a QB and 2 viable pass catchers in the data provided. Each exposure_plan entry should reference the chalk_analysis and leverage_spots you identified — don't let the two sections contradict each other.`

    const systemPrompt = isNfl ? nflSystemPrompt : mlbSystemPrompt

    const userPrompt = `SLATE DATA FOR ANALYSIS:

GAMES (with Vegas lines and weather):
${games.map(sg => {
  const g = sg.Game || {}
  return `${g.AwayTeam}@${g.HomeTeam} | O/U:${g.OverUnder} | Spread:${g.PointSpread} | AwayML:${g.AwayTeamMoneyLine} | HomeML:${g.HomeTeamMoneyLine} | Wind:${g.ForecastWindSpeed}mph | Temp:${g.ForecastTempHigh}F`
}).join('\n')}
${isNfl ? '' : `
STARTING PITCHERS:
${pitchers.map(p =>
  `${p.operatorPlayerName} | ${p.team} | $${p.operatorSalary} | Proj:${p.projectedPoints || 0}pts | Own:${p.ownershipProjection || 0}%`
).join('\n')}`}

${isNfl ? 'PLAYERS BY TEAM (QB + skill positions, with implied team context where available)' : 'HITTERS BY TEAM (with implied team context where available)'}:
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
      signal: AbortSignal.timeout(30000),
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
