// Overall wall-clock budget for the whole request. Vercel's Hobby (free) plan
// hard-kills serverless functions at 60s — batching alone doesn't prevent
// that if enough sequential batches are needed (each batch is a dependent
// call, so they can't run in parallel). Leave margin for JSON parsing and
// response construction after the last Claude call returns.
const REQUEST_BUDGET_MS = 55000
// Per-call timeout. Kept well under the 45-50s a single call could otherwise
// be allowed to take, specifically so 2-3 sequential batches still fit inside
// REQUEST_BUDGET_MS instead of guaranteeing a platform-level timeout on any
// multi-batch request.
const CALL_TIMEOUT_MS = 25000

function extractLineupCount(message) {
  const patterns = [
    /(\d+)\s*gpp/i,
    /(\d+)\s*lineup/i,
    /(\d+)\s*team/i,
    /generate\s+(\d+)/i,
    /build\s+(\d+)/i,
    /give\s+me\s+(\d+)/i,
    /create\s+(\d+)/i,
    /make\s+(\d+)/i,
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) return parseInt(match[1])
  }
  return null
}

function detectContestTypes(message) {
  const lower = message.toLowerCase()
  const types = []
  if (lower.includes('cash') ||
      lower.includes('double') ||
      lower.includes('50/50') ||
      lower.includes('safe')) {
    types.push('cash')
  }
  if (lower.includes('gpp') ||
      lower.includes('tournament') ||
      lower.includes('ceiling') ||
      lower.includes('contrarian') ||
      !types.includes('cash')) {
    types.push('gpp')
  }
  return types
}

// `history` is optional — when provided (last few {role, content} turns) it's
// prepended so multi-turn context ("build 5 more without that RB") survives.
// Continuation batch calls intentionally omit it to stay lean.
async function callClaude(systemPrompt, userContent, maxTokens = 4000, history = []) {
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ]
  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
    }
  )
  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }
  const data = await response.json()
  return data.content[0]?.text || ''
}

function parseLineupsFromText(text) {
  const match = text.match(/<lineups>([\s\S]*?)<\/lineups>/)
  if (!match) return { lineups: [], message: text, sourcesUsed: [] }

  try {
    const parsed = JSON.parse(match[1].trim())
    const cleanMessage = text
      .replace(/<lineups>[\s\S]*?<\/lineups>/, '')
      .trim()
    return {
      lineups: parsed.lineups || [],
      message: cleanMessage,
      sourcesUsed: parsed.sources_used || [],
      portfolioSummary: parsed.portfolio_summary || ''
    }
  } catch (e) {
    console.error('Parse error:', e.message)
    return {
      lineups: [],
      message: text,
      sourcesUsed: []
    }
  }
}

function buildSystemPrompt(sport, platform, slots, cap, minSalary) {
  return `You are an elite DFS tournament analyst and
lineup builder specializing in GPP strategy.

SPORT: ${sport?.toUpperCase() || 'NFL'}
PLATFORM: ${platform || 'draftkings'}
SALARY CAP: $${cap?.toLocaleString()}
SALARY MIN: $${minSalary?.toLocaleString()}
LINEUP SLOTS: ${slots?.join(', ')}
PLAYERS PER LINEUP: ${slots?.length || 9}

CONTEST TYPES:
CASH (50/50, double-up, H2H):
- Maximize floor not ceiling
- Use chalk — ownership does not matter
- Avoid boom/bust players
- Highest projected safe plays only
- Label as contest_type: "cash"

GPP (Tournament):
- Maximize ceiling and leverage
- Use ownership differentiation
- Stack QB+pass catchers (NFL) or team (MLB)
- Include contrarian plays
- Each lineup must differ by 2+ players
- Label as contest_type: "gpp"

LINEUP FORMAT — always use this JSON block:
<lineups>
{
  "lineups": [
    {
      "lineup_number": 1,
      "contest_type": "gpp",
      "strategy": "CIN Stack",
      "reasoning": "One sentence why",
      "players": [
        {
          "slot": "QB",
          "name": "Joe Burrow",
          "team": "CIN",
          "position": "QB",
          "salary": 8200,
          "projected_points": 26.4,
          "ownership": 18.5
        }
      ],
      "total_salary": 49800,
      "projected_points": 142.5
    }
  ],
  "sources_used": ["Player Pool CSV"],
  "portfolio_summary": "Brief strategy note"
}
</lineups>

RULES:
- Only use players from the provided player pool
- Every lineup needs exactly ${slots?.length || 9} players
- Total salary must be $${minSalary?.toLocaleString()} to $${cap?.toLocaleString()}
- No duplicate players within a lineup
- Cite your sources in sources_used array`
}

