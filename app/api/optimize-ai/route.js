import { NextResponse } from 'next/server'

const MAX_LINEUPS = 50

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      players, slots, cap, minSalary, maxSalary,
      numLineups, stackTeam, stackExposures,
      fillPoolIds, lockedIds, excludedIds,
      playersPerTeamMax, hittersVsPitcher,
      sport, platform, slate,
    } = body

    const requested = Math.min(numLineups, MAX_LINEUPS)

    // Build player context
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

    const lockedSet = new Set(lockedIds || [])
    const excludedSet = new Set(excludedIds || [])
    const fillSet = new Set(fillPoolIds || [])

    const games = slate?.DfsSlateGames || []

    // Build playerById early — used by tryFixSalary and validateLineup
    const playerById = {}
    players.forEach(p => { playerById[p.slatePlayerId] = p })

    // Determine candidate stack teams from the hitters pool
    const teamHitterCounts = {}
    hitters.forEach(p => {
      teamHitterCounts[p.team] = (teamHitterCounts[p.team] || 0) + 1
    })
    const viableStackTeams = Object.entries(teamHitterCounts)
      .filter(([team, count]) => count >= 5)
      .map(([team]) => team)

    const baseStackTeam = stackTeam || viableStackTeams[0] || null
    const secondaryStackTeam = viableStackTeams.find(t => t !== baseStackTeam) || null

    const STRATEGIES = [
      { name: 'Chalk Smash', desc: 'Use the highest-owned, highest-projected players for cash-adjacent safety.', team: baseStackTeam },
      { name: 'High Total Stack', desc: 'Stack the offense in the game with the highest implied team score / over-under.', team: baseStackTeam },
      { name: 'Low-Owned Leverage', desc: 'Target players projected well below their expected ownership tier. Avoid anything over 25% owned.', team: baseStackTeam },
      { name: 'Pitcher Pivot', desc: 'Fade the most popular ace, use a cheaper contrarian pitcher to fund the stack.', team: baseStackTeam },
      { name: 'Contrarian Secondary Stack', desc: `Stack ${secondaryStackTeam || 'a less popular team'} instead of the chalk team, and fill remaining hitter slots with the cheapest viable value plays from other teams (not the primary stack team) to maximize salary efficiency for the stack.`, team: secondaryStackTeam || baseStackTeam },
      { name: 'Punt & Pay-Up', desc: 'Use 1-2 minimum-salary punt plays to afford a max-salary stud elsewhere. Extreme salary distribution.', team: baseStackTeam },
    ]

    // Cap each strategy at 10-15% of total, minimum 2, maximum 8
    const minPerStrategy = Math.max(2, Math.floor(requested * 0.10))
    const maxPerStrategy = Math.max(minPerStrategy, Math.ceil(requested * 0.15))

    // Use all 6 strategies, distributing count within the 10-15% band
    const chosenStrategies = STRATEGIES.map(s => ({ ...s }))

    let remaining = requested
    const strategyAllocations = chosenStrategies.map((s, i) => {
      const isLast = i === chosenStrategies.length - 1
      let count
      if (isLast) {
        count = Math.max(minPerStrategy, remaining)
      } else {
        count = Math.min(maxPerStrategy, remaining - minPerStrategy * (chosenStrategies.length - i - 1))
        count = Math.max(minPerStrategy, count)
      }
      remaining -= count
      return { ...s, count }
    })

    console.log('Strategy allocations:', strategyAllocations.map(
      s => `${s.name}: ${s.count} (${((s.count / requested) * 100).toFixed(0)}%)`
    ))

    // Pre-build shared player list strings
    const pitcherList = pitchers.map(p =>
      `ID:${p.slatePlayerId} ${p.operatorPlayerName} ${p.team} $${p.operatorSalary} ${p.projectedPoints}pts ${p.ownershipProjection}%own${lockedSet.has(p.slatePlayerId) ? ' [LOCKED]' : ''}${excludedSet.has(p.slatePlayerId) ? ' [EXCLUDED]' : ''}`
    ).join('\n')

    const hitterList = Object.entries(teamGroups).map(([team, plist]) =>
      `${team}:\n${plist.map(p =>
        `  ID:${p.slatePlayerId} ${p.operatorPlayerName}(${p.operatorPosition}) $${p.operatorSalary} ${p.projectedPoints}pts ${p.ownershipProjection}%own${lockedSet.has(p.slatePlayerId) ? ' [LOCKED]' : ''}${excludedSet.has(p.slatePlayerId) ? ' [EXCLUDED]' : ''}${fillSet.has(p.slatePlayerId) ? ' [FILL_POOL]' : ''}`
      ).join('\n')}`
    ).join('\n\n')

    const gamesList = games.map(sg => {
      const g = sg.Game || {}
      return `${g.AwayTeam}@${g.HomeTeam} O/U:${g.OverUnder} Wind:${g.ForecastWindSpeed}mph`
    }).join('\n')

    const buildPrompt = (strategy, count) => `You are an expert MLB DFS GPP lineup builder.

TASK: Build ${count} unique, valid GPP lineups for ${platform} ${sport.toUpperCase()} using the "${strategy.name}" strategy.

STRATEGY: ${strategy.name}
${strategy.desc}

ROSTER FORMAT: ${slots.join(', ')}
SALARY CAP: $${cap} | MIN SALARY: $${minSalary}
${strategy.team ? `PRIMARY STACK REQUIRED: exactly 5 hitters from ${strategy.team} in EVERY one of the ${count} lineups in this batch. Vary the OTHER 5 non-stack players across the ${count} lineups (different pitchers, different value plays) while keeping the same 5-player ${strategy.team} core philosophy per the strategy.` : ''}
MAX PLAYERS PER TEAM: ${playersPerTeamMax || 5}
${hittersVsPitcher > 0 ? `MAX HITTERS VS OWN PITCHER: ${hittersVsPitcher}` : ''}

GAMES:
${gamesList}

AVAILABLE PITCHERS:
${pitcherList}

AVAILABLE HITTERS BY TEAM:
${hitterList}

HARD RULES (lineups violating these are useless, follow exactly):
1. You MUST return EXACTLY ${count} lineups in the "lineups" array. Not 1. Not fewer. EXACTLY ${count}.
2. Each lineup has EXACTLY ${slots.length} players, one per slot: ${slots.join(', ')}
3. Total salary MUST be >= $${minSalary} and <= $${cap}. Lineups under $${minSalary} will be REJECTED. Spend close to the cap — aim for $${cap - 200}-$${cap}.
4. Only use IDs listed above, no duplicates within a lineup
5. Fill every single slot — never skip one
6. P slots accept SP or RP
7. LOCKED players must appear in every lineup; EXCLUDED players must never appear
8. Each of the ${count} lineups must differ by at least 2 players from the others in this batch
9. Apply the "${strategy.name}" strategy described above as the guiding logic for player selection, but salary range compliance (#3) is non-negotiable and overrides strategy preference if there's a conflict

Before responding, double check: does the "lineups" array contain exactly ${count} entries? Does every lineup's total salary fall between $${minSalary} and $${cap}?

Respond with ONLY this JSON — no markdown, no explanation:
{
  "lineups": [
    {
      "strategy": "${strategy.name}",
      "reasoning": "brief reasoning for this specific lineup",
      "players": [
        {"slatePlayerId": 123, "slot": "P"},
        {"slatePlayerId": 456, "slot": "P"},
        {"slatePlayerId": 789, "slot": "C"}
      ]
    }
  ]
}`

    const callClaude = async (prompt) => {
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
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Claude API error:', errText)
        throw new Error(`Claude API error: ${response.status}`)
      }

      const claudeData = await response.json()
      const content = claudeData.content[0]?.text || ''

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        return JSON.parse(jsonMatch ? jsonMatch[0] : content)
      } catch (e) {
        console.error('Failed to parse Claude lineup response:', content.slice(0, 500))
        throw new Error('Failed to parse AI lineup response')
      }
    }

    // Run all strategies in parallel
    const batchSettled = await Promise.allSettled(
      strategyAllocations.map(strategy =>
        callClaude(buildPrompt(strategy, strategy.count))
          .then(result => ({ strategy: strategy.name, result, team: strategy.team }))
      )
    )

    const batchResults = batchSettled
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    const tryFixSalary = (lu, currentStackTeam) => {
      const playersCopy = [...lu.players]
      const usedIds = new Set(playersCopy.map(p => p.slatePlayerId))

      const getTotal = () => playersCopy.reduce((sum, p) =>
        sum + (playerById[p.slatePlayerId]?.operatorSalary || 0), 0)

      const countStackTeam = () => {
        if (!currentStackTeam) return 0
        return playersCopy.filter(p =>
          playerById[p.slatePlayerId]?.team === currentStackTeam
        ).length
      }

      let total = getTotal()
      let attempts = 0
      const maxAttempts = 15

      while (attempts < maxAttempts) {
        attempts++
        if (total >= minSalary - 1000 && total <= cap) break

        if (total > cap) {
          // OVERSPEND: downgrade most expensive NON-stack player first
          const candidates_idx = playersCopy
            .map((p, idx) => ({ idx, p, salary: playerById[p.slatePlayerId]?.operatorSalary || 0, team: playerById[p.slatePlayerId]?.team }))
            .filter(x => {
              if (!currentStackTeam) return true
              if (x.team !== currentStackTeam) return true
              return countStackTeam() > 5
            })
            .sort((a, b) => b.salary - a.salary)

          if (candidates_idx.length === 0) break
          const target = candidates_idx[0]
          const slot = target.p.slot
          const currentPlayer = playerById[target.p.slatePlayerId]
          const overage = total - cap

          const sameTeamConstraint = currentStackTeam && currentPlayer?.team === currentStackTeam
          const replacements = players.filter(p => {
            if (usedIds.has(p.slatePlayerId)) return false
            if (p.operatorPosition !== currentPlayer?.operatorPosition) return false
            if (sameTeamConstraint && p.team !== currentStackTeam) return false
            const sal = p.operatorSalary || 0
            return sal < target.salary && sal >= target.salary - overage - 3000
          }).sort((a, b) => b.operatorSalary - a.operatorSalary)

          if (replacements.length === 0) break
          const downgrade = replacements[0]
          usedIds.delete(target.p.slatePlayerId)
          usedIds.add(downgrade.slatePlayerId)
          total = total - target.salary + downgrade.operatorSalary
          playersCopy[target.idx] = { slatePlayerId: downgrade.slatePlayerId, slot }

        } else if (total < minSalary - 1000) {
          // UNDERSPEND: upgrade cheapest NON-stack player first
          const candidates_idx = playersCopy
            .map((p, idx) => ({ idx, p, salary: playerById[p.slatePlayerId]?.operatorSalary || 0, team: playerById[p.slatePlayerId]?.team }))
            .filter(x => {
              if (!currentStackTeam) return true
              if (x.team !== currentStackTeam) return true
              return countStackTeam() > 5
            })
            .sort((a, b) => a.salary - b.salary)

          if (candidates_idx.length === 0) break
          const target = candidates_idx[0]
          const slot = target.p.slot
          const currentPlayer = playerById[target.p.slatePlayerId]
          const maxAffordable = cap - total + target.salary

          const sameTeamConstraint = currentStackTeam && currentPlayer?.team === currentStackTeam
          const replacements = players.filter(p => {
            if (usedIds.has(p.slatePlayerId)) return false
            if (p.operatorPosition !== currentPlayer?.operatorPosition) return false
            if (sameTeamConstraint && p.team !== currentStackTeam) return false
            const sal = p.operatorSalary || 0
            return sal > target.salary && sal <= maxAffordable
          }).sort((a, b) => b.operatorSalary - a.operatorSalary)

          if (replacements.length === 0) break
          const upgrade = replacements[0]
          usedIds.delete(target.p.slatePlayerId)
          usedIds.add(upgrade.slatePlayerId)
          total = total - target.salary + upgrade.operatorSalary
          playersCopy[target.idx] = { slatePlayerId: upgrade.slatePlayerId, slot }

        } else {
          break
        }
      }

      console.log(`Salary fix: ${getTotal()} (was outside ${minSalary}-${cap}), ${attempts} attempts`)
      return { ...lu, players: playersCopy }
    }

    const validateLineup = (lu, debugLabel = '', currentStackTeam = null) => {
      if (!lu.players || lu.players.length !== slots.length) {
        console.log(`${debugLabel} REJECT: wrong player count`,
          lu.players?.length, 'expected', slots.length)
        return false
      }
      const ids = lu.players.map(p => p.slatePlayerId)
      if (new Set(ids).size !== ids.length) {
        console.log(`${debugLabel} REJECT: duplicate player IDs`, ids)
        return false
      }
      const missingIds = ids.filter(id => !playerById[id])
      if (missingIds.length > 0) {
        console.log(`${debugLabel} REJECT: unknown player IDs`, missingIds)
        return false
      }
      const gotSlots = lu.players.map(p => p.slot).sort()
      const wantSlots = [...slots].sort()
      if (gotSlots.length !== wantSlots.length) {
        console.log(`${debugLabel} REJECT: slot count mismatch`,
          gotSlots, 'vs', wantSlots)
        return false
      }
      const total = ids.reduce((sum, id) =>
        sum + (playerById[id]?.operatorSalary || 0), 0)
      if (total < minSalary - 2500 || total > cap) {
        console.log(`${debugLabel} REJECT: salary out of range`,
          total, 'needed', minSalary, '-', cap)
        return false
      }
      if (currentStackTeam) {
        const stackCount = lu.players.filter(p =>
          playerById[p.slatePlayerId]?.team === currentStackTeam
        ).length
        if (stackCount !== 5) {
          console.log(`${debugLabel} REJECT: stack count is ${stackCount}, expected exactly 5 from ${currentStackTeam}`)
          return false
        }
      }
      return true
    }

    const allValidLineups = []

    batchResults.forEach(({ strategy, result, team: currentStackTeam }) => {
      console.log(`=== Strategy "${strategy}" raw result ===`)
      console.log(JSON.stringify(result)?.slice(0, 800))

      if (!result?.lineups) {
        console.warn(`Strategy "${strategy}" returned no lineups (null or no .lineups field)`)
        return
      }

      const enriched = result.lineups.map(lu => ({
        ...lu,
        players: (lu.players || []).map(p => ({
          ...p,
          salary: playerById[p.slatePlayerId]?.operatorSalary || 0,
        }))
      }))

      const valid = enriched
        .map(lu => tryFixSalary(lu, currentStackTeam))
        .filter(lu => validateLineup(lu, `[${strategy}]`, currentStackTeam))
        .map(lu => ({
          ...lu,
          strategy: lu.strategy || strategy,
        }))

      allValidLineups.push(...valid)
    })

    if (allValidLineups.length === 0) {
      return NextResponse.json({
        success: false,
        error: `AI built lineups across ${batchResults.length} strategies but none passed validation. Try fewer lineups or relax filters.`
      }, { status: 422 })
    }

    const breakdown = {}
    allValidLineups.forEach(lu => {
      breakdown[lu.strategy] = (breakdown[lu.strategy] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      lineups: allValidLineups.slice(0, requested),
      generated: Math.min(allValidLineups.length, requested),
      requested,
      strategiesUsed: strategyAllocations.map(s => s.name),
      breakdown,
    })

  } catch (error) {
    console.error('AI optimize error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
