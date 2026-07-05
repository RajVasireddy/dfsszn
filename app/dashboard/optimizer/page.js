'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Optimizer() {
    const [sport, setSport] = useState('mlb')
    const [platform, setPlatform] = useState('draftkings')
    const [slates, setSlates] = useState([])
    const [selectedSlate, setSelectedSlate] = useState(null)
    const [players, setPlayers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [posFilter, setPosFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('OperatorSalary')
    const [sortDir, setSortDir] = useState('desc')
    const [lineups, setLineups] = useState([[]])
    const [activeLineup, setActiveLineup] = useState(0)
    const [lineupCount, setLineupCount] = useState(1)
    const [showLineupCount, setShowLineupCount] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [gameFilter, setGameFilter] = useState(null)
    const [stackTeam, setStackTeam] = useState(null)
    const [fillPool, setFillPool] = useState([])
    const [showGameFilters, setShowGameFilters] = useState(false)
    const [gameFiltersTab, setGameFiltersTab] = useState('rules')
    const [slateSource, setSlateSource] = useState('live')
    const [manualPlayers, setManualPlayers] = useState([])
    const [manualSlateInfo, setManualSlateInfo] = useState(null)
    const [showSlateUpload, setShowSlateUpload] = useState(false)
    const [stackRules, setStackRules] = useState({
        minFromSameTeam: 0,
        maxFromSameTeam: 5,
        lockedPlayers: [],
        excludedPlayers: [],
    })
    const [uniquePlayersPerLineup, setUniquePlayersPerLineup] = useState(1)
    const [teamSalaryMin, setTeamSalaryMin] = useState('49500')
    const [teamSalaryMax, setTeamSalaryMax] = useState('50000')
    const [hittersVsPitcher, setHittersVsPitcher] = useState(0)
    const [playersPerTeamMax, setPlayersPerTeamMax] = useState(5)
    const [playersPerGameMax, setPlayersPerGameMax] = useState(8)
    const [slateOpen, setSlateOpen] = useState(false)
    const [gameTilesOpen, setGameTilesOpen] = useState(false)
    const [playerTab, setPlayerTab] = useState('all')
    const [likedPlayers, setLikedPlayers] = useState([])
    const [customProjections, setCustomProjections] = useState({})
    const [customOwnership, setCustomOwnership] = useState({})
    const [importedProjections, setImportedProjections] = useState({})
    const [importStatus, setImportStatus] = useState(null)
    const [showImport, setShowImport] = useState(false)
    const [dkEntriesCSV, setDkEntriesCSV] = useState(null)
    const [dkEntries, setDkEntries] = useState([])
    const [dkPlayerPool, setDkPlayerPool] = useState([])
    const [showDKUpload, setShowDKUpload] = useState(false)
    const [dkMatchStatus, setDkMatchStatus] = useState(null)
    const [stackExposures, setStackExposures] = useState({})
    const [appendCount, setAppendCount] = useState(5)
    const [appending, setAppending] = useState(false)
    const [isFirstMount, setIsFirstMount] = useState(true)
    const [selectedLineupIndices, setSelectedLineupIndices] = useState(new Set())
    const [sentToMyLineups, setSentToMyLineups] = useState(false)
    const [stackFilter, setStackFilter] = useState(null)
    const [aiAnalysis, setAiAnalysis] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [showAiPanel, setShowAiPanel] = useState(false)
    const [aiBuilding, setAiBuilding] = useState(false)
    const [showAiCountModal, setShowAiCountModal] = useState(false)
    const [aiLineupCountInput, setAiLineupCountInput] = useState(30)
    const [lineupReasonings, setLineupReasonings] = useState([])
    const [slateNotes, setSlateNotes] = useState('')
    const [showSlateNotes, setShowSlateNotes] = useState(false)
    const [notesSaved, setNotesSaved] = useState(false)

    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date()
        const ET = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        return ET.toISOString().split('T')[0]
    })

    const SALARY_CAP = {
        mlb: { draftkings: 50000, fanduel: 35000 },
        nba: { draftkings: 50000, fanduel: 60000 },
        nfl: { draftkings: 50000, fanduel: 60000 },
    }

    const POSITIONS = {
        mlb: ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
        nba: ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'],
        nfl: ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'],
    }

    const LINEUP_SLOTS = {
        mlb: {
            draftkings: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'],
            fanduel: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF'],
        },
        nba: {
            draftkings: ['PG', 'SG', 'SF', 'PF', 'C', 'FLEX', 'FLEX', 'FLEX'],
            fanduel: ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C'],
        },
        nfl: {
            draftkings: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'],
            fanduel: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'],
        },
    }

    const cap = SALARY_CAP[sport][platform]
    const slots = LINEUP_SLOTS[sport][platform]
    const lineup = lineups[activeLineup] || new Array(slots.length).fill(null)
    const setLineup = (newLineup) => {
        const updated = [...lineups]
        updated[activeLineup] = newLineup
        setLineups(updated)
    }
    const isMultiLineup = lineups.filter(l => l && l.some(p => p !== null)).length > 1
    const getProjection = (player) => {
        if (!player) return 0
        const custom = customProjections[player.SlatePlayerID]
        if (custom !== undefined && !importedProjections[player.SlatePlayerID]) {
            return parseFloat(custom) || 0
        }
        const imported = importedProjections[player.SlatePlayerID]
        if (imported) return imported.projectedPoints || 0
        return player.ProjectedPoints || 0
    }
    const getOwnership = (player) => {
        if (!player) return 0
        const imported = importedProjections[player.SlatePlayerID]
        if (imported) return imported.ownershipProjection || 0
        return player.OwnershipProjection || 0
    }
    const getEffectiveOwnership = (player) => {
        if (!player) return 0
        const custom = customOwnership[player.SlatePlayerID]
        if (custom !== undefined && custom !== '') return parseFloat(custom) || 0
        return getOwnership(player)
    }
    const getPlayerExposure = (player) => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))
        if (validLineups.length === 0) return null
        const count = validLineups.filter(lu =>
            lu.some(p => p?.SlatePlayerID === player.SlatePlayerID)
        ).length
        return { count, total: validLineups.length, pct: Math.round((count / validLineups.length) * 100) }
    }

    const getValueScore = (player) => {
        const pts = getProjection(player)
        const salary = player.OperatorSalary || 1
        if (!pts || !salary) return '—'
        return (pts / salary * 1000).toFixed(2)
    }

    const getValueColor = (value) => {
        if (value === '—') return '#8A9BBE'
        if (value >= 3.5) return '#22C55E'
        if (value >= 2.5) return '#FFB800'
        return '#8A9BBE'
    }

    const usedSalary = lineup.reduce((sum, p) => sum + (p?.OperatorSalary || 0), 0)
    const projectedPoints = lineup.reduce((sum, p) => sum + (p ? getProjection(p) : 0), 0)
    const remainingSalary = cap - usedSalary
    const valueScore = usedSalary > 0 ? (projectedPoints / usedSalary * 1000).toFixed(1) : '0.0'

    // Restore state on first mount only
    useEffect(() => {
        const wasRestored = restoreStateFromSession()
        if (!wasRestored) {
            fetchSlates()
        }
    }, [])

    // Fetch new slates when sport/platform/date changes, but not on first mount
    useEffect(() => {
        if (isFirstMount) {
            setIsFirstMount(false)
            return
        }
        if (slateSource === 'live') {
            fetchSlates()
        }
    }, [sport, platform, selectedDate, slateSource])

    // Auto-save whenever important state changes
    useEffect(() => {
        if (players.length > 0 || lineups.some(l => l?.some(p => p))) {
            saveStateToSession()
        }
    }, [
        lineups,
        stackTeam,
        stackRules,
        fillPool,
        teamSalaryMin,
        teamSalaryMax,
        customProjections,
        importedProjections,
        sport,
        platform,
        selectedDate,
        slateSource,
        posFilter,
        stackExposures,
    ])

    const fetchSlates = async () => {
        setLoading(true)
        setError(null)
        setPlayers([])
        setSelectedSlate(null)

        // Reset lineups when sport/platform/date changes
        setLineups([new Array(slots.length).fill(null)])
        setActiveLineup(0)

        try {
            const res = await fetch(
                `/api/slates/${sport}?platform=${platform}&date=${selectedDate}`,
                { signal: AbortSignal.timeout(10000) } // 10 second timeout
            )
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()

            if (data.success && data.slates?.length > 0) {
                const firstSlate = data.slates[0]
                const playerArray = firstSlate.players || []
                setSlates(data.slates)
                setSelectedSlate(firstSlate)
                setPlayers(playerArray)
            } else {
                setError('No slates available for today. Check back later.')
            }
        } catch (err) {
            console.error('Fetch error:', err)
            setError('Failed to load slates. Please try again.')
        }
        setLoading(false)
    }
    const selectSlate = (slate) => {
        setSelectedSlate(slate)
        setPlayers(slate.players || [])
        setLineup([])
    }

    const formatGameTime = (dateStr) => {
        if (!dateStr) return ''
        try {
            return new Date(dateStr).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York'
            }) + ' ET'
        } catch { return '' }
    }

    const ouDotColor = (ou) => {
        if (ou == null) return '#8A9BBE'
        if (ou > 8) return '#22C55E'
        if (ou >= 5) return '#FFB800'
        return '#EF4444'
    }

    const getConfirmedStarters = () => {
        if (!selectedSlate?.DfsSlateGames) return new Set()
        const starterIDs = new Set()
        selectedSlate.DfsSlateGames.forEach(sg => {
            if (sg.Game?.AwayTeamProbablePitcherID) starterIDs.add(sg.Game.AwayTeamProbablePitcherID)
            if (sg.Game?.HomeTeamProbablePitcherID) starterIDs.add(sg.Game.HomeTeamProbablePitcherID)
        })
        return starterIDs
    }
    const confirmedStarters = getConfirmedStarters()
    const isConfirmedStarter = (player) => {
        if (slateSource === 'manual') return player.IsStartingPitcher === true
        return confirmedStarters.has(player.PlayerID)
    }

    // Filter and sort — uses correct SportsDataIO field names
    const filteredPlayers = players
        .filter(p => !gameFilter || p.SlateGameID === gameFilter)
        .filter(p => {
            if (playerTab === 'excluded') return stackRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)
            if (playerTab === 'liked') return likedPlayers.find(lp => lp.SlatePlayerID === p.SlatePlayerID)
            if (stackRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)) return false
            return true
        })
        .filter(p => {
            if (p.OperatorPosition === 'SP' || p.OperatorPosition === 'RP') return isConfirmedStarter(p)
            return true
        })
        .filter(p => {
            if (posFilter === 'ALL') return true
            if (posFilter === 'P') {
                return p.OperatorPosition === 'SP' ||
                    p.OperatorPosition === 'RP' ||
                    p.OperatorPosition === 'P' ||
                    (p.OperatorRosterSlots || []).includes('P')
            }
            if (p.OperatorPosition?.includes('/')) {
                return p.OperatorPosition.split('/').includes(posFilter)
            }
            return p.OperatorPosition === posFilter
        })

        .filter(p => p.OperatorPlayerName?.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const aStarter = isConfirmedStarter(a) ? 1 : 0
            const bStarter = isConfirmedStarter(b) ? 1 : 0
            if (bStarter !== aStarter) return bStarter - aStarter
            const aVal = a[sortBy] || 0
            const bVal = b[sortBy] || 0
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal
        })

    const handleSort = (col) => {
        if (sortBy === col) {
            setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
        } else {
            setSortBy(col)
            setSortDir('desc')
        }
    }

    const addPlayer = (player) => {
        if (lineup.filter(p => p !== null).length >= slots.length) return
        if (lineup.find(p => p?.SlatePlayerID === player.SlatePlayerID)) return

        const playerPos = player.OperatorPosition || ''
        const rosterSlots = player.OperatorRosterSlots || []

        // Find first empty matching slot
        const slotIndex = slots.findIndex((slot, i) => {
            if (lineup[i]) return false

            // P slot accepts SP, RP, and P
            if (slot === 'P') {
                return playerPos === 'SP' ||
                    playerPos === 'RP' ||
                    playerPos === 'P' ||
                    rosterSlots.includes('P')
            }

            // FLEX slot for NFL accepts RB, WR, TE
            if (slot === 'FLEX') {
                return ['RB', 'WR', 'TE'].includes(playerPos)
            }

            // FLEX slot for NBA accepts any position
            if (slot === 'FLEX' && sport === 'nba') {
                return true
            }

            // Multi-position players like "2B/3B" or "1B/OF"
            if (playerPos.includes('/')) {
                return playerPos.split('/').includes(slot)
            }

            // Check OperatorRosterSlots array
            if (rosterSlots.includes(slot)) return true

            // Direct position match
            return playerPos === slot
        })

        if (slotIndex === -1) {
            setError(`No valid slot for ${player.OperatorPlayerName} (${player.OperatorPosition})`)
            setTimeout(() => setError(null), 2500)
            return
        }

        if (usedSalary + player.OperatorSalary > cap) {
            setError('Not enough salary cap remaining')
            setTimeout(() => setError(null), 2500)
            return
        }

        const newLineup = [...lineup]
        newLineup[slotIndex] = player
        setLineup(newLineup)
    }

    const removePlayer = (index) => {
        const newLineup = [...lineup]
        newLineup[index] = null
        setLineup(newLineup)
    }

    const exportAllCSV = () => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))
        if (validLineups.length === 0) return

        if (platform === 'draftkings') {
            const headers = slots.join(',')
            const rows = validLineups.map(lu =>
                slots.map((slot, i) => {
                    const player = lu[i]
                    if (!player) return ''
                    return `${player.OperatorPlayerName} (${player.OperatorPlayerID || player.SlatePlayerID})`
                }).join(',')
            )
            downloadCSV([headers, ...rows].join('\n'), `DFSSZN_DK_${sport.toUpperCase()}_${validLineups.length}lineups.csv`)
        }

        if (platform === 'fanduel') {
            const headers = slots.join(',')
            const rows = validLineups.map(lu =>
                slots.map((slot, i) => {
                    const player = lu[i]
                    if (!player) return ''
                    return `${player.OperatorPlayerName}:${player.OperatorPlayerID || player.SlatePlayerID}`
                }).join(',')
            )
            downloadCSV([headers, ...rows].join('\n'), `DFSSZN_FD_${sport.toUpperCase()}_${validLineups.length}lineups.csv`)
        }
    }

    const parseDKEntriesCSV = (csvText) => {
        const lines = csvText.split('\n')
        const entries = []
        const playerPool = []

        lines.forEach((line, i) => {
            if (i === 0) return
            const cols = line.split(',')

            const entryId = cols[0]?.trim()
            if (entryId && entryId.length > 0 && !isNaN(entryId)) {
                entries.push({
                    entryId,
                    contestName: cols[1]?.trim(),
                    contestId: cols[2]?.trim(),
                    entryFee: cols[3]?.trim(),
                    players: cols.slice(4, 14).map(p => p?.trim() || '')
                })
            }

            const playerName = cols[16]?.trim()
            const playerId = cols[17]?.trim()
            const position = cols[15]?.trim()
            const salary = cols[19]?.trim()
            const team = cols[21]?.trim()

            if (playerName && playerId && !isNaN(playerId)) {
                const teamAbbrev = cols[21]?.trim() || ''
                playerPool.push({
                    name: playerName,
                    id: playerId,
                    nameWithId: `${playerName} (${playerId})`,
                    position: position,
                    salary: parseInt(salary) || 0,
                    team: teamAbbrev
                })
            }
        })

        return { entries, playerPool }
    }

    const handleDKEntriesUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const csvText = event.target.result
            const { entries, playerPool } = parseDKEntriesCSV(csvText)

            setDkEntriesCSV(csvText)
            setDkEntries(entries)
            setDkPlayerPool(playerPool)
            setShowDKUpload(false)

            console.log(`DK CSV loaded: ${entries.length} entries, ${playerPool.length} players in pool`)
            setDkMatchStatus({ entries: entries.length, players: playerPool.length })
            console.log('DK Player pool sample:')
            playerPool.slice(0, 5).forEach(p =>
                console.log(`  ${p.name} | team: ${p.team} | id: ${p.id}`)
            )
        }
        reader.readAsText(file)
    }

    const matchPlayerToDK = (player) => {
        if (!player || dkPlayerPool.length === 0) return ''

        const name = (player.OperatorPlayerName || '').trim()
        const team = (player.Team || '').trim().toUpperCase()

        const normalizeName = (n) => n
            .toLowerCase()
            .replace(/[^a-z ]/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        const normalizedSearch = normalizeName(name)
        const searchParts = normalizedSearch.split(' ')
        const searchLastName = searchParts[searchParts.length - 1]
        const searchFirstInitial = searchParts[0]?.[0] || ''

        const scored = dkPlayerPool.map(dk => {
            const dkNorm = normalizeName(dk.name)
            const dkParts = dkNorm.split(' ')
            const dkLastName = dkParts[dkParts.length - 1]
            const dkFirstInitial = dkParts[0]?.[0] || ''
            const dkTeam = (dk.team || '').toUpperCase()

            let score = 0
            if (dkNorm === normalizedSearch) score += 100
            if (dkLastName === searchLastName) score += 40
            if (dkFirstInitial === searchFirstInitial) score += 20
            if (dkTeam === team) score += 30
            if (dkNorm.includes(searchLastName) || normalizedSearch.includes(dkLastName)) score += 10
            if (dkNorm.startsWith(searchParts[0])) score += 10

            return { dk, score }
        })

        scored.sort((a, b) => b.score - a.score)
        const best = scored[0]

        if (best && best.score >= 40) {
            return best.dk.nameWithId
        }

        const lastNameOnly = dkPlayerPool.find(dk => {
            const dkNorm = normalizeName(dk.name)
            const dkLastName = dkNorm.split(' ').pop()
            return dkLastName === searchLastName
        })

        if (lastNameOnly) {
            console.warn(`Weak match: ${name} → ${lastNameOnly.name} (no team match)`)
            return lastNameOnly.nameWithId
        }

        console.warn(`No match found for: ${name} (${team})`)
        return `${name} (NOT FOUND)`
    }

    const debugPlayerMatch = () => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))

        const allPlayers = [...new Set(
            validLineups.flatMap(lu => lu.filter(Boolean))
                .map(p => p.OperatorPlayerName)
        )]

        console.log('=== MATCH DEBUG ===')
        allPlayers.forEach(name => {
            const player = players.find(p => p.OperatorPlayerName === name)
            if (!player) return
            const result = matchPlayerToDK(player)
            console.log(`${name} (${player.Team}) → ${result}`)
        })

        const dkTeams = [...new Set(dkPlayerPool.map(p => p.team))]
        console.log('DK Pool Teams:', dkTeams)

        const ourTeams = [...new Set(players.map(p => p.Team))]
        console.log('Our Teams:', ourTeams)
    }

    const exportDKEntriesCSV = () => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))

        if (validLineups.length === 0) {
            setError('No lineups to export')
            setTimeout(() => setError(null), 2500)
            return
        }

        if (dkEntries.length === 0) {
            setError('Please upload your DKEntries.csv first')
            setTimeout(() => setError(null), 2500)
            return
        }

        const updatedEntries = dkEntries.map((entry, i) => {
            const lu = validLineups[i]
            if (!lu) return entry

            const playerStrings = slots.map((slot, slotIndex) => {
                const player = lu[slotIndex]
                return matchPlayerToDK(player)
            })

            return { ...entry, players: playerStrings }
        })

        const originalLines = dkEntriesCSV.split('\n')
        const newLines = originalLines.map((line, i) => {
            if (i === 0) return line

            const cols = line.split(',')
            const entryId = cols[0]?.trim()

            if (entryId && !isNaN(entryId) && entryId.length > 0) {
                const entryIndex = dkEntries.findIndex(e => e.entryId === entryId)
                if (entryIndex !== -1 && updatedEntries[entryIndex]) {
                    const updated = updatedEntries[entryIndex]
                    const newCols = [...cols]
                    updated.players.forEach((player, pi) => {
                        newCols[4 + pi] = player
                    })
                    return newCols.join(',')
                }
            }
            return line
        })

        downloadCSV(newLines.join('\n'), 'DKEntries_Updated.csv')

        const unmatched = validLineups.flatMap(lu =>
            (lu || []).filter(p => p && matchPlayerToDK(p).includes('NOT FOUND'))
                .map(p => p.OperatorPlayerName)
        )

        setDkMatchStatus(prev => ({
            ...prev,
            exported: validLineups.length,
            unmatched: [...new Set(unmatched)]
        }))
    }

    const downloadCSV = (csv, filename) => {
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const saveLineup = async () => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))

        if (validLineups.length === 0) {
            setError('No lineups to save')
            setTimeout(() => setError(null), 2500)
            return
        }

        setSaving(true)

        try {
            const { createClient } = await import('@/lib/supabase')
            const supabase = createClient()

            const { data: { user }, error: authError } = await supabase.auth.getUser()

            if (authError) {
                console.error('Auth error:', authError)
                setError('Please log in to save lineups')
                setTimeout(() => setError(null), 3000)
                setSaving(false)
                return
            }

            if (!user) {
                setError('Please log in to save lineups')
                setTimeout(() => setError(null), 3000)
                setSaving(false)
                return
            }

            const lineupsToSave = validLineups.map((lu, i) => ({
                user_id: user.id,
                name: `${sport.toUpperCase()} ${platform === 'draftkings' ? 'DK' : 'FD'} - ${new Date().toLocaleDateString()} #${i + 1}`,
                sport,
                platform,
                players: lu.filter(p => p !== null),
                total_salary: lu.reduce((sum, p) => sum + (p?.OperatorSalary || 0), 0),
                projected_points: lu.reduce((sum, p) => sum + (p ? getProjection(p) : 0), 0),
            }))

            const { error: saveError } = await supabase
                .from('lineups')
                .insert(lineupsToSave)

            if (saveError) {
                console.error('Save error details:', saveError)
                setError(`Save failed: ${saveError.message || saveError.code || 'Unknown error'}`)
                setTimeout(() => setError(null), 4000)
                setSaving(false)
                return
            }

            setSaveSuccess(true)
            setError(null)
            setTimeout(() => setSaveSuccess(false), 3000)

        } catch (err) {
            console.error('Save failed:', err)
            setError(`Save failed: ${err.message || 'Unknown error'}`)
            setTimeout(() => setError(null), 4000)
        }

        setSaving(false)
    }

    const getValue = (player) => {
        if (!player.OperatorSalary || !player.ProjectedPoints) return '—'
        return ((player.ProjectedPoints / player.OperatorSalary) * 1000).toFixed(2)
    }

    const getInitials = (name) => {
        if (!name) return '??'
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    }

    const posBadgeStyle = (pos) => {
        const colors = {
            P: 'rgba(255,184,0,0.15)',
            SP: 'rgba(255,184,0,0.15)',
            RP: 'rgba(255,184,0,0.1)',
            C: 'rgba(139,92,246,0.15)',
            '1B': 'rgba(99,102,241,0.15)',
            '2B': 'rgba(236,72,153,0.15)',
            '3B': 'rgba(251,146,60,0.15)',
            SS: 'rgba(20,184,166,0.15)',
            OF: 'rgba(34,197,94,0.15)',
            PG: 'rgba(255,184,0,0.15)',
            SG: 'rgba(99,102,241,0.15)',
            SF: 'rgba(34,197,94,0.15)',
            PF: 'rgba(236,72,153,0.15)',
            QB: 'rgba(255,184,0,0.15)',
            RB: 'rgba(34,197,94,0.15)',
            WR: 'rgba(99,102,241,0.15)',
            TE: 'rgba(251,146,60,0.15)',
            K: 'rgba(139,92,246,0.15)',
            DST: 'rgba(20,184,166,0.15)',
        }
        return colors[pos] || 'rgba(138,155,190,0.15)'
    }
    const posTextColor = (pos) => {
        const colors = {
            P: '#FFB800',
            SP: '#FFB800',
            RP: '#FFB800',
            C: '#A78BFA',
            '1B': '#818CF8',
            '2B': '#F472B6',
            '3B': '#FB923C',
            SS: '#2DD4BF',
            OF: '#22C55E',
            PG: '#FFB800',
            SG: '#818CF8',
            SF: '#22C55E',
            PF: '#F472B6',
            QB: '#FFB800',
            RB: '#22C55E',
            WR: '#818CF8',
            TE: '#FB923C',
            K: '#A78BFA',
            DST: '#2DD4BF',
        }
        return colors[pos] || '#8A9BBE'
    }

    const generateLineup = () => {
        const newLineup = new Array(slots.length).fill(null)
        const usedPlayerIDs = new Set()
        const excludedIDs = new Set(stackRules.excludedPlayers.map(p => p.SlatePlayerID))

        // Step 1 — Place locked players first
        stackRules.lockedPlayers.forEach(lockedPlayer => {
            const slotIndex = slots.findIndex((slot, i) => {
                if (newLineup[i]) return false
                const pos = lockedPlayer.OperatorPosition || ''
                const rosterSlots = lockedPlayer.OperatorRosterSlots || []
                if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos)
                if (pos.includes('/')) return pos.split('/').includes(slot)
                if (rosterSlots.includes(slot)) return true
                return pos === slot
            })
            if (slotIndex !== -1) {
                newLineup[slotIndex] = lockedPlayer
                usedPlayerIDs.add(lockedPlayer.SlatePlayerID)
            }
        })

        // Step 2 — Collect remaining empty slots
        const emptySlots = slots.reduce((acc, slot, i) => {
            if (!newLineup[i]) acc.push({ slot, index: i })
            return acc
        }, [])

        // Step 3 — Salary-aware fill: reserve $2000 per remaining slot
        const lockedSalary = stackRules.lockedPlayers.reduce((sum, p) => sum + (p.OperatorSalary || 0), 0)
        let remainingSalary = cap - lockedSalary

        emptySlots.forEach(({ slot, index }, i) => {
            const slotsLeft = emptySlots.length - i
            const maxCanSpend = remainingSalary - 2000 * (slotsLeft - 1)

            const eligible = players
                .filter(p => {
                    if (usedPlayerIDs.has(p.SlatePlayerID)) return false
                    if (excludedIDs.has(p.SlatePlayerID)) return false
                    if (!p.OperatorSalary || p.OperatorSalary > maxCanSpend) return false
                    const pos = p.OperatorPosition || ''
                    const rosterSlots = p.OperatorRosterSlots || []
                    if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                    if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos)
                    if (pos.includes('/')) return pos.split('/').includes(slot)
                    if (rosterSlots.includes(slot)) return true
                    return pos === slot
                })
                .sort((a, b) => {
                    const aVal = (a.ProjectedPoints || 0) / (a.OperatorSalary || 1)
                    const bVal = (b.ProjectedPoints || 0) / (b.OperatorSalary || 1)
                    return bVal - aVal
                })

            if (eligible.length > 0) {
                const pick = eligible[0]
                newLineup[index] = pick
                remainingSalary -= pick.OperatorSalary
                usedPlayerIDs.add(pick.SlatePlayerID)
            }
        })

        const filledCount = newLineup.filter(p => p !== null).length
        if (filledCount < slots.length) {
            setError('Could not fill all slots. Try adjusting your rules or excluded players.')
            setTimeout(() => setError(null), 3000)
        }

        setLineup(newLineup)
    }

    const generateRandomLineup = () => {
        const newLineup = new Array(slots.length).fill(null)
        const usedPlayerIDs = new Set()
        const excludedIDs = new Set(stackRules.excludedPlayers.map(p => p.SlatePlayerID))

        // Place locked players first
        stackRules.lockedPlayers.forEach(lockedPlayer => {
            const slotIndex = slots.findIndex((slot, i) => {
                if (newLineup[i]) return false
                const pos = lockedPlayer.OperatorPosition || ''
                const rosterSlots = lockedPlayer.OperatorRosterSlots || []
                if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos)
                if (pos.includes('/')) return pos.split('/').includes(slot)
                if (rosterSlots.includes(slot)) return true
                return pos === slot
            })
            if (slotIndex !== -1) {
                newLineup[slotIndex] = lockedPlayer
                usedPlayerIDs.add(lockedPlayer.SlatePlayerID)
            }
        })

        const emptySlots = slots.reduce((acc, slot, i) => {
            if (!newLineup[i]) acc.push({ slot, index: i })
            return acc
        }, [])

        const lockedSalary = stackRules.lockedPlayers.reduce((sum, p) => sum + (p.OperatorSalary || 0), 0)
        let remainingSalary = cap - lockedSalary

        emptySlots.forEach(({ slot, index }, i) => {
            const slotsLeft = emptySlots.length - i
            const maxCanSpend = remainingSalary - 2000 * (slotsLeft - 1)

            const eligible = players
                .filter(p => {
                    if (usedPlayerIDs.has(p.SlatePlayerID)) return false
                    if (excludedIDs.has(p.SlatePlayerID)) return false
                    if (!p.OperatorSalary || p.OperatorSalary > maxCanSpend) return false
                    const pos = p.OperatorPosition || ''
                    const rosterSlots = p.OperatorRosterSlots || []
                    if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                    if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos)
                    if (pos.includes('/')) return pos.split('/').includes(slot)
                    if (rosterSlots.includes(slot)) return true
                    return pos === slot
                })
                .sort((a, b) => {
                    const aVal = (a.ProjectedPoints || 0) / (a.OperatorSalary || 1)
                    const bVal = (b.ProjectedPoints || 0) / (b.OperatorSalary || 1)
                    return bVal - aVal
                })
                .slice(0, 8)

            if (eligible.length > 0) {
                const pick = eligible[Math.floor(Math.random() * eligible.length)]
                newLineup[index] = pick
                remainingSalary -= pick.OperatorSalary
                usedPlayerIDs.add(pick.SlatePlayerID)
            }
        })

        setLineup(newLineup)
    }

    const groupedSlates = slates.reduce((acc, slate) => {
        const type = slate.NumberOfGames <= 2 ? 'Showdown' : 'Classic'
        if (!acc[type]) acc[type] = []
        acc[type].push(slate)
        return acc
    }, {})

    const generateAllLineups = async () => {
        if (eligiblePool.length === 0) {
            setError('No players available to generate lineups.')
            setTimeout(() => setError(null), 3000)
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Build stack distribution from exposures
            const stackDistribution = []
            Object.entries(stackExposures).forEach(([team, pct]) => {
                const count = getLineupCountForTeam(team)
                for (let i = 0; i < count; i++) {
                    stackDistribution.push(team)
                }
            })
            while (stackDistribution.length < lineupCount) {
                stackDistribution.push(stackTeam || null)
            }
            console.log('Stack distribution:', stackDistribution.reduce((acc, t) => {
                if (t) acc[t] = (acc[t] || 0) + 1
                return acc
            }, {}))

            console.log('Stack distribution summary:', (() => {
                const summary = {}
                if (Object.keys(stackExposures).length > 0) {
                    Object.entries(stackExposures).forEach(([t, p]) => {
                        const count = Math.round((parseFloat(p) / 100) * lineupCount)
                        if (t && count > 0) summary[t] = count
                    })
                } else if (stackTeam) {
                    summary[stackTeam] = lineupCount
                }
                return summary
            })())
            if (Object.keys(stackExposures).length > 0) {
                const summary = {}
                Object.entries(stackExposures)
                    .filter(([_, pct]) => parseFloat(pct) > 0)
                    .forEach(([team, pct]) => { summary[team] = Math.round((parseFloat(pct) / 100) * lineupCount) })
                console.log('Stack distribution:', summary)
            } else if (stackTeam) {
                console.log('Single stack:', stackTeam, 'x', lineupCount)
            } else {
                console.log('No stack set')
            }
            console.log('Sending to optimizer:', {
                stackTeam: stackTeam || null,
                stackTeamSize: stackTeam ? 5 : 0,
                players: eligiblePool.length,
                fillPool: fillPool.length
            })
            const res = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    players: eligiblePool.map(p => ({
                        slatePlayerId: p.SlatePlayerID,
                        slateGameId: p.SlateGameID,
                        operatorPlayerName: p.OperatorPlayerName,
                        operatorPosition: p.OperatorPosition,
                        operatorSalary: p.OperatorSalary,
                        operatorRosterSlots: p.OperatorRosterSlots,
                        team: p.Team,
                        opponent: (() => {
                            if (!selectedSlate?.DfsSlateGames) return p.Opponent || null
                            const game = selectedSlate.DfsSlateGames.find(sg => sg.SlateGameID === p.SlateGameID)
                            if (!game?.Game) return p.Opponent || null
                            return p.Team === game.Game.AwayTeam ? game.Game.HomeTeam : game.Game.AwayTeam
                        })(),
                        projectedPoints: getProjection(p),
                        ownershipProjection: getEffectiveOwnership(p),
                        value: getValueScore(p),
                        locked: !!stackRules.lockedPlayers.find(lp => lp.SlatePlayerID === p.SlatePlayerID),
                    })),
                    ownershipTargets: Object.fromEntries(
                        Object.entries(customOwnership)
                            .filter(([_, v]) => v !== '' && v !== undefined && parseFloat(v) > 0)
                            .map(([id, pct]) => [String(parseInt(id)), parseFloat(pct)])
                    ),
                    slots,
                    cap,
                    minSalary: teamSalaryMin ? parseInt(teamSalaryMin) : 49500,
                    maxSalary: teamSalaryMax ? parseInt(teamSalaryMax) : 50000,
                    numLineups: lineupCount,
                    lockedIds: stackRules.lockedPlayers.map(p => p.SlatePlayerID),
                    excludedIds: stackRules.excludedPlayers.map(p => p.SlatePlayerID),
                    playersPerTeamMax,
                    playersPerGameMax,
                    hittersVsPitcher,
                    uniquePlayersPerLineup,
                    numberOfGames: selectedSlate?.NumberOfGames || 10,
                    stackTeam: stackTeam || null,
                    stackTeamSize: stackTeam ? 5 : 0,
                    stackSize: stackTeam ? 5 : 0,
                    stackDistribution: (() => {
                        const total = lineupCount

                        if (Object.keys(stackExposures).length > 0) {
                            const dist = []
                            const entries = Object.entries(stackExposures)
                                .filter(([_, pct]) => parseFloat(pct) > 0)
                                .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))

                            let allocated = 0
                            const allocations = entries.map(([team, pct], i) => {
                                const isLast = i === entries.length - 1
                                const count = isLast
                                    ? total - allocated
                                    : Math.round((parseFloat(pct) / 100) * total)
                                allocated += count
                                return { team, count }
                            })

                            console.log('Stack allocations:', allocations.map(a => `${a.team}:${a.count}`).join(', '))

                            allocations.forEach(({ team, count }) => {
                                for (let i = 0; i < count; i++) dist.push(team)
                            })

                            for (let i = dist.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [dist[i], dist[j]] = [dist[j], dist[i]]
                            }

                            while (dist.length < total) dist.push(entries[0][0])
                            return dist.slice(0, total)
                        }

                        if (stackTeam) return Array(total).fill(stackTeam)

                        return Array(total).fill(null)
                    })(),
                    fillPoolIds: fillPool.map(p => p.SlatePlayerID),
                })
            })

            const data = await res.json()

            if (!data.success) {
                setError(data.error || 'Failed to generate lineups.')
                setTimeout(() => setError(null), 4000)
                setLoading(false)
                return
            }

            // Assign players to slots correctly
            const properLineups = data.lineups.map(lu => {
                const newLineup = new Array(slots.length).fill(null)
                const usedIds = new Set()

                slots.forEach((slot, slotIndex) => {
                    const eligible = lu.players.filter(p => {
                        if (usedIds.has(p.slatePlayerId)) return false
                        const pos = p.operatorPosition || ''
                        const rosterSlots = p.operatorRosterSlots || []
                        if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                        if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos) || pos.split('/').some(p => ['RB', 'WR', 'TE'].includes(p))
                        if (pos.includes('/')) return pos.split('/').includes(slot)
                        if (rosterSlots.includes(slot)) return true
                        return pos === slot
                    })

                    if (eligible.length > 0) {
                        const pick = eligible[0]
                        const fullPlayer = eligiblePool.find(ep => ep.SlatePlayerID === pick.slatePlayerId)
                        if (fullPlayer) {
                            newLineup[slotIndex] = fullPlayer
                            usedIds.add(pick.slatePlayerId)
                        }
                    }
                })

                return newLineup
            })

            const paddedLineups = Array.from(
                { length: lineupCount },
                (_, i) => properLineups[i] || new Array(slots.length).fill(null)
            )

            setLineups(paddedLineups)
            setActiveLineup(0)
            setLineupCount(data.generated)

        } catch (err) {
            console.error('Optimizer error:', err)
            setError('Optimizer service unavailable. Make sure Python service is running.')
            setTimeout(() => setError(null), 4000)
        }

        setLoading(false)
    }

    const getDateLabel = (dateStr) => {
        const today = new Date()
        const ET = new Date(today.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        const todayStr = ET.toISOString().split('T')[0]
        const tomorrow = new Date(ET)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const yesterday = new Date(ET)
        yesterday.setDate(yesterday.getDate() - 1)
        if (dateStr === todayStr) return 'Today'
        if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
        if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
        return dateStr
    }

    const changeDate = (direction) => {
        const current = new Date(selectedDate)
        current.setDate(current.getDate() + direction)
        setSelectedDate(current.toISOString().split('T')[0])
    }

    const getTeams = () => {
        const teams = [...new Set(players.map(p => p.Team).filter(Boolean))]
        return teams.sort()
    }

    const getStackPlayers = (team) => {
        return players
            .filter(p => p.Team === team)
            .filter(p => p.OperatorPosition !== 'SP' && p.OperatorPosition !== 'RP')
            .sort((a, b) => (b.OperatorSalary || 0) - (a.OperatorSalary || 0))
            .slice(0, 5)
    }

    const getLeverage = (player) => {
        const own = player.OwnershipProjection || 0
        const pts = player.ProjectedPoints || 0
        const salary = player.OperatorSalary || 0
        if (!pts || !salary) return 0
        const value = (pts / salary) * 1000
        const ownPenalty = own * 0.1
        return (value - ownPenalty).toFixed(2)
    }

    const getLeverageColor = (leverage) => {
        if (leverage >= 3.5) return '#22C55E'
        if (leverage >= 2.5) return '#FFB800'
        return '#8A9BBE'
    }

    const getGameScore = (game) => {
        let score = 5
        const g = game.Game || game
        const ou = g.OverUnder || 0
        if (ou >= 10) score += 3
        else if (ou >= 8.5) score += 2
        else if (ou >= 7.5) score += 1
        else if (ou <= 6) score -= 2
        else if (ou <= 7) score -= 1
        const wind = g.ForecastWindSpeed || 0
        if (wind <= 5) score += 2
        else if (wind <= 10) score += 1
        else if (wind >= 20) score -= 2
        else if (wind >= 15) score -= 1
        const temp = g.ForecastTempHigh || 70
        if (temp >= 80) score += 1
        else if (temp <= 40) score -= 1
        return Math.min(Math.max(score, 1), 10)
    }

    const getScoreColor = (score) => {
        if (score >= 8) return '#22C55E'
        if (score >= 6) return '#FFB800'
        if (score >= 4) return '#FB923C'
        return '#EF4444'
    }

    const getScoreLabel = (score) => {
        if (score >= 8) return 'Elite'
        if (score >= 6) return 'Good'
        if (score >= 4) return 'Fair'
        return 'Poor'
    }

    const getTopFactor = (game) => {
        const g = game.Game || game
        const ou = g.OverUnder || 0
        const wind = g.ForecastWindSpeed || 0
        const temp = g.ForecastTempHigh || 70
        if (ou >= 9) return '🔥 High total'
        if (wind <= 5) return '✓ Low wind'
        if (temp >= 80) return '☀️ Warm weather'
        if (wind >= 20) return '⚠️ High wind'
        if (ou <= 6.5) return '⚠️ Low total'
        return '➖ Neutral'
    }

    const parseProjectionsCSV = (csvText) => {
        const lines = csvText.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        const firstNameIdx = headers.indexOf('first_name')
        const lastNameIdx = headers.indexOf('last_name')
        const projIdx = headers.indexOf('ppg_projection')
        const ownIdx = headers.indexOf('ownership_projection')
        const valueIdx = headers.indexOf('value_projection')
        const teamIdx = headers.indexOf('team')
        const orderIdx = headers.indexOf('confirmed_order')
        const impliedIdx = headers.indexOf('implied_team_score')

        const projections = {}
        let matched = 0
        const unmatched = []

        lines.slice(1).forEach(line => {
            if (!line.trim()) return
            const cols = line.split(',')

            const firstName = (cols[firstNameIdx] || '').trim()
            const lastName = (cols[lastNameIdx] || '').trim()
            const fullName = `${firstName} ${lastName}`.trim()
            const proj = parseFloat(cols[projIdx]) || 0
            const own = parseFloat(cols[ownIdx]) || 0
            const value = parseFloat(cols[valueIdx]) || 0
            const team = (cols[teamIdx] || '').trim().toUpperCase()
            const order = parseInt(cols[orderIdx]) || null
            const implied = parseFloat(cols[impliedIdx]) || 0

            const matchedPlayer = players.find(p => {
                const poolName = (p.OperatorPlayerName || '').toLowerCase()
                const csvName = fullName.toLowerCase()
                const poolTeam = (p.Team || '').toUpperCase()
                if (poolName === csvName && poolTeam === team) return true
                if (poolName.includes(lastName.toLowerCase()) && poolTeam === team) return true
                const firstInitial = firstName[0]?.toLowerCase()
                if (firstInitial && poolName.startsWith(firstInitial) &&
                    poolName.includes(lastName.toLowerCase()) && poolTeam === team) return true
                return false
            })

            if (matchedPlayer) {
                projections[matchedPlayer.SlatePlayerID] = {
                    projectedPoints: proj,
                    ownershipProjection: own,
                    valueProjection: value,
                    confirmedOrder: order,
                    impliedTeamScore: implied,
                    team,
                    fullName
                }
                matched++
            } else {
                unmatched.push(`${fullName} (${team})`)
            }
        })

        return { projections, matched, unmatched }
    }

    const handleCSVImport = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const csvText = event.target.result
            const { projections, matched, unmatched } = parseProjectionsCSV(csvText)

            setImportedProjections(projections)
            setImportStatus({ matched, unmatched, total: matched + unmatched.length })

            const newCustomProjections = { ...customProjections }
            Object.entries(projections).forEach(([slatePlayerId, data]) => {
                newCustomProjections[slatePlayerId] = data.projectedPoints
            })
            setCustomProjections(newCustomProjections)
        }
        reader.readAsText(file)
    }

    const parseManualSlateCSV = (csvText) => {
        const lines = csvText.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        const idx = (name) => headers.indexOf(name)
        const parsedPlayers = []

        lines.slice(1).forEach((line, i) => {
            if (!line.trim()) return
            const cols = line.split(',')

            const firstName = (cols[idx('first_name')] || '').trim()
            const lastName = (cols[idx('last_name')] || '').trim()
            const fullName = `${firstName} ${lastName}`.trim()
            const position = (cols[idx('position')] || '').trim().toUpperCase()
            const team = (cols[idx('team')] || '').trim().toUpperCase()
            const opp = (cols[idx('opp')] || '').trim().toUpperCase()
            const salary = parseInt(cols[idx('salary')]) || 0
            const proj = parseFloat(cols[idx('ppg_projection')]) || 0
            const own = parseFloat(cols[idx('ownership_projection')]) || 0
            const value = parseFloat(cols[idx('value_projection')]) || 0
            const order = parseInt(cols[idx('confirmed_order')]) || null
            const implied = parseFloat(cols[idx('implied_team_score')]) || 0
            const ou = parseFloat(cols[idx('over_under')]) || null
            const spread = parseFloat(cols[idx('spread')]) || null
            const slate = (cols[idx('slate')] || '').trim()
            const gameDate = (cols[idx('game_date')] || '').trim()
            const isPitcher = position === 'P' || position === 'SP' || position === 'RP'
            const isStartingPitcher = (cols[idx('starting_pitcher')] || '').trim().toUpperCase() === 'YES'

            if (!fullName || !salary) return

            let operatorPosition = position
            if (position === 'P') operatorPosition = isStartingPitcher ? 'SP' : 'RP'

            const rosterSlots = isPitcher ? ['P'] : [position]

            parsedPlayers.push({
                SlatePlayerID: 90000 + i,
                SlateID: 99999,
                SlateGameID: `${team}-${opp}`,
                PlayerID: 80000 + i,
                OperatorPlayerName: fullName,
                OperatorPosition: operatorPosition,
                OperatorSalary: salary,
                OperatorRosterSlots: rosterSlots,
                Team: team,
                ProjectedPoints: proj,
                OwnershipProjection: own,
                ValueProjection: value,
                ConfirmedOrder: order,
                ImpliedTeamScore: implied,
                OverUnder: ou,
                Spread: spread,
                Opponent: opp,
                IsStartingPitcher: isStartingPitcher,
                SlateLabel: slate,
                GameDate: gameDate,
                RemovedByOperator: false,
                PlayerGameProjectionStatID: proj > 0 ? 1 : null,
            })
        })

        const games = []
        const seenMatchups = new Set()
        parsedPlayers.forEach(p => {
            const key = [p.Team, p.Opponent].sort().join('-')
            if (!seenMatchups.has(key)) {
                seenMatchups.add(key)
                games.push({
                    SlateGameID: `${p.Team}-${p.Opponent}`,
                    Game: {
                        AwayTeam: p.Team,
                        HomeTeam: p.Opponent,
                        OverUnder: p.OverUnder,
                        PointSpread: p.Spread,
                        ForecastWindSpeed: null,
                        ForecastTempHigh: null,
                        DateTime: p.GameDate,
                    }
                })
            }
        })

        const slateName = parsedPlayers[0]?.SlateLabel || 'Manual Slate'
        const gameCount = games.length

        return {
            players: parsedPlayers,
            games,
            slateInfo: {
                SlateID: 99999,
                OperatorName: slateName,
                NumberOfGames: gameCount,
                SalaryCap: 50000,
                SlateRosterSlots: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'],
                DfsSlateGames: games,
                players: parsedPlayers
            }
        }
    }

    const handleManualSlateUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const csvText = event.target.result
            const { players: parsed, slateInfo } = parseManualSlateCSV(csvText)

            setManualPlayers(parsed)
            setManualSlateInfo(slateInfo)
            setSlateSource('manual')
            setSelectedSlate(slateInfo)
            setPlayers(parsed)
            setLineups([new Array(slots.length).fill(null)])
            setActiveLineup(0)
            setShowSlateUpload(false)
            setImportedProjections({})
            setCustomProjections({})
            setImportStatus(null)

            console.log(`Manual slate loaded: ${parsed.length} players, ${slateInfo.NumberOfGames} games`)
        }
        reader.readAsText(file)
    }

    const excludeUnprojectedPlayers = () => {
        const unprojected = players.filter(p => {
            const proj = getProjection(p)
            return !proj || proj === 0
        })

        if (unprojected.length === 0) {
            setImportStatus(prev => ({ ...prev, excludeMessage: 'All players have projections!' }))
            setTimeout(() => setImportStatus(prev => ({ ...prev, excludeMessage: null })), 2500)
            return
        }

        const currentExcluded = stackRules.excludedPlayers
        const newExclusions = unprojected.filter(p =>
            !currentExcluded.find(ep => ep.SlatePlayerID === p.SlatePlayerID)
        )

        setStackRules(prev => ({
            ...prev,
            excludedPlayers: [...prev.excludedPlayers, ...newExclusions]
        }))

        setImportStatus(prev => ({
            ...prev,
            excludeMessage: `${newExclusions.length} players moved to excluded list`
        }))

        setTimeout(() => setImportStatus(prev => ({ ...prev, excludeMessage: null })), 3000)
    }

    const eligiblePool = players
        .filter(p => {
            if (p.OperatorPosition === 'SP' || p.OperatorPosition === 'RP') {
                return isConfirmedStarter(p)
            }
            if (stackRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)) return false
            if (!p.OperatorSalary || p.OperatorSalary === 0) return false
            if (p.RemovedByOperator === true) return false
            return true
        })
        .sort((a, b) => {
            const aVal = getProjection(a) / (a.OperatorSalary || 1)
            const bVal = getProjection(b) / (b.OperatorSalary || 1)
            return bVal - aVal
        })
    console.log('Eligible pool size:', eligiblePool.length)
    console.log('By position:', eligiblePool.reduce((acc, p) => {
        acc[p.OperatorPosition] = (acc[p.OperatorPosition] || 0) + 1
        return acc
    }, {}))

    const appendLineups = async () => {
        if (eligiblePool.length === 0) {
            setError('No players available')
            setTimeout(() => setError(null), 2500)
            return
        }

        setAppending(true)
        setError(null)

        // Build stack distribution for append
        const appendStackDistribution = stackTeam
            ? Array(appendCount).fill(stackTeam)
            : Object.entries(stackExposures).length > 0
                ? (() => {
                    const dist = []
                    Object.entries(stackExposures).forEach(([team, pct]) => {
                        const count = Math.round((parseFloat(pct) / 100) * appendCount)
                        for (let i = 0; i < count; i++) dist.push(team)
                    })
                    while (dist.length < appendCount) dist.push(null)
                    return dist.slice(0, appendCount)
                })()
                : Array(appendCount).fill(null)

        console.log('=== APPEND LINEUPS ===')
        console.log('Stack team:', stackTeam)
        console.log('Append count:', appendCount)
        console.log('Stack distribution:', appendStackDistribution)
        console.log('Locked:', stackRules.lockedPlayers.map(p => p.OperatorPlayerName))
        console.log('Excluded:', stackRules.excludedPlayers.map(p => p.OperatorPlayerName))
        console.log('Fill pool:', fillPool.map(p => p.OperatorPlayerName))

        try {
            const requestBody = {
                players: eligiblePool.map(p => ({
                    slatePlayerId: p.SlatePlayerID,
                    slateGameId: p.SlateGameID,
                    operatorPlayerName: p.OperatorPlayerName,
                    operatorPosition: p.OperatorPosition,
                    operatorSalary: p.OperatorSalary,
                    operatorRosterSlots: p.OperatorRosterSlots || [],
                    team: p.Team,
                    opponent: (() => {
                        if (!selectedSlate?.DfsSlateGames) return p.Opponent || null
                        const game = selectedSlate.DfsSlateGames.find(sg => sg.SlateGameID === p.SlateGameID)
                        if (!game?.Game) return p.Opponent || null
                        return p.Team === game.Game.AwayTeam ? game.Game.HomeTeam : game.Game.AwayTeam
                    })(),
                    projectedPoints: getProjection(p),
                    ownershipProjection: getEffectiveOwnership(p),
                    locked: !!stackRules.lockedPlayers.find(
                        lp => lp.SlatePlayerID === p.SlatePlayerID
                    ),
                })),
                ownershipTargets: Object.fromEntries(
                    Object.entries(customOwnership)
                        .filter(([_, v]) => v !== '' && v !== undefined)
                        .map(([id, pct]) => [id, parseFloat(pct)])
                ),
                slots,
                cap,
                minSalary: teamSalaryMin ? parseInt(teamSalaryMin) : 49500,
                maxSalary: teamSalaryMax ? parseInt(teamSalaryMax) : 50000,
                numLineups: appendCount,
                lockedIds: stackRules.lockedPlayers.map(p => p.SlatePlayerID),
                excludedIds: stackRules.excludedPlayers.map(p => p.SlatePlayerID),
                fillPoolIds: fillPool.map(p => p.SlatePlayerID),
                stackTeam: stackTeam || null,
                stackSize: stackTeam ? 5 : 0,
                stackTeamSize: stackTeam ? 5 : 0,
                stackDistribution: appendStackDistribution,
                playersPerTeamMax,
                playersPerGameMax,
                hittersVsPitcher,
                uniquePlayersPerLineup,
                numberOfGames: selectedSlate?.NumberOfGames || 10,
            }

            console.log('Sending request body:', JSON.stringify(requestBody).slice(0, 300))

            const res = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })

            const data = await res.json()
            console.log('Optimizer response:', data.success, 'lineups:', data.generated)

            if (!data.success) {
                setError(data.error || 'Failed to generate lineups')
                setTimeout(() => setError(null), 4000)
                setAppending(false)
                return
            }

            // Map returned players to full player objects
            const newLineups = data.lineups.map(lu => {
                const newLineup = new Array(slots.length).fill(null)
                const usedIds = new Set()

                slots.forEach((slot, slotIndex) => {
                    const eligible = lu.players.filter(p => {
                        if (usedIds.has(p.slatePlayerId)) return false
                        const pos = p.operatorPosition || ''
                        const rosterSlots = p.operatorRosterSlots || []
                        if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rosterSlots.includes('P')
                        if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos)
                        if (pos.includes('/')) return pos.split('/').includes(slot)
                        if (rosterSlots.includes(slot)) return true
                        return pos === slot
                    })

                    if (eligible.length > 0) {
                        const pick = eligible[0]
                        const fullPlayer = eligiblePool.find(
                            ep => ep.SlatePlayerID === pick.slatePlayerId
                        )
                        if (fullPlayer) {
                            newLineup[slotIndex] = fullPlayer
                            usedIds.add(pick.slatePlayerId)
                        }
                    }
                })

                return newLineup
            })

            // Append to existing valid lineups
            const existingValid = lineups.filter(l => l && l.some(p => p !== null))
            const combined = [...existingValid, ...newLineups]

            setLineups(combined)
            setLineupCount(combined.length)
            setActiveLineup(existingValid.length)

        } catch (err) {
            console.error('Append error:', err)
            setError('Failed to append lineups')
            setTimeout(() => setError(null), 3000)
        }

        setAppending(false)
    }

    const getTotalExposure = () => {
        return Object.values(stackExposures).reduce(
            (sum, val) => sum + (parseFloat(val) || 0), 0
        )
    }

    const getLineupCountForTeam = (team) => {
        const pct = parseFloat(stackExposures[team]) || 0
        return Math.round((pct / 100) * lineupCount)
    }

    const getExposureColor = (total) => {
        if (total > 100) return '#EF4444'
        if (total === 100) return '#22C55E'
        if (total >= 80) return '#FFB800'
        return '#8A9BBE'
    }

    const toggleLineupSelection = (index) => {
        setSelectedLineupIndices(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
            } else {
                newSet.add(index)
            }
            return newSet
        })
    }

    const selectAllLineups = () => {
        const validCount = lineups.filter(l => l && l.some(p => p !== null)).length
        setSelectedLineupIndices(new Set(Array.from({ length: validCount }, (_, i) => i)))
    }

    const deselectAllLineups = () => {
        setSelectedLineupIndices(new Set())
    }

    const sendToMyLineups = () => {
        const validLineups = lineups.filter(l => l && l.some(p => p !== null))
        const selectedLineupsList = [...selectedLineupIndices]
            .sort((a, b) => a - b)
            .map(i => validLineups[i])
            .filter(Boolean)

        if (selectedLineupsList.length === 0) {
            setError('No lineups selected')
            setTimeout(() => setError(null), 2500)
            return
        }

        try {
            const existing = JSON.parse(sessionStorage.getItem('dfsszn_my_lineups') || '[]')
            const newEntries = selectedLineupsList.map((lu, i) => ({
                id: `lineup_${Date.now()}_${i}`,
                name: `${sport.toUpperCase()} ${platform === 'draftkings' ? 'DK' : 'FD'} - ${new Date().toLocaleDateString()}`,
                sport,
                platform,
                players: lu.filter(p => p !== null),
                slots,
                total_salary: lu.reduce((sum, p) => sum + (p?.OperatorSalary || 0), 0),
                projected_points: lu.reduce((sum, p) => sum + (p ? getProjection(p) : 0), 0),
                stack_team: detectStackTeam(lu)?.team || null,
                created_at: new Date().toISOString(),
                source: 'optimizer'
            }))
            sessionStorage.setItem('dfsszn_my_lineups', JSON.stringify([...existing, ...newEntries]))
            setSentToMyLineups(true)
            setSelectedLineupIndices(new Set())
            setTimeout(() => setSentToMyLineups(false), 3000)
        } catch (err) {
            console.error('Failed to send to my lineups:', err)
            setError('Failed to send lineups')
            setTimeout(() => setError(null), 2500)
        }
    }

    const saveStateToSession = () => {
        try {
            const stateToSave = {
                sport,
                platform,
                selectedDate,
                slateSource,
                manualPlayers: manualPlayers.length > 0 ? manualPlayers : null,
                manualSlateInfo: manualSlateInfo || null,
                lineups: lineups.filter(l => l && l.some(p => p !== null)),
                lineupCount,
                stackTeam,
                stackExposures,
                stackRules,
                fillPool,
                teamSalaryMin,
                teamSalaryMax,
                playersPerTeamMax,
                playersPerGameMax,
                hittersVsPitcher,
                uniquePlayersPerLineup,
                customProjections,
                importedProjections,
                posFilter,
                search,
                sortBy,
                sortDir,
            }
            sessionStorage.setItem('dfsszn_optimizer_state', JSON.stringify(stateToSave))
        } catch (err) {
            console.error('Failed to save state:', err)
        }
    }

    const restoreStateFromSession = () => {
        try {
            const saved = sessionStorage.getItem('dfsszn_optimizer_state')
            if (!saved) return false

            const state = JSON.parse(saved)

            if (state.sport) setSport(state.sport)
            if (state.platform) setPlatform(state.platform)
            if (state.selectedDate) setSelectedDate(state.selectedDate)
            if (state.stackTeam) setStackTeam(state.stackTeam)
            if (state.stackExposures) setStackExposures(state.stackExposures)
            if (state.stackRules) setStackRules(state.stackRules)
            if (state.fillPool) setFillPool(state.fillPool)
            if (state.teamSalaryMin) setTeamSalaryMin(state.teamSalaryMin)
            if (state.teamSalaryMax) setTeamSalaryMax(state.teamSalaryMax)
            if (state.playersPerTeamMax) setPlayersPerTeamMax(state.playersPerTeamMax)
            if (state.playersPerGameMax) setPlayersPerGameMax(state.playersPerGameMax)
            if (state.hittersVsPitcher !== undefined) setHittersVsPitcher(state.hittersVsPitcher)
            if (state.uniquePlayersPerLineup) setUniquePlayersPerLineup(state.uniquePlayersPerLineup)
            if (state.customProjections) setCustomProjections(state.customProjections)
            if (state.importedProjections) setImportedProjections(state.importedProjections)
            if (state.posFilter) setPosFilter(state.posFilter)
            if (state.search) setSearch(state.search)
            if (state.sortBy) setSortBy(state.sortBy)
            if (state.sortDir) setSortDir(state.sortDir)

            if (state.lineups?.length > 0) {
                setLineups(state.lineups)
                setLineupCount(state.lineups.length)
            }

            if (state.slateSource === 'manual' && state.manualPlayers?.length > 0) {
                setSlateSource('manual')
                setManualPlayers(state.manualPlayers)
                setManualSlateInfo(state.manualSlateInfo)
                setSelectedSlate(state.manualSlateInfo)
                setPlayers(state.manualPlayers)
                return true
            }

            return false
        } catch (err) {
            console.error('Failed to restore state:', err)
            return false
        }
    }

    const detectStackTeam = (lu) => {
        if (!lu || lu.every(p => !p)) return null

        const teamCounts = {}
        lu.forEach(p => {
            if (!p) return
            if (p.OperatorPosition === 'SP' || p.OperatorPosition === 'RP') return
            teamCounts[p.Team] = (teamCounts[p.Team] || 0) + 1
        })

        const maxTeam = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0]
        if (maxTeam && maxTeam[1] >= 3) {
            return { team: maxTeam[0], count: maxTeam[1] }
        }
        return null
    }

    const generateAiLineups = async (requestedCount) => {
        const countToUse = requestedCount || lineupCount
        if (eligiblePool.length === 0) {
            setError('Load a slate first')
            setTimeout(() => setError(null), 2500)
            return
        }

        setAiBuilding(true)
        setError(null)

        try {
            const res = await fetch('/api/optimize-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    players: eligiblePool.map(p => ({
                        slatePlayerId: p.SlatePlayerID,
                        operatorPlayerName: p.OperatorPlayerName,
                        operatorPosition: p.OperatorPosition,
                        operatorSalary: p.OperatorSalary,
                        operatorRosterSlots: p.OperatorRosterSlots || [],
                        team: p.Team,
                        projectedPoints: parseFloat(getProjection(p)) || 0,
                        ownershipProjection: parseFloat(getEffectiveOwnership(p)) || 0,
                    })),
                    slots,
                    cap,
                    minSalary: teamSalaryMin ? parseInt(teamSalaryMin) : 49500,
                    maxSalary: teamSalaryMax ? parseInt(teamSalaryMax) : 50000,
                    numLineups: countToUse,
                    stackTeam: stackTeam || null,
                    stackExposures,
                    fillPoolIds: fillPool.map(p => p.SlatePlayerID),
                    lockedIds: stackRules.lockedPlayers.map(p => p.SlatePlayerID),
                    excludedIds: stackRules.excludedPlayers.map(p => p.SlatePlayerID),
                    playersPerTeamMax,
                    hittersVsPitcher,
                    sport,
                    platform,
                    slate: selectedSlate,
                })
            })

            const data = await res.json()

            if (!data.success || !data.lineups?.length) {
                setError(data.error || 'AI could not build valid lineups. Try fewer lineups or relax filters.')
                setTimeout(() => setError(null), 4000)
                setAiBuilding(false)
                return
            }

            const properLineups = data.lineups.map(lu => {
                const newLineup = new Array(slots.length).fill(null)
                lu.players.forEach(({ slatePlayerId, slot }) => {
                    const fullPlayer = eligiblePool.find(
                        ep => ep.SlatePlayerID === slatePlayerId
                    )
                    if (!fullPlayer) return
                    const slotIndex = slots.findIndex((s, i) =>
                        s === slot && !newLineup[i]
                    )
                    if (slotIndex !== -1) {
                        newLineup[slotIndex] = fullPlayer
                    }
                })
                return newLineup
            })

            const newReasonings = data.lineups.map(lu =>
                `${lu.strategy ? `[${lu.strategy}] ` : ''}${lu.reasoning || ''}`
            )
            setLineupReasonings(newReasonings)

            const paddedLineups = Array.from(
                { length: data.generated },
                (_, i) => properLineups[i] || new Array(slots.length).fill(null)
            )

            setLineups(paddedLineups)
            setActiveLineup(0)
            setLineupCount(data.generated)

            if (data.strategiesUsed?.length > 0) {
                console.log('AI strategies used:', data.strategiesUsed)
            }

            if (data.generated < data.requested) {
                setError(`AI generated ${data.generated} of ${data.requested} requested lineups (some were filtered for validity)`)
                setTimeout(() => setError(null), 5000)
            }

        } catch (err) {
            console.error('AI lineup build error:', err)
            setError('AI lineup builder failed.')
            setTimeout(() => setError(null), 4000)
        }

        setAiBuilding(false)
    }

    const fetchAiAnalysis = async () => {
        if (eligiblePool.length === 0) {
            setError('Load a slate first')
            setTimeout(() => setError(null), 2500)
            return
        }

        setAiLoading(true)
        setShowAiPanel(true)
        setAiAnalysis(null)

        try {
            const res = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    players: eligiblePool.map(p => ({
                        slatePlayerId: p.SlatePlayerID,
                        operatorPlayerName: p.OperatorPlayerName,
                        operatorPosition: p.OperatorPosition,
                        operatorSalary: p.OperatorSalary,
                        team: p.Team,
                        projectedPoints: parseFloat(getProjection(p)) || 0,
                        ownershipProjection: parseFloat(getEffectiveOwnership(p)) || 0,
                    })),
                    sport,
                    platform,
                    slate: selectedSlate,
                    numLineups: lineupCount,
                    stackTeam,
                    stackExposures,
                    slateNotes: slateNotes.trim(),
                })
            })

            const data = await res.json()
            if (data.success) {
                setAiAnalysis(data.analysis)

                const analysis = data.analysis
                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const aiSummary = [
                    `\n─── AI Analysis (${timestamp}) ───`,
                    analysis.slate_classification?.type
                        ? `Slate Type: ${analysis.slate_classification.type}` : '',
                    analysis.slate_summary
                        ? `Summary: ${analysis.slate_summary}` : '',
                    analysis.exposure_plan?.length > 0
                        ? `Exposure Plan:\n${analysis.exposure_plan.map(e => `  ${e.team} ${e.strategy} ${e.percentage}%`).join('\n')}` : '',
                    analysis.leverage_spots?.length > 0
                        ? `Leverage: ${analysis.leverage_spots.map(l => l.name_or_team).join(', ')}` : '',
                    analysis.pitcher_notes?.length > 0
                        ? `Pitchers: ${analysis.pitcher_notes.map(p => `${p.name}(${p.exposure_percentage}%${p.gpp_rating === 'avoid' ? ' AVOID' : ''})`).join(', ')}` : '',
                    analysis.portfolio_uniqueness_check?.estimated_field_overlap
                        ? `Field Overlap: ${analysis.portfolio_uniqueness_check.estimated_field_overlap}` : '',
                ].filter(Boolean).join('\n')

                setSlateNotes(prev => prev ? prev + '\n' + aiSummary : aiSummary)
                setNotesSaved(true)
                setTimeout(() => setNotesSaved(false), 2000)
            } else {
                setError(data.error || 'AI analysis failed')
                setTimeout(() => setError(null), 6000)
                setShowAiPanel(false)
            }
        } catch (err) {
            console.error('AI analysis error:', err)
            setError('AI analysis failed. Check your API key.')
            setTimeout(() => setError(null), 4000)
        }

        setAiLoading(false)
    }

    const findPlayerByName = (name) => {
        if (!name) return null
        const normalize = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim()
        const target = normalize(name)
        const targetLast = target.split(' ').pop()

        let match = eligiblePool.find(p =>
            normalize(p.OperatorPlayerName) === target
        )
        if (match) return match

        match = eligiblePool.find(p =>
            normalize(p.OperatorPlayerName).split(' ').pop() === targetLast
        )
        if (match) return match

        match = eligiblePool.find(p =>
            normalize(p.OperatorPlayerName).includes(targetLast) ||
            target.includes(normalize(p.OperatorPlayerName))
        )
        return match || null
    }

    const applyExposurePlan = () => {
        if (!aiAnalysis?.exposure_plan) return

        const newExposures = {}
        aiAnalysis.exposure_plan.forEach(entry => {
            if (entry.team && entry.percentage) {
                newExposures[entry.team] = (
                    parseFloat(newExposures[entry.team] || 0) +
                    parseFloat(entry.percentage)
                ).toString()
            }
        })

        setStackExposures(newExposures)
        setStackTeam(null)

        const newFillPool = [...fillPool]
        aiAnalysis.global_value_plays?.forEach(vp => {
            const player = findPlayerByName(vp.name)
            if (player && !newFillPool.find(p => p.SlatePlayerID === player.SlatePlayerID)) {
                newFillPool.push(player)
            }
        })
        setFillPool(newFillPool)

        const newExcluded = [...stackRules.excludedPlayers]
        aiAnalysis.global_avoid?.forEach(pa => {
            const player = findPlayerByName(pa.name)
            if (player && !newExcluded.find(p => p.SlatePlayerID === player.SlatePlayerID)) {
                newExcluded.push(player)
            }
        })
        setStackRules(prev => ({
            ...prev,
            excludedPlayers: newExcluded
        }))

        setError(null)
    }

    const applyAiRecommendations = () => {
        if (!aiAnalysis) return
        let appliedCount = 0

        const topStack = aiAnalysis.top_stacks?.[0]
        if (topStack?.team) {
            setStackTeam(topStack.team)
            appliedCount++
        }

        const newFillPool = [...fillPool]
        aiAnalysis.value_plays?.forEach(vp => {
            const player = findPlayerByName(vp.name)
            if (player && !newFillPool.find(
                p => p.SlatePlayerID === player.SlatePlayerID
            )) {
                newFillPool.push(player)
                appliedCount++
            }
        })

        aiAnalysis.secondary_stack_recommendation?.players?.forEach(name => {
            const player = findPlayerByName(name)
            if (player && !newFillPool.find(
                p => p.SlatePlayerID === player.SlatePlayerID
            )) {
                newFillPool.push(player)
                appliedCount++
            }
        })
        setFillPool(newFillPool)

        const newExcluded = [...stackRules.excludedPlayers]
        aiAnalysis.players_to_avoid?.forEach(pa => {
            const player = findPlayerByName(pa.name)
            if (player && !newExcluded.find(
                p => p.SlatePlayerID === player.SlatePlayerID
            )) {
                newExcluded.push(player)
                appliedCount++
            }
        })
        setStackRules(prev => ({
            ...prev,
            excludedPlayers: newExcluded
        }))

        setError(null)
    }

    return (
        <div className="min-h-screen" style={{ background: '#0A1628' }}>

            {/* Top Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#223366] px-6 h-14 flex items-center gap-6"
                style={{ background: 'rgba(10,22,40,0.97)' }}>
                <div className="text-xl font-black text-white">
                    DFS<span className="text-[#FFB800]">SZN</span>
                </div>

                <div className="flex gap-1">
                    {['mlb', 'nba', 'nfl'].map(s => (
                        <button key={s} onClick={() => setSport(s)}
                            className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
                            style={{
                                background: sport === s ? '#FFB800' : 'transparent',
                                color: sport === s ? '#0A1628' : '#8A9BBE',
                                border: sport === s ? 'none' : '1px solid transparent'
                            }}>
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex rounded-lg overflow-hidden border border-[#223366]"
                    style={{ background: '#132244' }}>
                    {['draftkings', 'fanduel'].map(p => (
                        <button key={p} onClick={() => setPlatform(p)}
                            className="px-4 py-1.5 text-xs font-bold transition-all"
                            style={{
                                background: platform === p ? '#1A2E55' : 'transparent',
                                color: platform === p ? '#FFB800' : '#8A9BBE',
                            }}>
                            {p === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-[#8A9BBE] border border-[#223366] rounded-lg px-3 py-1.5"
                        style={{ background: '#132244' }}>
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Live Data
                    </div>
                    <button
                        onClick={() => setShowGameFilters(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all relative"
                        style={{
                            background: (stackTeam || stackRules.lockedPlayers.length > 0 || stackRules.excludedPlayers.length > 0 || fillPool.length > 0) ? 'rgba(255,184,0,0.1)' : '#132244',
                            borderColor: (stackTeam || stackRules.lockedPlayers.length > 0 || stackRules.excludedPlayers.length > 0 || fillPool.length > 0) ? '#FFB800' : '#223366',
                            color: (stackTeam || stackRules.lockedPlayers.length > 0 || stackRules.excludedPlayers.length > 0 || fillPool.length > 0) ? '#FFB800' : '#8A9BBE'
                        }}>
                        ⚙️ Game Filters
                        {(stackTeam || stackRules.lockedPlayers.length > 0 || stackRules.excludedPlayers.length > 0 || fillPool.length > 0) && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                                style={{ background: '#FFB800', color: '#0A1628' }}>
                                {(stackTeam ? 1 : 0) + stackRules.lockedPlayers.length + stackRules.excludedPlayers.length + fillPool.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowImport(!showImport)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                        style={{
                            background: Object.keys(importedProjections).length > 0 ? 'rgba(34,197,94,0.1)' : '#132244',
                            borderColor: Object.keys(importedProjections).length > 0 ? '#22C55E' : '#223366',
                            color: Object.keys(importedProjections).length > 0 ? '#22C55E' : '#8A9BBE'
                        }}>
                        📥 Import
                        {Object.keys(importedProjections).length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                                style={{ background: '#22C55E', color: '#0A1628' }}>
                                {Object.keys(importedProjections).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowSlateNotes(!showSlateNotes)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5"
                        style={{
                            background: slateNotes ? 'rgba(45,212,191,0.1)' : '#132244',
                            borderColor: slateNotes ? '#2DD4BF' : '#223366',
                            color: slateNotes ? '#2DD4BF' : '#8A9BBE'
                        }}>
                        📝 Slate Notes
                        {slateNotes && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                        )}
                    </button>
                    <button
                        onClick={fetchAiAnalysis}
                        disabled={aiLoading}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5"
                        style={{
                            background: aiAnalysis
                                ? 'rgba(99,102,241,0.1)' : '#132244',
                            borderColor: aiAnalysis ? '#818CF8' : '#223366',
                            color: aiAnalysis ? '#818CF8' : '#8A9BBE'
                        }}>
                        {aiLoading ? (
                            <>⚡ Analyzing...</>
                        ) : (
                            <>🤖 AI Analysis</>
                        )}
                    </button>
                    <button
                        onClick={() => setShowAiCountModal(true)}
                        disabled={aiBuilding}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5"
                        style={{
                            background: 'rgba(34,197,94,0.1)',
                            borderColor: '#22C55E',
                            color: '#22C55E'
                        }}>
                        {aiBuilding ? (
                            <>⚡ Building...</>
                        ) : (
                            <>🤖 AI Build Lineups</>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('dfsszn_optimizer_state')
                            window.location.reload()
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-red-400 hover:text-red-400 transition-all"
                        style={{ background: '#132244' }}
                        title="Reset all optimizer state">
                        ↺ Reset
                    </button>
                </div>
            </nav>

            <div className="flex pt-14 min-h-screen">

                {/* Sidebar */}
                <aside className="w-52 shrink-0 border-r border-[#223366] pt-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto"
                    style={{ background: '#0F1E38' }}>
                    <div className="px-4 mb-4">
                        <div className="text-xs font-semibold text-[#8A9BBE] uppercase tracking-widest mb-2">Tools</div>
                        {[
                            { label: 'Optimizer', icon: '⚡', active: true, href: '/dashboard/optimizer' },
                            { label: 'My Lineups', icon: '📋', active: false, href: '/dashboard/lineups' },
                        ].map(item => (
                            <a key={item.label}
                                href={item.href}
                                onClick={(e) => {
                                    e.preventDefault()
                                    saveStateToSession()
                                    window.location.href = item.href
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm transition-all cursor-pointer"
                                style={{
                                    background: item.active ? 'rgba(255,184,0,0.1)' : 'transparent',
                                    color: item.active ? '#FFB800' : '#B8C5D6',
                                    textDecoration: 'none',
                                }}>
                                <span>{item.icon}</span>
                                {item.label}
                            </a>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-5 overflow-y-auto">

                    {/* Slate Selector */}
                    {slates.length > 0 && (
                        <div className="mb-4">
                            <button
                                onClick={() => setSlateOpen(!slateOpen)}
                                className="flex items-center gap-2 text-sm font-semibold text-white mb-2 hover:text-[#FFB800] transition-colors">
                                <span className="text-[#8A9BBE]">Slate:</span>
                                <span>{selectedDate} · {selectedSlate?.NumberOfGames} Games</span>
                                <span className="text-[#8A9BBE] text-xs ml-1">{slateOpen ? '▲' : '▼'}</span>
                            </button>

                            {slateOpen && (
                                <div className="p-4 rounded-xl border border-[#223366] mb-3"
                                    style={{ background: '#132244' }}>
                                    {Object.entries(groupedSlates).map(([type, typeSlates]) => (
                                        <div key={type} className="mb-4 last:mb-0">
                                            <div className="text-xs font-bold text-[#8A9BBE] uppercase tracking-wider mb-2">
                                                {type}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {typeSlates.map(slate => {
                                                    const time = slate.OperatorStartTime
                                                        ? new Date(slate.OperatorStartTime).toLocaleTimeString('en-US', {
                                                            hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
                                                        }) + ' ET'
                                                        : ''
                                                    const isSelected = selectedSlate?.SlateID === slate.SlateID
                                                    return (
                                                        <button
                                                            key={slate.SlateID}
                                                            onClick={() => { selectSlate(slate); setSlateOpen(false) }}
                                                            className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all text-left"
                                                            style={{
                                                                background: isSelected ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: isSelected ? '#FFB800' : '#223366',
                                                                color: isSelected ? '#FFB800' : '#B8C5D6',
                                                                minWidth: '140px'
                                                            }}>
                                                            <div className="font-bold">
                                                                {slate.NumberOfGames} Games{slate.OperatorName ? ` · ${slate.OperatorName}` : ''}
                                                            </div>
                                                            <div className="text-xs mt-0.5" style={{ color: isSelected ? '#FFB800' : '#8A9BBE' }}>
                                                                {selectedDate}{time ? ` · ${time}` : ''}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Slate Source Toggle */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex rounded-lg overflow-hidden border border-[#223366]"
                            style={{ background: '#132244' }}>
                            <button
                                onClick={() => {
                                    setSlateSource('live')
                                    fetchSlates()
                                }}
                                className="px-4 py-1.5 text-xs font-bold transition-all"
                                style={{
                                    background: slateSource === 'live' ? '#1A2E55' : 'transparent',
                                    color: slateSource === 'live' ? '#FFB800' : '#8A9BBE'
                                }}>
                                🔴 Live Slate
                            </button>
                            <button
                                onClick={() => setShowSlateUpload(true)}
                                className="px-4 py-1.5 text-xs font-bold transition-all"
                                style={{
                                    background: slateSource === 'manual' ? '#1A2E55' : 'transparent',
                                    color: slateSource === 'manual' ? '#FFB800' : '#8A9BBE'
                                }}>
                                📄 Manual Slate
                                {slateSource === 'manual' && (
                                    <span className="ml-1 text-xs text-[#22C55E]">✓</span>
                                )}
                            </button>
                        </div>

                        {slateSource === 'manual' && manualSlateInfo && (
                            <div className="flex items-center gap-2 text-xs text-[#8A9BBE]">
                                <span className="text-[#FFB800] font-bold">{manualSlateInfo.OperatorName}</span>
                                <span>·</span>
                                <span>{manualPlayers.length} players</span>
                                <span>·</span>
                                <span>{manualSlateInfo.NumberOfGames} games</span>
                                <button
                                    onClick={() => {
                                        setSlateSource('live')
                                        setManualPlayers([])
                                        setManualSlateInfo(null)
                                        fetchSlates()
                                    }}
                                    className="text-[#EF4444] hover:underline ml-1">
                                    ✕ Clear
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Date Navigation */}
                    {slateSource === 'live' && (
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={() => changeDate(-1)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-[#FFB800] hover:text-[#FFB800] transition-all"
                                style={{ background: '#132244' }}>
                                ← Prev
                            </button>
                            <div className="flex-1 text-center">
                                <div className="text-sm font-bold text-white">{getDateLabel(selectedDate)}</div>
                                <div className="text-xs text-[#8A9BBE]">{selectedDate}</div>
                            </div>
                            <button
                                onClick={() => changeDate(1)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-[#FFB800] hover:text-[#FFB800] transition-all"
                                style={{ background: '#132244' }}>
                                Next →
                            </button>
                        </div>
                    )}

                    {/* Import Projections Panel */}
                    {showImport && (
                        <div className="mb-4 p-4 rounded-xl border border-[#223366]"
                            style={{ background: '#132244' }}>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-sm font-bold text-white">📥 Import Projections</div>
                                    <div className="text-xs text-[#8A9BBE] mt-0.5">
                                        Upload a CSV with ppg_projection, ownership_projection columns
                                    </div>
                                </div>
                                {Object.keys(importedProjections).length > 0 && (
                                    <button
                                        onClick={() => {
                                            setImportedProjections({})
                                            setImportStatus(null)
                                            setCustomProjections({})
                                        }}
                                        className="text-xs text-[#EF4444] hover:underline">
                                        Clear Import
                                    </button>
                                )}
                            </div>

                            <label
                                className="flex flex-col items-center justify-center w-full py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#FFB800]"
                                style={{ borderColor: '#223366', background: '#0A1628' }}>
                                <div className="text-2xl mb-2">📄</div>
                                <div className="text-sm font-bold text-white mb-1">Click to upload CSV</div>
                                <div className="text-xs text-[#8A9BBE]">DFF, FantasyPros, or custom projection CSV</div>
                                <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                            </label>

                            {importStatus && (
                                <div className="mt-3 p-3 rounded-lg border border-[#223366]"
                                    style={{ background: '#0A1628' }}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="text-xs font-bold text-[#22C55E]">
                                            ✓ {importStatus.matched} players matched
                                        </div>
                                        {importStatus.unmatched.length > 0 && (
                                            <div className="text-xs text-[#FFB800]">
                                                ⚠ {importStatus.unmatched.length} unmatched
                                            </div>
                                        )}
                                    </div>
                                    {importStatus.unmatched.length > 0 && (
                                        <div className="text-xs text-[#8A9BBE]">
                                            <div className="mb-1">Could not match:</div>
                                            <div className="flex flex-wrap gap-1">
                                                {importStatus.unmatched.slice(0, 5).map((name, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded text-xs"
                                                        style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}>
                                                        {name}
                                                    </span>
                                                ))}
                                                {importStatus.unmatched.length > 5 && (
                                                    <span className="text-xs text-[#8A9BBE]">
                                                        +{importStatus.unmatched.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {(() => {
                                        const unprojectedCount = players.filter(p => {
                                            const proj = getProjection(p)
                                            return !proj || proj === 0
                                        }).length
                                        return unprojectedCount > 0 ? (
                                            <div className="text-xs text-[#EF4444] mt-1">
                                                ⚠ {unprojectedCount} players have no projection
                                            </div>
                                        ) : (
                                            <div className="text-xs text-[#22C55E] mt-1">
                                                ✓ All players have projections
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}

                            <div className="mt-3 flex items-center gap-3">
                                <button
                                    onClick={excludeUnprojectedPlayers}
                                    disabled={Object.keys(importedProjections).length === 0}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all"
                                    style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        borderColor: '#EF4444',
                                        color: '#EF4444',
                                        opacity: Object.keys(importedProjections).length === 0 ? 0.5 : 1
                                    }}>
                                    ✕ Exclude Unprojected Players
                                </button>
                                <button
                                    onClick={() => {
                                        setStackRules(prev => ({
                                            ...prev,
                                            excludedPlayers: prev.excludedPlayers.filter(ep =>
                                                players.find(p => {
                                                    const proj = getProjection(p)
                                                    return p.SlatePlayerID === ep.SlatePlayerID && (!proj || proj === 0)
                                                }) === undefined
                                            )
                                        }))
                                    }}
                                    className="px-3 py-2 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-[#FFB800] hover:text-[#FFB800] transition-all"
                                    style={{ background: '#0A1628' }}>
                                    ↺ Undo
                                </button>
                            </div>

                            {importStatus?.excludeMessage && (
                                <div className="mt-2 py-2 rounded-lg text-xs font-bold text-center"
                                    style={{
                                        background: 'rgba(34,197,94,0.1)',
                                        color: '#22C55E',
                                        border: '1px solid rgba(34,197,94,0.3)'
                                    }}>
                                    ✓ {importStatus.excludeMessage}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Game Tiles - Collapsible */}
                    {selectedSlate?.DfsSlateGames?.length > 0 && (
                        <div className="mb-4 rounded-xl border border-[#223366] overflow-hidden"
                            style={{ background: '#132244' }}>

                            {/* Header - always visible */}
                            <button
                                onClick={() => setGameTilesOpen(!gameTilesOpen)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1A2E55] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xs font-bold text-white shrink-0">🎮 Games</span>
                                    {selectedSlate && (
                                        <span className="text-xs text-[#8A9BBE] shrink-0">
                                            {selectedSlate.NumberOfGames} games · {selectedSlate.OperatorName}
                                        </span>
                                    )}
                                    {!gameTilesOpen && (
                                        <div className="flex gap-1.5 overflow-hidden">
                                            {selectedSlate.DfsSlateGames.slice(0, 4).map((sg, i) => (
                                                <span key={i}
                                                    className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                                                    style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}>
                                                    {sg.Game?.AwayTeam}@{sg.Game?.HomeTeam}
                                                </span>
                                            ))}
                                            {selectedSlate.DfsSlateGames.length > 4 && (
                                                <span className="text-xs text-[#8A9BBE] shrink-0">
                                                    +{selectedSlate.DfsSlateGames.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-[#8A9BBE] shrink-0 ml-2">
                                    {gameTilesOpen ? '▲' : '▼'}
                                </span>
                            </button>

                            {/* Expanded game tiles */}
                            {gameTilesOpen && (
                                <div className="border-t border-[#223366] p-3">
                                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                                        <button
                                            onClick={() => setGameFilter(null)}
                                            className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
                                            style={{
                                                background: !gameFilter ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                borderColor: !gameFilter ? '#FFB800' : '#223366',
                                                color: !gameFilter ? '#FFB800' : '#8A9BBE',
                                            }}>
                                            All Games
                                        </button>
                                        {selectedSlate.DfsSlateGames.map(sg => {
                                            const g = sg.Game
                                            if (!g) return null
                                            const isSelected = gameFilter === sg.SlateGameID
                                            const dotColor = ouDotColor(g.OverUnder)
                                            const score = getGameScore(sg)
                                            return (
                                                <button
                                                    key={sg.SlateGameID}
                                                    onClick={() => setGameFilter(isSelected ? null : sg.SlateGameID)}
                                                    className="shrink-0 rounded-xl border transition-all text-left"
                                                    style={{
                                                        background: isSelected ? 'rgba(255,184,0,0.08)' : '#0A1628',
                                                        borderColor: isSelected ? '#FFB800' : '#223366',
                                                        padding: '10px 12px',
                                                        minWidth: '148px',
                                                    }}>
                                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                                        <span className="text-sm font-bold text-white leading-tight">
                                                            {g.AwayTeam} @ {g.HomeTeam}
                                                        </span>
                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ background: dotColor }} />
                                                    </div>
                                                    <div className="text-xs mb-1.5" style={{ color: '#FFB800' }}>
                                                        {formatGameTime(g.DateTime)}
                                                    </div>
                                                    <div className="text-xs text-[#8A9BBE] mb-0.5">
                                                        O/U {g.OverUnder ?? '—'}
                                                        {g.PointSpread != null && (
                                                            <span className="ml-2 text-[#556080]">
                                                                ({g.PointSpread > 0 ? '+' : ''}{g.PointSpread})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-[#8A9BBE]">
                                                        {g.ForecastWindSpeed != null && (
                                                            <span>💨 {g.ForecastWindSpeed} mph</span>
                                                        )}
                                                        {g.ForecastTempHigh != null && (
                                                            <span>🌡️ {g.ForecastTempHigh}°F</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t"
                                                        style={{ borderColor: 'rgba(34,51,102,0.5)' }}>
                                                        <div className="text-xs" style={{ color: '#8A9BBE' }}>Env Score</div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="text-sm font-black" style={{ color: getScoreColor(score) }}>
                                                                {score}/10
                                                            </div>
                                                            <div className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                                                style={{
                                                                    background: `${getScoreColor(score)}20`,
                                                                    color: getScoreColor(score)
                                                                }}>
                                                                {getScoreLabel(score)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs mt-1" style={{ color: '#8A9BBE' }}>
                                                        {getTopFactor(sg)}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showSlateNotes && (
                        <div className="mb-4 rounded-xl border border-[#223366] overflow-hidden"
                            style={{background:'#0F1E38'}}>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#223366]"
                                style={{background:'#1A2E55'}}>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">📝 Slate Notes</span>
                                    <span className="text-xs text-[#8A9BBE]">Passed to AI analysis</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {notesSaved && (
                                        <span className="text-xs text-[#22C55E] font-bold">✓ Saved</span>
                                    )}
                                    <button
                                        onClick={() => { setSlateNotes(''); setNotesSaved(false) }}
                                        className="text-xs text-[#8A9BBE] hover:text-[#EF4444] transition-colors">
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => setShowSlateNotes(false)}
                                        className="text-[#8A9BBE] hover:text-white transition-colors text-sm">
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <textarea
                                    value={slateNotes}
                                    onChange={e => { setSlateNotes(e.target.value); setNotesSaved(false) }}
                                    onBlur={() => {
                                        if (slateNotes) {
                                            setNotesSaved(true)
                                            setTimeout(() => setNotesSaved(false), 2000)
                                        }
                                    }}
                                    placeholder={"Add your slate research here — injury news, late lineup changes, weather updates, pitcher tendencies, ballpark notes, matchup insights...\n\nExamples:\n• Gausman scratched, replaced by Kay\n• Wind blowing out 15mph at Wrigley\n• Realmuto batting 2nd tonight per Phillies beat reporter\n• COL lineup stacked vs LHP tonight"}
                                    rows={8}
                                    className="w-full px-4 py-3 rounded-xl text-sm text-[#B8C5D6] outline-none border border-[#223366] focus:border-[#2DD4BF] resize-none transition-colors leading-relaxed"
                                    style={{background:'#132244', fontFamily:'inherit'}}
                                />
                                <div className="flex items-center justify-between mt-3">
                                    <div className="text-xs text-[#8A9BBE]">
                                        {slateNotes.length > 0
                                            ? `${slateNotes.length} characters · will be included in AI analysis`
                                            : 'No notes yet · AI will analyze from data only'}
                                    </div>
                                    <button
                                        onClick={fetchAiAnalysis}
                                        disabled={aiLoading || eligiblePool.length === 0}
                                        className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={{
                                            background:'rgba(99,102,241,0.15)',
                                            color:'#818CF8',
                                            border:'1px solid rgba(99,102,241,0.3)'
                                        }}>
                                        {aiLoading ? '⚡ Analyzing...' : '🤖 Analyze with Notes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showAiPanel && (
                        <div className="mb-4 rounded-xl border border-[#223366] overflow-hidden"
                            style={{background:'#0F1E38'}}>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#223366]" style={{background:'#1A2E55'}}>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">
                                        🤖 AI Slate Analysis
                                    </span>
                                    {aiAnalysis && (
                                        <button
                                            onClick={applyAiRecommendations}
                                            className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                            style={{
                                                background:'linear-gradient(135deg, #818CF8, #6366F1)',
                                                color:'#ffffff'
                                            }}>
                                            ✓ Apply All Recommendations
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => setShowAiPanel(false)}
                                    className="text-[#8A9BBE] hover:text-white transition-colors text-sm">
                                    ✕
                                </button>
                            </div>

                            {aiLoading && (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <div className="text-2xl animate-pulse">🤖</div>
                                    <div className="text-sm text-[#8A9BBE] animate-pulse">
                                        Claude is analyzing the slate...
                                    </div>
                                </div>
                            )}

                            {aiAnalysis && !aiLoading && (
                                <div className="p-4 space-y-4">
                                    <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                        <div className="text-xs font-bold text-[#818CF8] uppercase tracking-wider mb-2">
                                            📊 Slate Overview
                                        </div>
                                        <div className="text-sm text-[#B8C5D6] leading-relaxed">
                                            {aiAnalysis.slate_summary}
                                        </div>
                                    </div>

                                    {aiAnalysis.gpp_angles?.length > 0 && (
                                        <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#FFB800] uppercase tracking-wider mb-2">
                                                ⚡ GPP Angles
                                            </div>
                                            {aiAnalysis.gpp_angles.map((angle, i) => (
                                                <div key={i} className="flex items-start gap-2 text-sm text-[#B8C5D6] mb-1">
                                                    <span className="text-[#FFB800] shrink-0">→</span>
                                                    {angle}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-[#22C55E] uppercase tracking-wider">
                                                🎯 Stack Exposure Plan
                                            </div>
                                            <button
                                                onClick={applyExposurePlan}
                                                className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                                style={{
                                                    background:'linear-gradient(135deg, #818CF8, #6366F1)',
                                                    color:'#ffffff'
                                                }}>
                                                ✓ Apply Plan to Game Filters
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {aiAnalysis.exposure_plan?.map((entry, i) => (
                                                <div key={i}
                                                    className="p-2.5 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black" style={{color:'#FFB800'}}>
                                                                {entry.team}
                                                            </span>
                                                            <span className="text-xs font-bold text-white">
                                                                {entry.strategy}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono" style={{color:'#818CF8'}}>
                                                                {entry.percentage}%
                                                            </span>
                                                            <span className="text-xs text-[#8A9BBE]">
                                                                ~{Math.round((entry.percentage / 100) * lineupCount)} lineups
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-[#B8C5D6] mb-1.5">
                                                        {entry.reason}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        {entry.ownership_note && (
                                                            <div>
                                                                <span className="text-[#8A9BBE]">Own: </span>
                                                                <span className="text-[#B8C5D6]">{entry.ownership_note}</span>
                                                            </div>
                                                        )}
                                                        {entry.leverage_note && (
                                                            <div>
                                                                <span className="text-[#8A9BBE]">Lev: </span>
                                                                <span className="text-[#B8C5D6]">{entry.leverage_note}</span>
                                                            </div>
                                                        )}
                                                        {entry.ceiling_note && (
                                                            <div>
                                                                <span className="text-[#8A9BBE]">Ceil: </span>
                                                                <span className="text-[#B8C5D6]">{entry.ceiling_note}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-[#223366] text-xs text-[#8A9BBE]">
                                            Total: {aiAnalysis.exposure_plan?.reduce(
                                                (sum, e) => sum + (parseFloat(e.percentage) || 0), 0
                                            )}% across {aiAnalysis.exposure_plan?.length || 0} stacks
                                        </div>
                                    </div>

                                    {aiAnalysis.stack_shapes?.length > 0 && (
                                        <div className="p-3 rounded-xl border border-[#223366]"
                                            style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#FB923C] uppercase tracking-wider mb-2">
                                                📐 Batting Order Stack Shapes
                                            </div>
                                            <div className="space-y-1.5">
                                                {aiAnalysis.stack_shapes.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-[#223366]"
                                                        style={{background:'#0A1628'}}>
                                                        <div className="font-mono text-sm font-bold text-white">
                                                            {s.shape}
                                                        </div>
                                                        <div className="text-xs text-[#8A9BBE] flex-1 px-3">
                                                            {s.reason}
                                                        </div>
                                                        <div className="text-xs font-bold" style={{color:'#FB923C'}}>
                                                            {s.usage_percentage}%
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {aiAnalysis.one_off_pool && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries({
                                                'Elite Power': aiAnalysis.one_off_pool.elite_power,
                                                'Speed': aiAnalysis.one_off_pool.speed,
                                                'Salary Savers': aiAnalysis.one_off_pool.salary_savers,
                                                'Low-Owned Leverage': aiAnalysis.one_off_pool.low_owned_leverage,
                                            }).map(([label, list]) => list?.length > 0 && (
                                                <div key={label} className="p-3 rounded-xl border border-[#223366]"
                                                    style={{background:'#132244'}}>
                                                    <div className="text-xs font-bold text-[#2DD4BF] uppercase tracking-wider mb-2">
                                                        {label}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {list.map((name, i) => (
                                                            <span key={i} className="text-xs px-2 py-0.5 rounded"
                                                                style={{background:'rgba(45,212,191,0.1)', color:'#2DD4BF'}}>
                                                                {name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {aiAnalysis.pitcher_notes?.length > 0 && (
                                        <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#FFB800] uppercase tracking-wider mb-2">
                                                ⚾ Pitcher Ratings
                                            </div>
                                            {aiAnalysis.pitcher_notes.slice(0, 5).map((p, i) => (
                                                <div key={i} className="p-2 rounded-lg border border-[#223366] mb-2"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="text-xs font-bold text-white">{p.name}</span>
                                                        <span className="text-xs font-mono" style={{color:'#FFB800'}}>
                                                            {p.exposure_percentage}%
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-[#8A9BBE]">{p.note}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {aiAnalysis.global_value_plays?.length > 0 && (
                                        <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#22C55E] uppercase tracking-wider mb-2">
                                                💰 Value Plays
                                            </div>
                                            {aiAnalysis.global_value_plays.slice(0, 5).map((p, i) => (
                                                <div key={i} className="text-xs text-[#B8C5D6] mb-1">
                                                    {p.name} ({p.team}) — {p.reason}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {aiAnalysis.global_avoid?.length > 0 && (
                                        <div className="p-3 rounded-xl border border-[#223366]" style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#EF4444] uppercase tracking-wider mb-2">
                                                ⚠️ Players to Avoid
                                            </div>
                                            {aiAnalysis.global_avoid.slice(0, 5).map((p, i) => (
                                                <div key={i} className="text-xs text-[#B8C5D6] mb-1">
                                                    {p.name} — {p.reason}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {aiAnalysis.portfolio_rules && (
                                        <div className="p-3 rounded-xl border border-[#223366]"
                                            style={{background:'#132244'}}>
                                            <div className="text-xs font-bold text-[#818CF8] uppercase tracking-wider mb-2">
                                                📋 Recommended Portfolio Rules
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Max Hitter Exp</div>
                                                    <div className="font-bold text-white">
                                                        {aiAnalysis.portfolio_rules.max_hitter_exposure_pct}%
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Max Pitcher Exp</div>
                                                    <div className="font-bold text-white">
                                                        {aiAnalysis.portfolio_rules.max_pitcher_exposure_pct}%
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Min Salary</div>
                                                    <div className="font-bold text-white">
                                                        ${aiAnalysis.portfolio_rules.min_salary_used?.toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Avg Leftover</div>
                                                    <div className="font-bold text-white">
                                                        ${aiAnalysis.portfolio_rules.avg_salary_leftover}
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Unique Players</div>
                                                    <div className="font-bold text-white">
                                                        {aiAnalysis.portfolio_rules.min_unique_hitters_between_lineups}
                                                    </div>
                                                </div>
                                                <div className="p-2 rounded-lg border border-[#223366]"
                                                    style={{background:'#0A1628'}}>
                                                    <div className="text-[#8A9BBE]">Hitters vs Pitcher</div>
                                                    <div className="font-bold text-white">
                                                        {aiAnalysis.portfolio_rules.max_hitters_vs_opposing_pitcher}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-[#8A9BBE]">
                                                {aiAnalysis.portfolio_rules.stack_diversity_note}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const r = aiAnalysis.portfolio_rules
                                                    setPlayersPerTeamMax(5)
                                                    setHittersVsPitcher(r.max_hitters_vs_opposing_pitcher ?? 0)
                                                    setUniquePlayersPerLineup(r.min_unique_hitters_between_lineups || 1)
                                                    setTeamSalaryMin(r.min_salary_used?.toString() || '49500')
                                                }}
                                                className="mt-3 w-full py-2 rounded-lg text-xs font-bold transition-all"
                                                style={{
                                                    background:'rgba(99,102,241,0.1)',
                                                    color:'#818CF8',
                                                    border:'1px solid rgba(99,102,241,0.3)'
                                                }}>
                                                ✓ Apply Portfolio Rules to Game Filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Player Tabs */}
                    <div className="flex items-center gap-0 mb-3 border-b border-[#223366]">
                        {[
                            { id: 'all', label: 'ALL PLAYERS' },
                            { id: 'excluded', label: `EXCLUDED${stackRules.excludedPlayers.length > 0 ? ` (${stackRules.excludedPlayers.length})` : ''}` },
                            { id: 'liked', label: `LIKED${likedPlayers.length > 0 ? ` (${likedPlayers.length})` : ''}` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setPlayerTab(tab.id)}
                                className="px-4 py-2 text-xs font-bold tracking-wider transition-all border-b-2 -mb-px"
                                style={{
                                    borderColor: playerTab === tab.id ? '#FFB800' : 'transparent',
                                    color: playerTab === tab.id ? '#FFB800' : '#8A9BBE'
                                }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Position Filters */}
                    <div className="flex gap-2 mb-4 flex-wrap items-center">
                        {POSITIONS[sport].map(pos => (
                            <button key={pos} onClick={() => setPosFilter(pos)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                                style={{
                                    background: posFilter === pos ? 'rgba(255,184,0,0.1)' : '#132244',
                                    borderColor: posFilter === pos ? '#FFB800' : '#223366',
                                    color: posFilter === pos ? '#FFB800' : '#B8C5D6',
                                }}>
                                {pos}
                            </button>
                        ))}
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="🔍 Search players..."
                            className="ml-auto px-3 py-1.5 rounded-lg text-sm outline-none border border-[#223366] focus:border-[#FFB800] text-white transition-colors"
                            style={{ background: '#132244', width: '180px' }}
                        />
                        {Object.keys(customProjections).length > 0 && (
                            <button
                                onClick={() => setCustomProjections({})}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    borderColor: '#EF4444',
                                    color: '#EF4444'
                                }}>
                                ↺ Reset Projections
                            </button>
                        )}
                        {Object.keys(customOwnership).length > 0 && (
                            <button
                                onClick={() => setCustomOwnership({})}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    borderColor: '#818CF8',
                                    color: '#818CF8'
                                }}>
                                ↺ Reset Ownership
                            </button>
                        )}
                        {fillPool.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ml-2"
                                style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    color: '#818CF8',
                                    border: '1px solid rgba(99,102,241,0.3)'
                                }}>
                                🎯 {fillPool.length} in fill pool
                                <button
                                    onClick={() => setFillPool([])}
                                    className="ml-1 hover:text-red-400 transition-colors">
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Player Table */}
                    <div className="rounded-xl border border-[#223366] overflow-hidden"
                        style={{ background: '#0F1E38' }}>
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-[#8A9BBE] text-sm animate-pulse">Loading players...</div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <div className="text-2xl mb-2">📭</div>
                                    <div className="text-[#8A9BBE] text-sm">{error}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '600px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#223366 #0A1628' }}>
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr style={{ background: '#1A2E55', borderBottom: '1px solid #223366' }}>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider w-10"></th>
                                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Team</th>
                                        <th className="px-2 py-1.5 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Opp</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Player</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Pos</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider cursor-pointer hover:text-[#FFB800]"
                                            onClick={() => handleSort('OperatorSalary')}>
                                            Salary {sortBy === 'OperatorSalary' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider cursor-pointer hover:text-[#FFB800]"
                                            onClick={() => handleSort('ProjectedPoints')}>
                                            Proj Pts {sortBy === 'ProjectedPoints' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider cursor-pointer hover:text-[#FFB800]"
                                            onClick={() => handleSort('OwnershipProjection')}>
                                            <div>Own% {sortBy === 'OwnershipProjection' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</div>
                                            {lineups.some(l => l?.some(p => p !== null)) && (
                                                <div className="text-xs text-[#818CF8] font-normal normal-case">Exp%</div>
                                            )}
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Value</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#8A9BBE] uppercase tracking-wider">Leverage</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlayers.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="text-center py-12 text-[#8A9BBE] text-sm">
                                                No players found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPlayers.map((player, i) => {
                                            const inLineup = lineup.find(p => p?.SlatePlayerID === player.SlatePlayerID)
                                            const value = getValue(player)
                                            return (
                                                <tr key={player.SlatePlayerID || i}
                                                    className="border-b transition-colors cursor-pointer"
                                                    style={{
                                                        borderColor: 'rgba(34,51,102,0.4)',
                                                        background: inLineup
                                                            ? 'rgba(255,184,0,0.05)'
                                                            : fillPool.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                ? 'rgba(99,102,241,0.05)'
                                                                : 'transparent'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = inLineup
                                                        ? 'rgba(255,184,0,0.08)'
                                                        : fillPool.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                            ? 'rgba(99,102,241,0.1)'
                                                            : 'rgba(255,184,0,0.03)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = inLineup
                                                        ? 'rgba(255,184,0,0.05)'
                                                        : fillPool.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                            ? 'rgba(99,102,241,0.05)'
                                                            : 'transparent'}>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => inLineup ? null : addPlayer(player)}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: inLineup ? '#FFB800' : 'rgba(255,184,0,0.1)',
                                                                    color: inLineup ? '#0A1628' : '#FFB800',
                                                                    border: '1px solid rgba(255,184,0,0.3)'
                                                                }}>
                                                                {inLineup ? '✓' : '+'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const isLocked = stackRules.lockedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                    if (isLocked) {
                                                                        setStackRules(prev => ({
                                                                            ...prev,
                                                                            lockedPlayers: prev.lockedPlayers.filter(p => p.SlatePlayerID !== player.SlatePlayerID)
                                                                        }))
                                                                        const newLineup = [...lineup]
                                                                        const slotIndex = newLineup.findIndex(p => p?.SlatePlayerID === player.SlatePlayerID)
                                                                        if (slotIndex !== -1) {
                                                                            newLineup[slotIndex] = null
                                                                            setLineup(newLineup)
                                                                        }
                                                                    } else {
                                                                        setStackRules(prev => ({
                                                                            ...prev,
                                                                            lockedPlayers: [...prev.lockedPlayers, player]
                                                                        }))
                                                                        addPlayer(player)
                                                                    }
                                                                }}
                                                                title="Lock player"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: stackRules.lockedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(255,184,0,0.2)' : 'transparent',
                                                                    color: stackRules.lockedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#FFB800' : '#8A9BBE',
                                                                    border: '1px solid rgba(34,51,102,0.5)'
                                                                }}>
                                                                {stackRules.lockedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '🔒' : '🔓'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const isLiked = likedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                    setLikedPlayers(isLiked
                                                                        ? likedPlayers.filter(p => p.SlatePlayerID !== player.SlatePlayerID)
                                                                        : [...likedPlayers, player]
                                                                    )
                                                                }}
                                                                title="Like player"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: likedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(255,184,0,0.2)' : 'transparent',
                                                                    color: likedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#FFB800' : '#8A9BBE',
                                                                    border: '1px solid rgba(34,51,102,0.5)'
                                                                }}>
                                                                👍
                                                            </button>
                                                            {player.OperatorPosition !== 'SP' && player.OperatorPosition !== 'RP' && (() => {
                                                                const inFillPool = !!fillPool.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                return (
                                                                    <button
                                                                        onClick={() => {
                                                                            setFillPool(inFillPool
                                                                                ? fillPool.filter(p => p.SlatePlayerID !== player.SlatePlayerID)
                                                                                : [...fillPool, player]
                                                                            )
                                                                        }}
                                                                        title={inFillPool ? 'Remove from fill pool' : 'Add to fill pool'}
                                                                        className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                        style={{
                                                                            background: inFillPool ? '#818CF8' : 'transparent',
                                                                            color: inFillPool ? '#ffffff' : '#8A9BBE',
                                                                            border: inFillPool ? '1px solid #818CF8' : '1px solid rgba(34,51,102,0.5)',
                                                                            transform: inFillPool ? 'scale(1.1)' : 'scale(1)'
                                                                        }}>
                                                                        🎯
                                                                    </button>
                                                                )
                                                            })()}
                                                            <button
                                                                onClick={() => {
                                                                    const isExcluded = stackRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                    setStackRules(prev => ({
                                                                        ...prev,
                                                                        excludedPlayers: isExcluded
                                                                            ? prev.excludedPlayers.filter(p => p.SlatePlayerID !== player.SlatePlayerID)
                                                                            : [...prev.excludedPlayers, player]
                                                                    }))
                                                                }}
                                                                title="Exclude player"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: stackRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(239,68,68,0.2)' : 'transparent',
                                                                    color: stackRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#EF4444' : '#8A9BBE',
                                                                    border: '1px solid rgba(34,51,102,0.5)'
                                                                }}>
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs font-bold text-[#B8C5D6]">
                                                        {player.Team}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-[#8A9BBE]">
                                                        {(() => {
                                                            if (!selectedSlate?.DfsSlateGames) return '—'
                                                            const game = selectedSlate.DfsSlateGames.find(
                                                                sg => sg.SlateGameID === player.SlateGameID
                                                            )
                                                            if (!game?.Game) return '—'
                                                            return player.Team === game.Game.AwayTeam
                                                                ? game.Game.HomeTeam
                                                                : game.Game.AwayTeam
                                                        })()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                                style={{ background: '#1A2E55', border: '1px solid #223366', color: '#FFB800' }}>
                                                                {getInitials(player.OperatorPlayerName)}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs font-semibold text-white">{player.OperatorPlayerName}</span>
                                                                    {(player.OwnershipProjection < 10 && player.ProjectedPoints > 15) && (
                                                                        <span className="text-xs font-bold px-1 py-0 rounded"
                                                                            style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>
                                                                            GPP
                                                                        </span>
                                                                    )}
                                                                    {(player.OperatorPosition === 'SP' || player.OperatorPosition === 'RP') && (
                                                                        <span className="text-xs font-bold px-1 py-0 rounded"
                                                                            style={{
                                                                                background: isConfirmedStarter(player) ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                                                                color: isConfirmedStarter(player) ? '#22C55E' : '#EF4444'
                                                                            }}>
                                                                            {isConfirmedStarter(player) ? '✓ Starting' : 'Not Starting'}
                                                                        </span>
                                                                    )}
                                                                    {fillPool.find(p => p.SlatePlayerID === player.SlatePlayerID) && (
                                                                        <span className="text-xs font-bold px-1 py-0 rounded ml-1"
                                                                            style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                                                                            🎯
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold"
                                                            style={{ background: posBadgeStyle(player.OperatorPosition), color: posTextColor(player.OperatorPosition) }}>
                                                            {player.OperatorPosition}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 font-mono text-xs text-white">
                                                        ${player.OperatorSalary?.toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        {importedProjections[player.SlatePlayerID] && (
                                                            <div className="flex items-center gap-1 mb-0.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></div>
                                                                <span className="text-xs text-[#22C55E]">DFF</span>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="number"
                                                            value={customProjections[player.SlatePlayerID] !== undefined
                                                                ? customProjections[player.SlatePlayerID]
                                                                : (player.ProjectedPoints ? player.ProjectedPoints.toFixed(1) : '')}
                                                            onChange={e => setCustomProjections(prev => ({
                                                                ...prev,
                                                                [player.SlatePlayerID]: e.target.value
                                                            }))}
                                                            placeholder="—"
                                                            className="w-14 px-1 py-0.5 rounded text-xs font-bold text-center outline-none border transition-colors"
                                                            style={{
                                                                background: customProjections[player.SlatePlayerID] !== undefined
                                                                    ? 'rgba(255,184,0,0.1)' : 'transparent',
                                                                borderColor: customProjections[player.SlatePlayerID] !== undefined
                                                                    ? '#FFB800' : 'rgba(34,51,102,0.5)',
                                                                color: '#FFB800'
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={customOwnership[player.SlatePlayerID] !== undefined
                                                                        ? customOwnership[player.SlatePlayerID]
                                                                        : (getOwnership(player) > 0 ? getOwnership(player).toFixed(1) : '')}
                                                                    onChange={e => setCustomOwnership(prev => ({
                                                                        ...prev,
                                                                        [player.SlatePlayerID]: e.target.value
                                                                    }))}
                                                                    placeholder="—"
                                                                    className="w-12 px-1 py-0.5 rounded text-xs font-bold text-center outline-none border transition-colors"
                                                                    style={{
                                                                        background: customOwnership[player.SlatePlayerID] !== undefined
                                                                            ? 'rgba(99,102,241,0.1)' : 'transparent',
                                                                        borderColor: customOwnership[player.SlatePlayerID] !== undefined
                                                                            ? '#818CF8' : 'rgba(34,51,102,0.5)',
                                                                        color: '#B8C5D6'
                                                                    }}
                                                                />
                                                                <span className="text-xs text-[#8A9BBE]">%</span>
                                                            </div>
                                                            {(() => {
                                                                const exp = getPlayerExposure(player)
                                                                if (!exp || exp.total === 0) return null
                                                                return (
                                                                    <div className="text-xs font-bold text-[#FFB800]">
                                                                        {exp.pct}%
                                                                    </div>
                                                                )
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className="text-xs font-bold"
                                                            style={{ color: getValueColor(getValueScore(player)) }}>
                                                            {getValueScore(player)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className="text-xs font-bold"
                                                            style={{ color: getLeverageColor(getLeverage(player)) }}>
                                                            {getLeverage(player)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5"></td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                            </div>
                        )}
                    </div>

                    {/* Multi-Lineup Cards */}
                    {isMultiLineup && (
                        <div className="mt-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={selectAllLineups}
                                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#223366] text-[#8A9BBE] hover:border-[#FFB800] hover:text-[#FFB800] transition-all"
                                        style={{ background: '#132244' }}>
                                        ☑ Select All
                                    </button>
                                    <button
                                        onClick={deselectAllLineups}
                                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#223366] text-[#8A9BBE] transition-all"
                                        style={{ background: '#132244' }}>
                                        ☐ Deselect All
                                    </button>
                                    {selectedLineupIndices.size > 0 && (
                                        <div className="text-xs text-[#FFB800] font-bold">
                                            {selectedLineupIndices.size} selected
                                        </div>
                                    )}
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    {sentToMyLineups && (
                                        <div className="text-xs font-bold text-[#22C55E] flex items-center gap-1">
                                            ✓ Sent to My Lineups
                                        </div>
                                    )}
                                    <button
                                        onClick={sendToMyLineups}
                                        disabled={selectedLineupIndices.size === 0}
                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all border"
                                        style={{
                                            background: selectedLineupIndices.size > 0 ? 'rgba(99,102,241,0.1)' : 'transparent',
                                            borderColor: selectedLineupIndices.size > 0 ? '#818CF8' : '#223366',
                                            color: selectedLineupIndices.size > 0 ? '#818CF8' : '#8A9BBE',
                                            opacity: selectedLineupIndices.size === 0 ? 0.5 : 1
                                        }}>
                                        📋 Send to My Lineups
                                        {selectedLineupIndices.size > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                                                style={{ background: '#818CF8', color: 'white' }}>
                                                {selectedLineupIndices.size}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-lg font-black text-white">
                                        Generated Lineups
                                        <span className="ml-2 text-sm font-normal text-[#8A9BBE]">
                                            {lineups.filter(l => l && l.some(p => p !== null)).length} lineups
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={exportAllCSV}
                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all border"
                                        style={{ background: 'rgba(255,184,0,0.1)', borderColor: '#FFB800', color: '#FFB800' }}>
                                        ↓ Export All CSV
                                    </button>
                                    <button
                                        onClick={() => dkEntries.length > 0 ? exportDKEntriesCSV() : setShowDKUpload(true)}
                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all border"
                                        style={{
                                            background: dkEntries.length > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,184,0,0.1)',
                                            borderColor: dkEntries.length > 0 ? '#22C55E' : '#FFB800',
                                            color: dkEntries.length > 0 ? '#22C55E' : '#FFB800'
                                        }}>
                                        {dkEntries.length > 0
                                            ? `↓ Export DK Entries (${Math.min(dkEntries.length, lineups.filter(l => l && l.some(p => p !== null)).length)} lineups)`
                                            : '📥 Upload DK Entries CSV'
                                        }
                                    </button>
                                    <button onClick={saveLineup} disabled={saving}
                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                        style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                        {saving ? 'Saving...' : `💾 Save All (${lineups.filter(l => l && l.some(p => p !== null)).length})`}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setLineups([new Array(slots.length).fill(null)])
                                            setLineupCount(1)
                                            setActiveLineup(0)
                                        }}
                                        className="px-4 py-2 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-red-400 hover:text-red-400 transition-all">
                                        ✕ Clear All
                                    </button>
                                </div>
                            </div>

                            {/* Append Lineups */}
                            {isMultiLineup && (
                                <div className="flex flex-wrap items-center gap-3 mt-3 p-3 rounded-xl border border-[#223366]"
                                    style={{ background: '#132244' }}>

                                    <div className="text-xs text-[#8A9BBE] shrink-0">
                                        Add more lineups:
                                    </div>

                                    {stackTeam && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold shrink-0"
                                            style={{
                                                background: 'rgba(255,184,0,0.1)',
                                                color: '#FFB800',
                                                border: '1px solid rgba(255,184,0,0.3)'
                                            }}>
                                            🔗 {stackTeam} Stack
                                        </div>
                                    )}

                                    <div className="flex gap-1">
                                        {[1, 5, 10, 20, 50].map(n => (
                                            <button key={n}
                                                onClick={() => setAppendCount(n)}
                                                className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                style={{
                                                    background: appendCount === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                    borderColor: appendCount === n ? '#FFB800' : '#223366',
                                                    color: appendCount === n ? '#FFB800' : '#8A9BBE'
                                                }}>
                                                +{n}
                                            </button>
                                        ))}
                                    </div>

                                    <input
                                        type="number"
                                        min="1"
                                        max="150"
                                        value={appendCount}
                                        onChange={e => setAppendCount(parseInt(e.target.value) || 1)}
                                        className="w-16 px-2 py-1 rounded-lg text-xs font-bold text-center outline-none border border-[#223366] text-white"
                                        style={{ background: '#0A1628' }}
                                    />

                                    <button
                                        onClick={appendLineups}
                                        disabled={appending || eligiblePool.length === 0}
                                        className="px-4 py-2 rounded-lg text-xs font-black transition-all shrink-0"
                                        style={{
                                            background: 'linear-gradient(135deg, #FFB800, #E6A500)',
                                            color: '#0A1628',
                                            opacity: appending ? 0.7 : 1
                                        }}>
                                        {appending ? '⚡ Generating...' : `+ Generate ${appendCount} More`}
                                    </button>

                                    <div className="ml-auto text-xs text-[#8A9BBE] shrink-0">
                                        {lineups.filter(l => l && l.some(p => p !== null)).length} total
                                    </div>

                                    <div className="w-full mt-2 pt-2 border-t border-[#223366] flex flex-wrap gap-2">
                                        <div className="text-xs text-[#8A9BBE]">Using current filters:</div>
                                        {stackTeam && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}>
                                                🔗 {stackTeam} stack
                                            </span>
                                        )}
                                        {stackRules.lockedPlayers.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                                                🔒 {stackRules.lockedPlayers.length} locked
                                            </span>
                                        )}
                                        {fillPool.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                                                🎯 {fillPool.length} fill pool
                                            </span>
                                        )}
                                        {stackRules.excludedPlayers.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                                ✕ {stackRules.excludedPlayers.length} excluded
                                            </span>
                                        )}
                                        <span className="text-xs px-2 py-0.5 rounded font-bold"
                                            style={{ background: 'rgba(138,155,190,0.1)', color: '#8A9BBE' }}>
                                            💰 ${teamSalaryMin || 49500}-${teamSalaryMax || 50000}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {lineups
                                    .filter(l => l && l.some(p => p !== null))
                                    .filter(lu => {
                                        if (!stackFilter) return true
                                        const detected = detectStackTeam(lu)
                                        return detected?.team === stackFilter
                                    })
                                    .map((lu, lineupIndex) => {
                                        const totalSalary = lu.reduce((sum, p) => sum + (p?.OperatorSalary || 0), 0)
                                        const totalProj = lu.reduce((sum, p) => sum + (p ? getProjection(p) : 0), 0)
                                        const remaining = cap - totalSalary
                                        const detectedStack = detectStackTeam(lu)
                                        const lineupStackTeam = detectedStack?.team || null
                                        const lineupStackCount = detectedStack?.count || 0
                                        return (
                                            <div key={lineupIndex}
                                                className="rounded-xl border border-[#223366] overflow-hidden transition-all hover:border-[#FFB800]"
                                                style={{ background: '#0F1E38' }}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-[#223366] cursor-pointer"
                                                    style={{
                                                        background: selectedLineupIndices.has(lineupIndex) ? 'rgba(99,102,241,0.1)' : '#1A2E55'
                                                    }}
                                                    onClick={() => toggleLineupSelection(lineupIndex)}>
                                                    <div className="flex items-center gap-3">
                                                        {/* Checkbox */}
                                                        <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                                            style={{
                                                                borderColor: selectedLineupIndices.has(lineupIndex) ? '#818CF8' : '#223366',
                                                                background: selectedLineupIndices.has(lineupIndex) ? '#818CF8' : 'transparent'
                                                            }}>
                                                            {selectedLineupIndices.has(lineupIndex) && (
                                                                <span className="text-white text-xs font-black">✓</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-black text-white">#{lineupIndex + 1}</div>
                                                            {lineupStackTeam && (
                                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                                                    style={{
                                                                        background: 'rgba(255,184,0,0.15)',
                                                                        color: '#FFB800',
                                                                        border: '1px solid rgba(255,184,0,0.3)'
                                                                    }}>
                                                                    🔗 {lineupStackTeam} ×{lineupStackCount}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-[#8A9BBE]">Projected</div>
                                                            <div className="text-sm font-black text-[#FFB800]">{totalProj.toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3"
                                                        onClick={e => e.stopPropagation()}>
                                                        <div className="text-right">
                                                            <div className="text-xs text-[#8A9BBE]">Salary</div>
                                                            <div className="text-sm font-bold text-white">${totalSalary.toLocaleString()}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-[#8A9BBE]">Rem.</div>
                                                            <div className="text-sm font-bold"
                                                                style={{ color: remaining <= 500 ? '#22C55E' : '#8A9BBE' }}>
                                                                ${remaining.toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updated = [...lineups]
                                                                updated.splice(lineupIndex, 1)
                                                                setLineups(updated.length > 0 ? updated : [new Array(slots.length).fill(null)])
                                                                setLineupCount(prev => Math.max(1, prev - 1))
                                                            }}
                                                            className="text-[#8A9BBE] hover:text-red-400 transition-colors text-sm">
                                                            🗑
                                                        </button>
                                                    </div>
                                                </div>

                                                {lineupReasonings[lineupIndex] && (
                                                    <div className="px-4 py-2 border-b border-[#223366]"
                                                        style={{background:'rgba(99,102,241,0.05)'}}>
                                                        <div className="text-xs text-[#8A9BBE] flex items-start gap-1">
                                                            <span className="text-[#818CF8] shrink-0">🤖</span>
                                                            <span>{lineupReasonings[lineupIndex]}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr style={{ background: '#132244', borderBottom: '1px solid #223366' }}>
                                                            <th className="px-3 py-1.5 text-left text-xs font-semibold text-[#8A9BBE] uppercase w-8">Pos</th>
                                                            <th className="px-3 py-1.5 text-left text-xs font-semibold text-[#8A9BBE] uppercase">Player</th>
                                                            <th className="px-3 py-1.5 text-left text-xs font-semibold text-[#8A9BBE] uppercase">Opp</th>
                                                            <th className="px-3 py-1.5 text-right text-xs font-semibold text-[#8A9BBE] uppercase">Proj</th>
                                                            <th className="px-3 py-1.5 text-right text-xs font-semibold text-[#8A9BBE] uppercase">Salary</th>
                                                            <th className="px-3 py-1.5 text-right text-xs font-semibold text-[#8A9BBE] uppercase">Own%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {slots.map((slot, slotIndex) => {
                                                            const player = lu[slotIndex]
                                                            if (!player) return null
                                                            let opp = '—'
                                                            if (selectedSlate?.DfsSlateGames) {
                                                                const game = selectedSlate.DfsSlateGames.find(sg => sg.SlateGameID === player.SlateGameID)
                                                                if (game?.Game) {
                                                                    opp = player.Team === game.Game.AwayTeam
                                                                        ? `vs ${game.Game.HomeTeam}`
                                                                        : `@ ${game.Game.AwayTeam}`
                                                                }
                                                            }
                                                            if (player.Opponent) opp = `vs ${player.Opponent}`
                                                            return (
                                                                <tr key={slotIndex} className="border-b transition-colors"
                                                                    style={{ borderColor: 'rgba(34,51,102,0.4)', background: slotIndex % 2 === 0 ? 'transparent' : 'rgba(19,34,68,0.3)' }}>
                                                                    <td className="px-3 py-1.5">
                                                                        <span className="text-xs font-bold px-1 py-0 rounded"
                                                                            style={{ background: posBadgeStyle(player.OperatorPosition), color: posTextColor(player.OperatorPosition) }}>
                                                                            {slot}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            {lineupStackTeam && player.Team === lineupStackTeam && (
                                                                                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#FFB800]"
                                                                                    title={`${lineupStackTeam} stack player`} />
                                                                            )}
                                                                            {stackRules.lockedPlayers.find(lp => lp.SlatePlayerID === player.SlatePlayerID) && (
                                                                                <span className="text-xs shrink-0" title="Locked">🔒</span>
                                                                            )}
                                                                            {fillPool.find(fp => fp.SlatePlayerID === player.SlatePlayerID) && (
                                                                                <span className="text-xs shrink-0" title="Fill pool">🎯</span>
                                                                            )}
                                                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                                                                style={{
                                                                                    background: lineupStackTeam && player.Team === lineupStackTeam ? 'rgba(255,184,0,0.2)' : '#1A2E55',
                                                                                    color: '#FFB800',
                                                                                    fontSize: '9px',
                                                                                    border: lineupStackTeam && player.Team === lineupStackTeam ? '1px solid rgba(255,184,0,0.4)' : '1px solid #223366'
                                                                                }}>
                                                                                {getInitials(player.OperatorPlayerName)}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-semibold leading-tight"
                                                                                    style={{ color: lineupStackTeam && player.Team === lineupStackTeam ? '#FFB800' : '#ffffff' }}>
                                                                                    {player.OperatorPlayerName}
                                                                                </div>
                                                                                <div className="text-xs text-[#8A9BBE]">{player.Team}</div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-xs text-[#8A9BBE]">{opp}</td>
                                                                    <td className="px-3 py-1.5 text-right">
                                                                        <span className="text-xs font-bold text-[#FFB800]">
                                                                            {getProjection(player) > 0 ? getProjection(player).toFixed(1) : '—'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right">
                                                                        <span className="text-xs font-mono text-white">${player.OperatorSalary?.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right">
                                                                        <span className="text-xs text-[#B8C5D6]">
                                                                            {getOwnership(player) > 0 ? `${getOwnership(player).toFixed(1)}%` : '—'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: '#132244', borderTop: '1px solid #223366' }}>
                                                            <td colSpan={3} className="px-3 py-2 text-xs font-bold text-[#8A9BBE]">Totals</td>
                                                            <td className="px-3 py-2 text-right text-xs font-black text-[#FFB800]">{totalProj.toFixed(2)}</td>
                                                            <td className="px-3 py-2 text-right text-xs font-black text-white">${totalSalary.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-xs text-[#8A9BBE]">
                                                                {(lu.reduce((sum, p) => sum + (getOwnership(p) || 0), 0) / lu.filter(p => p).length).toFixed(1)}%
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )
                                    })}
                            </div>

                            {isMultiLineup && (
                                <div className="mt-3 p-3 rounded-xl border border-[#223366]"
                                    style={{ background: '#132244' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-bold text-white">Stacks used:</div>
                                        {stackFilter && (
                                            <button
                                                onClick={() => setStackFilter(null)}
                                                className="text-xs text-[#FFB800] hover:underline flex items-center gap-1">
                                                ✕ Show all lineups
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(() => {
                                            const stackSummary = {}
                                            lineups
                                                .filter(l => l && l.some(p => p !== null))
                                                .forEach(lu => {
                                                    const s = detectStackTeam(lu)
                                                    if (s) stackSummary[s.team] = (stackSummary[s.team] || 0) + 1
                                                })
                                            return Object.entries(stackSummary)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([team, count]) => {
                                                    const isActive = stackFilter === team
                                                    return (
                                                        <button
                                                            key={team}
                                                            onClick={() => setStackFilter(isActive ? null : team)}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                                            style={{
                                                                background: isActive ? 'rgba(255,184,0,0.15)' : '#0A1628',
                                                                borderColor: isActive ? '#FFB800' : '#223366',
                                                                color: isActive ? '#FFB800' : '#B8C5D6'
                                                            }}>
                                                            <div className="w-2 h-2 rounded-full"
                                                                style={{ background: isActive ? '#FFB800' : '#8A9BBE' }} />
                                                            {team}
                                                            <span className="px-1.5 py-0.5 rounded-full"
                                                                style={{
                                                                    background: isActive ? 'rgba(255,184,0,0.2)' : '#223366',
                                                                    color: isActive ? '#FFB800' : '#8A9BBE'
                                                                }}>
                                                                {count}
                                                            </span>
                                                        </button>
                                                    )
                                                })
                                        })()}
                                    </div>
                                    {stackFilter && (
                                        <div className="mt-2 text-xs text-[#8A9BBE]">
                                            Showing{' '}
                                            <span className="text-[#FFB800] font-bold">
                                                {lineups.filter(l => {
                                                    if (!l || !l.some(p => p !== null)) return false
                                                    const d = detectStackTeam(l)
                                                    return d?.team === stackFilter
                                                }).length}
                                            </span>
                                            {' '}{stackFilter} lineups
                                        </div>
                                    )}
                                    {stackRules.lockedPlayers.length > 0 && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8A9BBE]">
                                            <span>🔒</span>
                                            <span>{stackRules.lockedPlayers.length} locked players in all lineups</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isMultiLineup && (() => {
                                const validLineups = lineups.filter(l => l && l.some(p => p !== null))
                                if (validLineups.length === 0) return null
                                const exposureMap = {}
                                validLineups.forEach(lu => {
                                    lu.forEach(p => {
                                        if (!p) return
                                        if (!exposureMap[p.SlatePlayerID]) exposureMap[p.SlatePlayerID] = { player: p, count: 0 }
                                        exposureMap[p.SlatePlayerID].count++
                                    })
                                })
                                const sorted = Object.values(exposureMap)
                                    .map(e => ({ ...e, pct: Math.round((e.count / validLineups.length) * 100) }))
                                    .sort((a, b) => b.pct - a.pct)
                                    .slice(0, 20)
                                return (
                                    <div className="mt-4 p-4 rounded-xl border border-[#223366]"
                                        style={{background:'#0F1E38'}}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="text-sm font-bold text-white">📊 Player Exposure</div>
                                            <div className="text-xs text-[#8A9BBE]">{validLineups.length} lineups</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {sorted.map(({ player, pct }) => (
                                                <div key={player.SlatePlayerID}
                                                    className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-[#223366]"
                                                    style={{background:'#132244'}}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-xs text-[#8A9BBE] shrink-0">{player.OperatorPosition}</span>
                                                        <span className="text-xs font-semibold text-white truncate">{player.OperatorPlayerName}</span>
                                                        <span className="text-xs text-[#8A9BBE] shrink-0">{player.Team}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-[#FFB800] shrink-0 ml-2">{pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}

                            {saveSuccess && (
                                <div className="mt-4 py-3 rounded-xl text-sm font-bold text-center"
                                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                                    ✓ All lineups saved successfully!
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {!isMultiLineup && (
                <aside className="w-72 shrink-0 border-l border-[#223366] sticky top-14 h-[calc(100vh-56px)] overflow-y-auto flex flex-col"
                    style={{ background: '#0F1E38' }}>

                    {/* Stats Header */}
                    <div className="px-4 py-3 border-b border-[#223366]" style={{ background: '#1A2E55' }}>
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <div className="text-xs text-[#8A9BBE]">Salary Rem.</div>
                                <div className="text-sm font-black text-white">${remainingSalary.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[#8A9BBE]">FP Proj.</div>
                                <div className="text-sm font-black text-[#FFB800]">{projectedPoints.toFixed(1)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[#8A9BBE]">Value</div>
                                <div className="text-sm font-black text-white">{valueScore}x</div>
                            </div>
                            <div className="flex items-center justify-end">
                                <button className="text-[#8A9BBE] hover:text-[#FFB800] transition-colors text-lg">♡</button>
                            </div>
                        </div>
                    </div>

                    {/* Lineup Tabs */}
                    <div className="border-b border-[#223366] overflow-x-auto shrink-0">
                        <div className="flex min-w-max">
                            {Array.from({ length: lineupCount }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveLineup(i)}
                                    className="px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all"
                                    style={{
                                        borderColor: activeLineup === i ? '#FFB800' : 'transparent',
                                        color: activeLineup === i ? '#FFB800' : '#8A9BBE'
                                    }}>
                                    Line {i + 1}
                                </button>
                            ))}
                            {lineupCount < 150 && (
                                <button
                                    onClick={() => {
                                        setLineupCount(prev => prev + 1)
                                        setActiveLineup(lineupCount)
                                        setLineups(prev => [...prev, new Array(slots.length).fill(null)])
                                    }}
                                    className="px-3 py-2.5 text-xs font-bold text-[#8A9BBE] hover:text-[#FFB800] transition-colors whitespace-nowrap">
                                    + Add
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lineup Slots */}
                    <div className="flex-1 overflow-y-auto">
                        {slots.map((slot, i) => {
                            const player = lineup[i]
                            return (
                                <div key={i}
                                    className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[#1A2E55]"
                                    style={{ borderColor: 'rgba(34,51,102,0.4)' }}>
                                    <span className="text-xs font-black w-8 shrink-0"
                                        style={{ color: player ? '#FFB800' : '#8A9BBE' }}>
                                        {slot}
                                    </span>
                                    {player ? (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold text-white truncate">
                                                    {player.OperatorPlayerName}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-[#8A9BBE]">{player.Team}</span>
                                                    <span className="text-xs font-mono text-[#8A9BBE]">${player.OperatorSalary?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-bold text-[#FFB800]">
                                                    {player.ProjectedPoints ? player.ProjectedPoints.toFixed(1) : '—'}
                                                </div>
                                                <button onClick={() => removePlayer(i)}
                                                    className="text-xs text-[#8A9BBE] hover:text-red-400 transition-colors mt-0.5 block">
                                                    ✕
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-xs tracking-wider" style={{ color: 'rgba(138,155,190,0.4)' }}>
                                            MAKE A PICK
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-3 border-t border-[#223366] shrink-0" style={{ background: '#132244' }}>

                        {/* Lineup count selector */}
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-[#8A9BBE]">Lineups to generate</div>
                            <div className="flex items-center gap-1">
                                {[1, 5, 10, 20, 50, 150].map(n => (
                                    <button key={n}
                                        onClick={() => setLineupCount(n)}
                                        className="px-2 py-1 rounded text-xs font-bold border transition-all"
                                        style={{
                                            background: lineupCount === n ? 'rgba(255,184,0,0.1)' : 'transparent',
                                            borderColor: lineupCount === n ? '#FFB800' : '#223366',
                                            color: lineupCount === n ? '#FFB800' : '#8A9BBE'
                                        }}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-xs text-[#8A9BBE] mb-3">
                            Note: AI Build Lineups is capped at 30 per run for cost/quality
                        </div>

                        {saveSuccess && (
                            <div className="w-full py-2 rounded-lg text-xs font-bold text-center mb-2"
                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                                ✓ Lineup saved!
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                    background: fillPool.length > 0 && stackTeam
                                        ? '#818CF8' : '#22C55E'
                                }}>
                            </div>
                            <div className="text-xs"
                                style={{ color: '#8A9BBE' }}>
                                {fillPool.length > 0 && stackTeam
                                    ? `Fill pool active — ${fillPool.length} players for non-stack slots`
                                    : 'Using full player pool for all slots'
                                }
                            </div>
                        </div>
                        <button
                            onClick={generateAllLineups}
                            disabled={players.length === 0 || loading}
                            className="w-full py-3 rounded-lg text-sm font-black mb-2 tracking-wider transition-all"
                            style={{
                                background: 'linear-gradient(135deg, #FFB800, #E6A500)',
                                color: '#0A1628',
                                opacity: (players.length === 0 || loading) ? 0.7 : 1
                            }}>
                            {loading ? '⚡ Optimizing...' : 'OPTIMIZE'}
                        </button>

                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => {
                                    const updated = [...lineups]
                                    updated[activeLineup] = new Array(slots.length).fill(null)
                                    setLineups(updated)
                                }}
                                className="flex-1 py-2 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-red-400 hover:text-red-400 transition-all flex items-center justify-center gap-1"
                                style={{ background: 'transparent' }}>
                                ⊘ RESET
                            </button>
                            <button
                                onClick={() => { setGameFiltersTab('stack'); setShowGameFilters(true) }}
                                className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1"
                                style={{
                                    background: stackTeam ? 'rgba(255,184,0,0.1)' : 'transparent',
                                    borderColor: stackTeam ? '#FFB800' : '#223366',
                                    color: stackTeam ? '#FFB800' : '#8A9BBE'
                                }}>
                                ≡ STACK
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={saveLineup}
                                disabled={saving || lineup.every(p => !p)}
                                className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all"
                                style={{
                                    background: 'rgba(255,184,0,0.1)',
                                    color: '#FFB800',
                                    border: '1px solid rgba(255,184,0,0.3)',
                                    opacity: lineup.every(p => !p) ? 0.5 : 1
                                }}>
                                {saving
    ? 'Saving...'
    : `💾 Save${lineups.filter(l => l && l.some(p => p !== null)).length > 1
        ? ` (${lineups.filter(l => l && l.some(p => p !== null)).length})`
        : ''}`
}
                            </button>
                            <button
                                onClick={exportAllCSV}
                                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                style={{ background: 'transparent', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                                ↓ CSV
                            </button>
                            <button
                                onClick={() => dkEntries.length > 0 ? exportDKEntriesCSV() : setShowDKUpload(true)}
                                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                style={{
                                    background: dkEntries.length > 0 ? 'rgba(34,197,94,0.1)' : 'transparent',
                                    color: dkEntries.length > 0 ? '#22C55E' : '#8A9BBE',
                                    border: dkEntries.length > 0 ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(34,51,102,0.5)'
                                }}>
                                {dkEntries.length > 0 ? '↓ DK' : '📥 DK'}
                            </button>
                        </div>
                        {dkEntries.length > 0 && (
                            <div className="flex items-center gap-2 mt-1 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                                <div className="text-xs text-[#8A9BBE]">
                                    <span className="text-[#22C55E] font-bold">{dkEntries.length} DK entries</span> loaded · ready to export
                                </div>
                                <button
                                    onClick={() => { setDkEntries([]); setDkPlayerPool([]); setDkEntriesCSV(null); setDkMatchStatus(null) }}
                                    className="text-xs text-[#EF4444] hover:underline ml-auto">
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </aside>
                )}
            </div>

            {/* Game Filters Overlay */}
            {showGameFilters && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setShowGameFilters(false)} />

                    <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-[#223366] overflow-hidden"
                        style={{ background: '#0F1E38', width: '420px' }}>

                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#223366]"
                            style={{ background: '#1A2E55' }}>
                            <div className="text-base font-black text-white">⚙️ Game Filters</div>
                            <button onClick={() => setShowGameFilters(false)}
                                className="text-[#8A9BBE] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#223366]">
                                ✕
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#223366] shrink-0">
                            {[
                                { id: 'rules', label: '⚙️ Rules' },
                                { id: 'stack', label: '🔗 Stack' },
                                { id: 'fillpool', label: '🎯 Fill Pool' },
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setGameFiltersTab(tab.id)}
                                    className="flex-1 py-3 text-xs font-bold border-b-2 transition-all"
                                    style={{
                                        borderColor: gameFiltersTab === tab.id ? '#FFB800' : 'transparent',
                                        color: gameFiltersTab === tab.id ? '#FFB800' : '#8A9BBE',
                                        background: gameFiltersTab === tab.id ? 'rgba(255,184,0,0.05)' : 'transparent'
                                    }}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-5">

                            {/* RULES TAB */}
                            {gameFiltersTab === 'rules' && (
                                <div className="space-y-5">

                                    <div className="pb-4 border-b border-[#223366]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs font-bold text-white">Unique Players per Lineup</div>
                                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                                                style={{ background: 'rgba(138,155,190,0.2)', color: '#8A9BBE' }}
                                                title="Minimum players that must differ between lineups">i</div>
                                        </div>
                                        <select value={uniquePlayersPerLineup}
                                            onChange={e => setUniquePlayersPerLineup(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] text-white"
                                            style={{ background: '#0A1628' }}>
                                            {[1,2,3,4,5,6,7,8].map(n => (
                                                <option key={n} value={n}>{n} unique player{n > 1 ? 's' : ''}{n === 1 ? ' (Default)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pb-4 border-b border-[#223366]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="text-xs font-bold text-white">Team Salary</div>
                                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                                                style={{ background: 'rgba(138,155,190,0.2)', color: '#8A9BBE' }}
                                                title="Salary range for generated lineups">i</div>
                                        </div>
                                        <div className="text-xs text-[#8A9BBE] mb-2">Default: $49,500 – ${cap.toLocaleString()}</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-xs text-[#8A9BBE] mb-1">MIN</div>
                                                <input type="number" value={teamSalaryMin}
                                                    onChange={e => setTeamSalaryMin(e.target.value)}
                                                    placeholder="49500"
                                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                                    style={{ background: '#0A1628' }} />
                                            </div>
                                            <div>
                                                <div className="text-xs text-[#8A9BBE] mb-1">MAX</div>
                                                <input type="number" value={teamSalaryMax}
                                                    onChange={e => setTeamSalaryMax(e.target.value)}
                                                    placeholder="50000"
                                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                                    style={{ background: '#0A1628' }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pb-4 border-b border-[#223366]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs font-bold text-white">Hitters vs Pitcher</div>
                                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                                                style={{ background: 'rgba(138,155,190,0.2)', color: '#8A9BBE' }}
                                                title="Max hitters batting against your pitcher">i</div>
                                        </div>
                                        <select value={hittersVsPitcher}
                                            onChange={e => setHittersVsPitcher(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] text-white"
                                            style={{ background: '#0A1628' }}>
                                            <option value={0}>max 0 Hitters (Default)</option>
                                            <option value={1}>max 1 Hitter</option>
                                            <option value={2}>max 2 Hitters</option>
                                            <option value={3}>max 3 Hitters</option>
                                            <option value={4}>max 4 Hitters</option>
                                        </select>
                                    </div>

                                    <div className="pb-4 border-b border-[#223366]">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs font-bold text-white mb-2">Max per Team</div>
                                                <div className="flex gap-1 flex-wrap">
                                                    {[3,4,5,6,7,8].map(n => (
                                                        <button key={n} onClick={() => setPlayersPerTeamMax(n)}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: playersPerTeamMax === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: playersPerTeamMax === n ? '#FFB800' : '#223366',
                                                                color: playersPerTeamMax === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white mb-2">Max per Game</div>
                                                <div className="flex gap-1 flex-wrap">
                                                    {[4,5,6,7,8].map(n => (
                                                        <button key={n} onClick={() => setPlayersPerGameMax(n)}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: playersPerGameMax === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: playersPerGameMax === n ? '#FFB800' : '#223366',
                                                                color: playersPerGameMax === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pb-4 border-b border-[#223366]">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs font-bold text-white mb-2">Min from same team</div>
                                                <div className="flex gap-1">
                                                    {[0,2,3,4].map(n => (
                                                        <button key={n} onClick={() => setStackRules(prev => ({ ...prev, minFromSameTeam: n }))}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: stackRules.minFromSameTeam === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: stackRules.minFromSameTeam === n ? '#FFB800' : '#223366',
                                                                color: stackRules.minFromSameTeam === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white mb-2">Max from same team</div>
                                                <div className="flex gap-1">
                                                    {[3,4,5,6].map(n => (
                                                        <button key={n} onClick={() => setStackRules(prev => ({ ...prev, maxFromSameTeam: n }))}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: stackRules.maxFromSameTeam === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: stackRules.maxFromSameTeam === n ? '#FFB800' : '#223366',
                                                                color: stackRules.maxFromSameTeam === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {stackRules.lockedPlayers.length > 0 && (
                                        <div className="pb-4 border-b border-[#223366]">
                                            <div className="text-xs text-[#22C55E] font-bold mb-2">🔒 Locked Players</div>
                                            <div className="flex flex-wrap gap-1">
                                                {stackRules.lockedPlayers.map(p => (
                                                    <span key={p.SlatePlayerID}
                                                        className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1"
                                                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                                                        {p.OperatorPlayerName}
                                                        <button onClick={() => setStackRules(prev => ({ ...prev, lockedPlayers: prev.lockedPlayers.filter(lp => lp.SlatePlayerID !== p.SlatePlayerID) }))}
                                                            className="hover:text-white ml-1">✕</button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {stackRules.excludedPlayers.length > 0 && (
                                        <div className="pb-4 border-b border-[#223366]">
                                            <div className="text-xs text-[#EF4444] font-bold mb-2">✕ Excluded Players</div>
                                            <div className="flex flex-wrap gap-1">
                                                {stackRules.excludedPlayers.map(p => (
                                                    <span key={p.SlatePlayerID}
                                                        className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1"
                                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                        {p.OperatorPlayerName}
                                                        <button onClick={() => setStackRules(prev => ({ ...prev, excludedPlayers: prev.excludedPlayers.filter(ep => ep.SlatePlayerID !== p.SlatePlayerID) }))}
                                                            className="hover:text-white ml-1">✕</button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setStackRules({ minFromSameTeam: 0, maxFromSameTeam: 5, lockedPlayers: [], excludedPlayers: [] })
                                            setUniquePlayersPerLineup(1)
                                            setTeamSalaryMin('49500')
                                            setTeamSalaryMax('50000')
                                            setHittersVsPitcher(0)
                                            setPlayersPerTeamMax(5)
                                            setPlayersPerGameMax(8)
                                        }}
                                        className="text-xs text-[#8A9BBE] hover:text-[#EF4444] transition-colors">
                                        ↺ Reset All Rules
                                    </button>
                                </div>
                            )}

                            {/* STACK TAB */}
                            {gameFiltersTab === 'stack' && (
                                <div>
                                    <div className="text-xs text-[#8A9BBE] mb-4">
                                        Set what percentage of your {lineupCount} lineups should use each team as the primary stack of 5 hitters.
                                    </div>

                                    {/* Total Exposure Indicator */}
                                    <div className="flex items-center justify-between mb-4 p-3 rounded-xl border"
                                        style={{
                                            background: '#0A1628',
                                            borderColor: getExposureColor(getTotalExposure())
                                        }}>
                                        <div>
                                            <div className="text-xs text-[#8A9BBE]">Total Exposure</div>
                                            <div className="text-2xl font-black"
                                                style={{ color: getExposureColor(getTotalExposure()) }}>
                                                {getTotalExposure().toFixed(0)}%
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-[#8A9BBE]">Lineups Assigned</div>
                                            <div className="text-lg font-black text-white">
                                                {Object.entries(stackExposures).reduce((sum, [team, pct]) =>
                                                    sum + getLineupCountForTeam(team), 0
                                                )} / {lineupCount}
                                            </div>
                                        </div>
                                        <div>
                                            {getTotalExposure() > 100 && (
                                                <div className="text-xs text-[#EF4444] font-bold">⚠ Over 100%</div>
                                            )}
                                            {getTotalExposure() === 100 && (
                                                <div className="text-xs text-[#22C55E] font-bold">✓ Perfect</div>
                                            )}
                                            {getTotalExposure() < 100 && getTotalExposure() > 0 && (
                                                <div className="text-xs text-[#FFB800] font-bold">
                                                    {(100 - getTotalExposure()).toFixed(0)}% unassigned
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Exposure Bar */}
                                    <div className="mb-4 h-3 rounded-full overflow-hidden flex"
                                        style={{ background: '#223366' }}>
                                        {Object.entries(stackExposures)
                                            .filter(([_, pct]) => parseFloat(pct) > 0)
                                            .map(([team, pct], i) => {
                                                const colors = [
                                                    '#FFB800', '#22C55E', '#818CF8', '#F472B6',
                                                    '#FB923C', '#2DD4BF', '#EF4444', '#A78BFA'
                                                ]
                                                return (
                                                    <div key={team}
                                                        style={{
                                                            width: `${Math.min(parseFloat(pct), 100)}%`,
                                                            background: colors[i % colors.length],
                                                            transition: 'width 0.3s ease'
                                                        }}
                                                        title={`${team}: ${pct}%`}
                                                    />
                                                )
                                            })
                                        }
                                    </div>

                                    {/* Quick Presets */}
                                    <div className="flex gap-2 mb-4 flex-wrap">
                                        <div className="text-xs text-[#8A9BBE] w-full">Quick distribute:</div>
                                        {[
                                            {
                                                label: 'Equal Split', action: () => {
                                                    const teams = getTeams()
                                                    const pct = (100 / teams.length).toFixed(1)
                                                    const newExp = {}
                                                    teams.forEach(t => newExp[t] = pct)
                                                    setStackExposures(newExp)
                                                }
                                            },
                                            { label: 'Clear All', action: () => setStackExposures({}) },
                                            {
                                                label: 'Top 3 Only', action: () => {
                                                    const teams = getTeams().slice(0, 3)
                                                    const newExp = {}
                                                    teams.forEach((t, i) => newExp[t] = i === 0 ? '50' : i === 1 ? '30' : '20')
                                                    setStackExposures(newExp)
                                                }
                                            },
                                        ].map(preset => (
                                            <button key={preset.label}
                                                onClick={preset.action}
                                                className="px-3 py-1 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-[#FFB800] hover:text-[#FFB800] transition-all"
                                                style={{ background: '#0A1628' }}>
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Team List */}
                                    <div className="space-y-2">
                                        {getTeams().map((team, teamIndex) => {
                                            const pct = parseFloat(stackExposures[team]) || 0
                                            const lineupCount4Team = getLineupCountForTeam(team)
                                            const colors = [
                                                '#FFB800', '#22C55E', '#818CF8', '#F472B6',
                                                '#FB923C', '#2DD4BF', '#EF4444', '#A78BFA'
                                            ]
                                            const color = pct > 0 ? colors[
                                                Object.keys(stackExposures)
                                                    .filter(t => parseFloat(stackExposures[t]) > 0)
                                                    .indexOf(team) % colors.length
                                            ] : '#8A9BBE'

                                            const teamHitters = players.filter(p =>
                                                p.Team === team &&
                                                p.OperatorPosition !== 'SP' &&
                                                p.OperatorPosition !== 'RP'
                                            )

                                            return (
                                                <div key={team}
                                                    className="p-3 rounded-xl border transition-all"
                                                    style={{
                                                        background: pct > 0 ? 'rgba(255,184,0,0.03)' : '#0A1628',
                                                        borderColor: pct > 0 ? color : '#223366'
                                                    }}>
                                                    <div className="flex items-center gap-3">

                                                        {/* Team Name */}
                                                        <div className="w-12 shrink-0">
                                                            <div className="text-sm font-black"
                                                                style={{ color: pct > 0 ? color : '#B8C5D6' }}>
                                                                {team}
                                                            </div>
                                                            <div className="text-xs text-[#8A9BBE]">
                                                                {teamHitters.length} hitters
                                                            </div>
                                                        </div>

                                                        {/* Toggle */}
                                                        <button
                                                            onClick={() => {
                                                                if (pct > 0) {
                                                                    const newExp = { ...stackExposures }
                                                                    delete newExp[team]
                                                                    setStackExposures(newExp)
                                                                } else {
                                                                    setStackExposures(prev => ({
                                                                        ...prev,
                                                                        [team]: '20'
                                                                    }))
                                                                }
                                                            }}
                                                            className="w-10 h-5 rounded-full transition-all shrink-0 relative"
                                                            style={{ background: pct > 0 ? color : '#223366' }}>
                                                            <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                                                                style={{ left: pct > 0 ? '22px' : '2px' }} />
                                                        </button>

                                                        {/* Percentage Slider + Input */}
                                                        {pct > 0 ? (
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    step="5"
                                                                    value={pct}
                                                                    onChange={e => setStackExposures(prev => ({
                                                                        ...prev,
                                                                        [team]: e.target.value
                                                                    }))}
                                                                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                                                                    style={{
                                                                        background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #223366 ${pct}%, #223366 100%)`
                                                                    }}
                                                                />
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={pct}
                                                                        onChange={e => setStackExposures(prev => ({
                                                                            ...prev,
                                                                            [team]: e.target.value
                                                                        }))}
                                                                        className="w-12 px-1 py-0.5 rounded text-xs font-bold text-center outline-none border border-[#223366] text-white"
                                                                        style={{ background: '#132244' }}
                                                                    />
                                                                    <span className="text-xs text-[#8A9BBE]">%</span>
                                                                </div>
                                                                <div className="text-xs shrink-0"
                                                                    style={{ color, minWidth: '60px' }}>
                                                                    {lineupCount4Team} lineups
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 text-xs text-[#8A9BBE]">
                                                                Click toggle to include in stacks
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Unassigned lineups note */}
                                    {getTotalExposure() < 100 && getTotalExposure() > 0 && (
                                        <div className="mt-3 p-3 rounded-lg border border-[#223366]"
                                            style={{ background: '#0A1628' }}>
                                            <div className="text-xs text-[#8A9BBE]">
                                                <span className="text-[#FFB800] font-bold">
                                                    {lineupCount - Object.entries(stackExposures).reduce(
                                                        (sum, [t, p]) => sum + getLineupCountForTeam(t), 0
                                                    )} lineups
                                                </span> will use the best available stack from the full player pool
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* FILL POOL TAB */}
                            {gameFiltersTab === 'fillpool' && (
                                <div>
                                    <div className="text-xs text-[#8A9BBE] mb-4">
                                        Players used to fill the 3 remaining slots outside your stack and pitchers. If empty, optimizer picks best available.
                                    </div>

                                    {fillPool.length === 0 ? (
                                        <div className="text-center py-8 rounded-xl border border-dashed border-[#223366]">
                                            <div className="text-3xl mb-2">🎯</div>
                                            <div className="text-sm font-bold text-white mb-1">No players in fill pool</div>
                                            <div className="text-xs text-[#8A9BBE]">Click the 🎯 icon on any hitter in the player table to add them</div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-xs font-bold text-[#FFB800]">{fillPool.length} players in pool</div>
                                                <button onClick={() => setFillPool([])} className="text-xs text-[#EF4444] hover:underline">Clear All</button>
                                            </div>
                                            <div className="space-y-1.5">
                                                {fillPool.map((player, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-[#223366]"
                                                        style={{ background: '#132244' }}>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-semibold text-white truncate">{player.OperatorPlayerName}</div>
                                                            <div className="text-xs text-[#8A9BBE]">{player.Team} · {player.OperatorPosition}</div>
                                                        </div>
                                                        <div className="text-xs font-mono text-white shrink-0">${player.OperatorSalary?.toLocaleString()}</div>
                                                        <div className="text-xs font-bold text-[#FFB800] shrink-0">
                                                            {getProjection(player) > 0 ? getProjection(player).toFixed(1) : '—'}
                                                        </div>
                                                        <button onClick={() => setFillPool(fillPool.filter(p => p.SlatePlayerID !== player.SlatePlayerID))}
                                                            className="text-[#8A9BBE] hover:text-red-400 transition-colors shrink-0">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-[#223366]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full shrink-0"
                                                style={{ background: fillPool.length > 0 && stackTeam ? '#818CF8' : '#22C55E' }} />
                                            <div className="text-xs text-[#8A9BBE]">
                                                {fillPool.length > 0 && stackTeam
                                                    ? `Fill pool active — ${fillPool.length} players for non-stack slots`
                                                    : 'Using full player pool for non-stack slots'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Panel Footer */}
                        <div className="px-5 py-4 border-t border-[#223366] shrink-0" style={{ background: '#132244' }}>
                            <button onClick={() => setShowGameFilters(false)}
                                className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
                                style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                Apply & Close
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* DK Entries Upload Modal */}
            {showDKUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)' }}>
                    <div className="w-full max-w-lg p-6 rounded-2xl border border-[#223366] mx-4"
                        style={{ background: '#132244' }}>

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-lg font-black text-white">📥 Upload DKEntries CSV</div>
                                <div className="text-xs text-[#8A9BBE] mt-1">
                                    Download from DraftKings → Upload to DFSSZN → We replace lineups → Re-upload to DraftKings
                                </div>
                            </div>
                            <button onClick={() => setShowDKUpload(false)}
                                className="text-[#8A9BBE] hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#223366]">
                                ✕
                            </button>
                        </div>

                        <div className="mb-4 p-3 rounded-xl border border-[#223366]"
                            style={{ background: '#0A1628' }}>
                            <div className="text-xs font-bold text-white mb-2">How it works</div>
                            <div className="space-y-1.5">
                                {[
                                    '1. Go to DraftKings → My Contests → Upload Lineups',
                                    '2. Download your DKEntries.csv file',
                                    '3. Upload it here',
                                    '4. Generate lineups in DFSSZN',
                                    '5. Click Export DK Entries',
                                    '6. Upload the new CSV back to DraftKings'
                                ].map((step, i) => (
                                    <div key={i} className="text-xs text-[#FFB800]">{step}</div>
                                ))}
                            </div>
                        </div>

                        <label
                            className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#FFB800]"
                            style={{ borderColor: '#223366', background: '#0A1628' }}>
                            <div className="text-4xl mb-3">📄</div>
                            <div className="text-sm font-bold text-white mb-1">Click to upload DKEntries.csv</div>
                            <div className="text-xs text-[#8A9BBE]">Download from DraftKings contest page</div>
                            <input type="file" accept=".csv" onChange={handleDKEntriesUpload} className="hidden" />
                        </label>

                        {dkMatchStatus && (
                            <div className="mt-3 p-3 rounded-lg border border-[#223366]"
                                style={{ background: '#0A1628' }}>
                                <div className="text-xs font-bold text-[#22C55E] mb-1">✓ CSV Loaded</div>
                                <div className="text-xs text-[#8A9BBE]">
                                    {dkMatchStatus.entries} entries · {dkMatchStatus.players} players in DK pool
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Slate Upload Modal */}
            {showSlateUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="w-full max-w-md p-6 rounded-2xl border border-[#223366] mx-4"
                        style={{ background: '#132244' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-lg font-black text-white">📄 Upload Manual Slate</div>
                                <div className="text-xs text-[#8A9BBE] mt-1">Upload a DFF or custom CSV cheatsheet</div>
                            </div>
                            <button
                                onClick={() => setShowSlateUpload(false)}
                                className="text-[#8A9BBE] hover:text-white transition-colors text-xl">
                                ✕
                            </button>
                        </div>

                        <label
                            className="flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#FFB800]"
                            style={{ borderColor: '#223366', background: '#0A1628' }}>
                            <div className="text-4xl mb-3">📄</div>
                            <div className="text-sm font-bold text-white mb-1">Click to upload CSV</div>
                            <div className="text-xs text-[#8A9BBE] text-center px-4">
                                Supports DFF cheatsheet format with columns:<br />
                                first_name, last_name, position, team, salary, ppg_projection
                            </div>
                            <input type="file" accept=".csv" onChange={handleManualSlateUpload} className="hidden" />
                        </label>

                        <div className="mt-4 p-3 rounded-lg border border-[#223366]"
                            style={{ background: '#0A1628' }}>
                            <div className="text-xs font-bold text-[#8A9BBE] uppercase tracking-wider mb-2">
                                Required Columns
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {['first_name', 'last_name', 'position', 'team', 'salary', 'ppg_projection'].map(col => (
                                    <span key={col} className="px-2 py-0.5 rounded text-xs font-mono"
                                        style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}>
                                        {col}
                                    </span>
                                ))}
                            </div>
                            <div className="text-xs text-[#8A9BBE] mt-2">
                                Optional: opp, ownership_projection, value_projection, confirmed_order, over_under, implied_team_score
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAiCountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{background:'rgba(0,0,0,0.75)'}}>
                    <div className="w-full max-w-sm p-6 rounded-2xl border border-[#223366] mx-4"
                        style={{background:'#132244'}}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-black text-white">
                                🤖 AI Build Lineups
                            </div>
                            <button onClick={() => setShowAiCountModal(false)}
                                className="text-[#8A9BBE] hover:text-white text-xl">
                                ✕
                            </button>
                        </div>

                        <div className="text-xs text-[#8A9BBE] mb-3">
                            How many lineups should Claude build? Each strategy (Chalk, High Total, Leverage, Contrarian, etc) will get a small slice — capped at 10-15% of the total per strategy.
                        </div>

                        <div className="flex gap-2 mb-3">
                            {[10, 20, 30, 50].map(n => (
                                <button key={n}
                                    onClick={() => setAiLineupCountInput(n)}
                                    className="flex-1 py-2 rounded-lg text-sm font-bold border transition-all"
                                    style={{
                                        background: aiLineupCountInput === n
                                            ? 'rgba(34,197,94,0.1)' : '#0A1628',
                                        borderColor: aiLineupCountInput === n
                                            ? '#22C55E' : '#223366',
                                        color: aiLineupCountInput === n
                                            ? '#22C55E' : '#8A9BBE'
                                    }}>
                                    {n}
                                </button>
                            ))}
                        </div>

                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={aiLineupCountInput}
                            onChange={e => setAiLineupCountInput(
                                Math.min(50, Math.max(1, parseInt(e.target.value) || 1))
                            )}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] focus:border-[#22C55E] text-white text-center font-bold mb-4"
                            style={{background:'#0A1628'}}
                        />

                        <div className="text-xs text-[#8A9BBE] mb-4">
                            Estimated cost: ~${(aiLineupCountInput * 0.0035).toFixed(2)}
                        </div>

                        <button
                            onClick={() => {
                                setShowAiCountModal(false)
                                generateAiLineups(aiLineupCountInput)
                            }}
                            className="w-full py-3 rounded-lg text-sm font-black transition-all"
                            style={{
                                background:'linear-gradient(135deg, #22C55E, #16A34A)',
                                color:'#ffffff'
                            }}>
                            Build {aiLineupCountInput} Lineups
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}