export async function POST(request) {
  const requestStartedAt = Date.now()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const body = await request.json()
        const {
          message,
          messages: history,
          sources,
          sport,
          platform,
          slots,
          salaryCap,
        } = body

        const cap = salaryCap || 50000
        const minSalary = platform === 'fanduel' ? 59000 : 49500
        const slotCount = slots?.length || 9
        const recentHistory = (history || []).slice(-6)

        if (!process.env.ANTHROPIC_API_KEY) {
          send({ type: 'error', message: 'ANTHROPIC_API_KEY not configured.' })
          controller.close()
          return
        }

        // Build source context (truncated to avoid token overflow)
        let sourceContext = ''
        if (sources?.length > 0) {
          sourceContext = '=== YOUR DATA SOURCES ===\n\n'
          let totalChars = 0
          const maxContextChars = 30000

          for (const s of sources) {
            if (!s.content || totalChars >= maxContextChars) break
            const available = maxContextChars - totalChars
            const content = s.content.slice(0, available)
            sourceContext += `--- ${s.name} (${s.type}) ---\n`
            sourceContext += content + '\n\n'
            totalChars += content.length
          }
        }

        // Detect request type. Intent (does this even want lineups?) is decided
        // from clear keywords first — extractLineupCount's patterns include
        // generic ones like /(\d+)\s*team/i that would otherwise false-positive
        // on ordinary questions ("are there 5 teams playing early?") and route
        // them into the expensive multi-batch generation path below.
        const lower = message.toLowerCase()
        const wantsLineups = lower.includes('lineup') ||
          lower.includes('roster') ||
          lower.includes('generate') ||
          lower.includes('build') ||
          lower.includes('create') ||
          lower.includes('gpp') ||
          lower.includes('cash') ||
          lower.includes('picks')
        const requestedCount = wantsLineups ? extractLineupCount(message) : null
        const contestTypes = wantsLineups ? detectContestTypes(message) : []

        const systemPrompt = buildSystemPrompt(
          sport, platform, slots, cap, minSalary
        )

        // Non-lineup question: single fast call
        if (!wantsLineups) {
          send({ type: 'status', message: 'Thinking…' })

          const userContent = sourceContext
            ? `${sourceContext}\n\nUSER: ${message}`
            : message

          const responseText = await callClaude(
            systemPrompt, userContent, 2000, recentHistory
          )

          send({
            type: 'done',
            message: responseText,
            lineups: [],
            sources_used: []
          })
          controller.close()
          return
        }

        // Lineup generation: batch into groups of 5
        const BATCH_SIZE = 5
        let allLineups = []
        let analysisMessage = ''
        let sourcesUsed = []
        let stoppedForTime = false

        // Step 1: Get analysis + first batch
        const totalGpp = contestTypes.includes('gpp')
          ? (requestedCount || 5)
          : 0
        const totalCash = contestTypes.includes('cash') ? 1 : 0
        const totalRequested = totalGpp + totalCash

        const firstBatchSize = Math.min(BATCH_SIZE, totalRequested)
        const firstBatchParts = []
        if (totalCash > 0) firstBatchParts.push('1 cash lineup')
        if (totalGpp > 0) {
          const gppNow = Math.min(firstBatchSize - totalCash, totalGpp)
          firstBatchParts.push(`${gppNow} GPP lineup${gppNow > 1 ? 's' : ''}`)
        }
        const requestLine = firstBatchParts.join(' and ')

        const firstPrompt = `${sourceContext ? sourceContext + '\n\n' : ''}USER REQUEST: ${message}

Generate ${requestLine} now.
Keep each lineup to exactly ${slotCount} players.
Salary: $${minSalary.toLocaleString()} - $${cap.toLocaleString()}.

Return your analysis first, then the lineups JSON block.`

        console.log(`Generating batch 1: ${firstBatchSize} lineups`)
        send({ type: 'status', message: `Generating ${requestLine}…` })

        const firstResponse = await callClaude(
          systemPrompt, firstPrompt, 5000, recentHistory
        )
        const firstParsed = parseLineupsFromText(firstResponse)

        analysisMessage = firstParsed.message
        sourcesUsed = firstParsed.sourcesUsed

        const firstValid = validateAndCleanLineups(
          firstParsed.lineups, sources, slots, cap, minSalary
        )
        allLineups.push(...firstValid)

        console.log(`Batch 1: ${firstValid.length} valid lineups`)

        // Step 2: Generate remaining batches if needed
        const remaining = totalGpp - allLineups
          .filter(l => l.contest_type !== 'cash').length

        if (remaining > 0 && allLineups.length > 0) {
          const batches = Math.ceil(remaining / BATCH_SIZE)

          for (let b = 0; b < batches; b++) {
            // Don't start a batch we don't have time left to attempt — better to
            // return fewer lineups now than to blow past Vercel's hard timeout
            // and return none at all.
            if (Date.now() - requestStartedAt > REQUEST_BUDGET_MS - CALL_TIMEOUT_MS) {
              console.log(`Stopping batching — out of time budget (${allLineups.length}/${totalRequested} generated)`)
              send({ type: 'status', message: `Wrapping up — got ${allLineups.length} of ${totalRequested} so far…` })
              stoppedForTime = true
              break
            }

            const batchSize = Math.min(
              BATCH_SIZE,
              remaining - b * BATCH_SIZE
            )
            if (batchSize <= 0) break

            const existingNames = allLineups
              .map(lu => lu.players?.map(p => p.name).join(','))
              .join(' | ')

            const batchPrompt = `Generate ${batchSize} more unique GPP lineups.
These lineups must differ from previous ones:
${existingNames}

Salary: $${minSalary.toLocaleString()} - $${cap.toLocaleString()}
Slots: ${slots?.join(', ')}
Each lineup: exactly ${slotCount} players.

Return ONLY the <lineups> JSON block, no explanation needed.`

            console.log(`Generating batch ${b + 2}: ${batchSize} lineups`)
            send({ type: 'status', message: `Generating ${batchSize} more lineup${batchSize > 1 ? 's' : ''} (${allLineups.length}/${totalRequested} so far)…` })

            try {
              const batchResponse = await callClaude(
                systemPrompt, batchPrompt, 4000
              )
              const batchParsed = parseLineupsFromText(batchResponse)
              const batchValid = validateAndCleanLineups(
                batchParsed.lineups, sources, slots, cap, minSalary
              )
              allLineups.push(...batchValid)
              console.log(`Batch ${b + 2}: ${batchValid.length} valid`)
            } catch (batchErr) {
              console.error(`Batch ${b + 2} failed:`, batchErr.message)
              break // stop batching on timeout, return what we have
            }
          }
        }

        // Re-number all lineups
        allLineups = allLineups.map((lu, i) => ({
          ...lu,
          lineup_number: i + 1
        }))

        let successMsg
        if (allLineups.length > 0) {
          successMsg = analysisMessage ||
            `Generated ${allLineups.length} lineup${allLineups.length > 1 ? 's' : ''}.`
          if (stoppedForTime && allLineups.length < totalRequested) {
            successMsg += ` (Stopped early to stay within the response time limit — got ${allLineups.length} of ${totalRequested} requested. Ask again to generate more.)`
          }
        } else {
          successMsg = analysisMessage ||
            'I analyzed your sources but could not generate valid lineups. Try uploading a player pool CSV with salary and projection data.'
        }

        send({
          type: 'done',
          message: successMsg,
          lineups: allLineups,
          sources_used: sourcesUsed,
          generated: allLineups.length,
          requested: totalRequested
        })
        controller.close()

      } catch (error) {
        console.error('Chat lineup error:', error)

        if (error.name === 'TimeoutError' ||
            error.name === 'AbortError' ||
            error.message?.includes('timeout')) {
          send({ type: 'error', message: 'The request took too long. Try asking for fewer lineups at once (5 or fewer work best).' })
        } else {
          send({ type: 'error', message: `Something went wrong: ${error.message}` })
        }
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    }
  })
}

// Parse the compact "  Name (TEAM vs OPP) $salary Proj:x Own:y%" lines that
// buildPlayerPoolContext (app/dashboard/chat/page.js) produces, keyed by a
// normalized name so lookups tolerate case/whitespace differences between
// what Claude echoes back and what the CSV actually said.
function parsePlayerPoolFromContext(content) {
  const pool = {}
  const lines = content.split('\n')
  lines.forEach(line => {
    const nameMatch = line.match(/^  (.+?) \(/)
    const salaryMatch = line.match(/\$([0-9,]+)/)
    if (nameMatch && salaryMatch) {
      const name = nameMatch[1].trim()
      const salary = parseInt(salaryMatch[1].replace(/,/g, ''))
      pool[normalizeName(name)] = { name, salary }
    }
  })
  return pool
}

const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ')

// Validate and clean lineups from Claude
function validateAndCleanLineups(
  lineups, sources, slots, cap, minSalary
) {
  // Build player lookup from CSV source if available
  let playerPool = {}
  const csvSource = sources?.find(s => s.type === 'csv')

  if (csvSource?.content) {
    try {
      playerPool = parsePlayerPoolFromContext(csvSource.content)
    } catch (e) {
      console.log('Could not parse player pool for validation')
    }
  }
  const havePlayerPool = Object.keys(playerPool).length > 0

  return lineups
    .filter(lu => {
      if (!lu.players || lu.players.length !== slots.length) {
        console.log(`Lineup ${lu.lineup_number}: wrong player count`)
        return false
      }

      // Ground each player against the real player pool when we have one —
      // otherwise nothing stops Claude from hallucinating a player, or
      // reporting a salary that doesn't match what the CSV actually said,
      // and this function would only ever be checking Claude's own numbers
      // for self-consistency rather than validating them against real data.
      if (havePlayerPool) {
        const allMatch = lu.players.every(p => {
          const real = playerPool[normalizeName(p.name)]
          if (!real) {
            console.log(`Lineup ${lu.lineup_number}: "${p.name}" not found in player pool`)
            return false
          }
          // Trust the pool's salary over whatever Claude reported
          p.salary = real.salary
          return true
        })
        if (!allMatch) return false
      }

      // Check salary
      const total = lu.players.reduce(
        (sum, p) => sum + (p.salary || 0), 0
      )
      if (total > cap || total < minSalary - 2000) {
        console.log(`Lineup ${lu.lineup_number}: salary ${total} out of range`)
        return false
      }

      // Check no duplicates
      const names = lu.players.map(p => p.name)
      if (new Set(names).size !== names.length) {
        console.log(`Lineup ${lu.lineup_number}: duplicate players`)
        return false
      }

      return true
    })
    .map((lu, i) => ({
      ...lu,
      lineup_number: i + 1,
      total_salary: lu.players.reduce(
        (sum, p) => sum + (p.salary || 0), 0
      ),
      projected_points: lu.players.reduce(
        (sum, p) => sum + (p.projected_points || 0), 0
      )
    }))
}
