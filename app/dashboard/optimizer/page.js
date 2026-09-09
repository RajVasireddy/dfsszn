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
    const [optimizerStatus, setOptimizerStatus] = useState('unknown')
    const [posFilter, setPosFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    // Separate from posFilter/search above — those drive the main player table;
    // the Stack Builder panel has its own tabs/search box and was wrongly wired
    // to share that state (so its tabs both did nothing to its own list AND
    // silently changed the main table's filter behind the scenes).
    const [stackBuilderPosFilter, setStackBuilderPosFilter] = useState('ALL')
    const [stackBuilderSearch, setStackBuilderSearch] = useState('')
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
    const [gameFiltersTab, setGameFiltersTab] = useState('stacks')
    const [assignModalPlayer, setAssignModalPlayer] = useState(null)
    const [slateSource, setSlateSource] = useState('live')
    const [manualPlayers, setManualPlayers] = useState([])
    const [manualSlateInfo, setManualSlateInfo] = useState(null)
    const [showSlateUpload, setShowSlateUpload] = useState(false)
    const [legacyRules, setLegacyRules] = useState({
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

    // Multi-stack builder state
    const [multiStackRules, setMultiStackRules] = useState([])
    const [pitcherPool, setPitcherPool] = useState([])
    const [commonPool, setCommonPool] = useState([])
    const [globalExposureCaps, setGlobalExposureCaps] = useState({})
    const [globalExposureActual, setGlobalExposureActual] = useState({})
    const [allGeneratedLineups, setAllGeneratedLineups] = useState([])
    const [salaryMin, setSalaryMin] = useState('49500')
    const [salaryMax, setSalaryMax] = useState('50000')
    const [generatingProgress, setGeneratingProgress] = useState(null)
    const [stackModalPlayer, setStackModalPlayer] = useState(null)
    const [showStackModal, setShowStackModal] = useState(false)
    const [aiSuggestions, setAiSuggestions] = useState(null)
    const [aiSuggestLoading, setAiSuggestLoading] = useState(false)
    const [activeStackFilter, setActiveStackFilter] = useState('all')
    const [showStackBuilder, setShowStackBuilder] = useState(false)

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
        nfl: ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF'],
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
            fanduel: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'K', 'DEF'],
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
        // Wake up optimizer service on page load (Render free-tier services
        // sleep after inactivity and take a while to spin back up)
        fetch('/api/keepalive')
            .then(r => r.json())
            .then(data => {
                const status = data.services?.optimizer?.status
                setOptimizerStatus(status || 'unknown')
                if (status === 'awake') {
                    setTimeout(() => setOptimizerStatus('unknown'), 3000)
                }
            })
            .catch(() => setOptimizerStatus('unknown'))

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

    // Sync salary range defaults when sport/platform changes, but not on first mount
    // (so restored session state isn't clobbered back to defaults)
    useEffect(() => {
        if (isFirstMount) return
        let min = '49500', max = '50000'
        if (sport === 'nfl' && platform === 'fanduel') {
            min = '59000'; max = '60000'
        } else if (sport === 'nfl') {
            min = '49500'; max = '50000'
        }
        setTeamSalaryMin(min)
        setTeamSalaryMax(max)
        setSalaryMin(min)
        setSalaryMax(max)
    }, [sport, platform])

    // Sync players from manualPlayers when slate source is manual
    useEffect(() => {
        if (slateSource === 'manual' && manualPlayers.length > 0 && players.length === 0) {
            setPlayers(manualPlayers)
            setError(null)
            setLoading(false)
        }
    }, [slateSource, manualPlayers])

    // Auto-save whenever important state changes
    useEffect(() => {
        if (players.length > 0 || lineups.some(l => l?.some(p => p))) {
            saveStateToSession()
        }
    }, [
        lineups,
        stackTeam,
        multiStackRules,
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

    // Show a generation error longer when it looks like the Render-hosted
    // optimizer was cold-starting (so the user has time to read the retry
    // guidance) than for an ordinary validation error.
    const setGenerationError = (errMsg) => {
        setError(errMsg)
        const isWakingUp = errMsg.includes('waking up') ||
            errMsg.includes('timed out') ||
            errMsg.includes('unavailable')
        setTimeout(() => setError(null), isWakingUp ? 8000 : 4000)
    }

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

    // Switching sports means an entirely different player pool/ID space, so
    // every rule keyed by SlatePlayerID (locks, pools, exposures, projections)
    // has to be cleared or it'll silently apply to the wrong sport's players.
    const handleSportChange = (newSport) => {
        if (newSport === sport) return
        setSport(newSport)
        setPlayers([])
        setManualPlayers([])
        setManualSlateInfo(null)
        setSelectedSlate(null)
        setSlates([])
        setLineups([new Array(LINEUP_SLOTS[newSport][platform].length).fill(null)])
        setActiveLineup(0)
        setLineupCount(1)
        setLineupReasonings([])
        setMultiStackRules([])
        setAllGeneratedLineups([])
        setPitcherPool([])
        setCommonPool([])
        setFillPool([])
        setStackExposures({})
        setStackTeam(null)
        setGlobalExposureCaps({})
        setGlobalExposureActual({})
        setLegacyRules({ minFromSameTeam: 0, maxFromSameTeam: 5, lockedPlayers: [], excludedPlayers: [] })
        setCustomProjections({})
        setCustomOwnership({})
        setImportedProjections({})
        setImportStatus(null)
        setGameFilter(null)
        setPosFilter('ALL')
        setStackBuilderPosFilter('ALL')
        setStackBuilderSearch('')
        setAiAnalysis(null)
        setAiSuggestions(null)
        setError(null)

        // The current SportsDataIO plan doesn't include live NFL slates — send
        // straight to manual upload instead of an empty/failed live fetch.
        if (newSport === 'nfl') {
            setSlateSource('manual')
            setShowSlateUpload(true)
        } else {
            setSlateSource('live')
        }
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
        // Manual slate: confirmedStarters is only ever populated from live
        // SportsDataIO probable-pitcher data, so it's always empty here — trust
        // the CSV instead of hiding every manually-uploaded pitcher.
        if (slateSource === 'manual') return true
        if (player.IsStartingPitcher === true) return true
        return confirmedStarters.has(player.PlayerID) || confirmedStarters.has(player.SlatePlayerID)
    }

    // Filter and sort — uses correct SportsDataIO field names
    const filteredPlayers = players
        .filter(p => {
            if (!gameFilter) return true
            if (gameFilter.type === 'team') return p.Team === gameFilter.team
            if (gameFilter.type === 'game') return p.SlateGameID === gameFilter.gameId
            return true
        })
        .filter(p => {
            if (playerTab === 'excluded') return legacyRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)
            if (playerTab === 'liked') return likedPlayers.find(lp => lp.SlatePlayerID === p.SlatePlayerID)
            if (legacyRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)) return false
            return true
        })
        .filter(p => {
            const isPitcher = p.OperatorPosition === 'SP' ||
                p.OperatorPosition === 'RP' ||
                p.OperatorPosition === 'P' ||
                (p.OperatorRosterSlots || []).includes('P')
            // Only live slates have real confirmed-starter data to filter by —
            // manual slates always pass through (isConfirmedStarter already
            // returns true for slateSource === 'manual', kept explicit here too)
            if (isPitcher && slateSource === 'live') {
                return isConfirmedStarter(p)
            }
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
            // NFL defense: DST/DEF are the same position under different platform labels
            if (posFilter === 'DST' || posFilter === 'DEF') {
                return p.OperatorPosition === 'DST' ||
                    p.OperatorPosition === 'DEF' ||
                    (p.OperatorRosterSlots || []).includes('DST') ||
                    (p.OperatorRosterSlots || []).includes('DEF')
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

            // FLEX slot for NBA accepts any position; for NFL, RB/WR/TE only
            if (slot === 'FLEX') {
                if (sport === 'nba') return true
                return ['RB', 'WR', 'TE'].includes(playerPos) ||
                    (playerPos.includes('/') && playerPos.split('/').some(pp => ['RB', 'WR', 'TE'].includes(pp)))
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
        // NFL defenses are named like "Patriots D/ST" — use the team word, not "D"+"S"
        if (name.includes('D/ST') || name.includes('DST')) {
            return name.split(' ')[0].slice(0, 2).toUpperCase()
        }
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
            DEF: 'rgba(20,184,166,0.15)',
            FLEX: 'rgba(251,146,60,0.1)',
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
            DEF: '#2DD4BF',
            FLEX: '#FB923C',
        }
        return colors[pos] || '#8A9BBE'
    }

    const generateLineup = () => {
        const newLineup = new Array(slots.length).fill(null)
        const usedPlayerIDs = new Set()
        const excludedIDs = new Set(legacyRules.excludedPlayers.map(p => p.SlatePlayerID))

        // Step 1 — Place locked players first
        legacyRules.lockedPlayers.forEach(lockedPlayer => {
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
        const lockedSalary = legacyRules.lockedPlayers.reduce((sum, p) => sum + (p.OperatorSalary || 0), 0)
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
        const excludedIDs = new Set(legacyRules.excludedPlayers.map(p => p.SlatePlayerID))

        // Place locked players first
        legacyRules.lockedPlayers.forEach(lockedPlayer => {
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

        const lockedSalary = legacyRules.lockedPlayers.reduce((sum, p) => sum + (p.OperatorSalary || 0), 0)
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
                        opponent: getOpponent(p),
                        opp: getOpponent(p),
                        projectedPoints: getProjection(p),
                        ownershipProjection: getEffectiveOwnership(p),
                        value: getValueScore(p),
                        locked: !!legacyRules.lockedPlayers.find(lp => lp.SlatePlayerID === p.SlatePlayerID),
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
                    lockedIds: legacyRules.lockedPlayers.map(p => p.SlatePlayerID),
                    excludedIds: legacyRules.excludedPlayers.map(p => p.SlatePlayerID),
                    pitcherPoolIds: pitcherPool.map(p => p.SlatePlayerID),
                    commonPoolIds: commonPool.map(p => p.SlatePlayerID),
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
                setGenerationError(data.error || 'Failed to generate lineups.')
                setLoading(false)
                return
            }

            // Assign players to slots correctly
            const properLineups = data.lineups.map(lu => mapLineupPlayersToSlots(lu.players, eligiblePool, slots))

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

        // NFL roster slots: skill positions are also FLEX-eligible; defense
        // is listed as DST/DEF/D/ST depending on source, so accept both aliases
        const getNflRosterSlots = (pos) => {
            switch (pos.toUpperCase()) {
                case 'QB': return ['QB']
                case 'RB': return ['RB', 'FLEX']
                case 'WR': return ['WR', 'FLEX']
                case 'TE': return ['TE', 'FLEX']
                case 'K': return ['K']
                case 'DST':
                case 'DEF':
                case 'D/ST': return ['DST', 'DEF']
                default: return [pos]
            }
        }

        // Normalize DST/DEF/D/ST to DK's "DST" or FanDuel's "DEF" label
        const normalizeNflPosition = (pos) => {
            const upper = pos.toUpperCase()
            if (['DST', 'DEF', 'D/ST'].includes(upper)) {
                return platform === 'fanduel' ? 'DEF' : 'DST'
            }
            return upper
        }

        lines.slice(1).forEach((line, i) => {
            if (!line.trim()) return
            const cols = line.split(',')

            const firstName = (cols[idx('first_name')] || '').trim()
            const lastName = (cols[idx('last_name')] || '').trim()
            let fullName = `${firstName} ${lastName}`.trim()
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
            // Sport is decided by the sport toggle, never guessed from a position
            // string — auto-detection here previously misfired and swallowed MLB
            // pitcher rows into NFL parsing.
            const isNflSlate = sport === 'nfl'
            const isDstRow = isNflSlate && ['DST', 'DEF', 'D/ST'].includes(position)
            const isPitcher = !isNflSlate && (position === 'P' || position === 'SP' || position === 'RP')
            // Some cheatsheets label starters explicitly as "SP" with no separate
            // starting_pitcher column — treat that as sufficient on its own.
            // This only decides the SP/RP display label — it does NOT gate
            // inclusion (see IsStartingPitcher below / isConfirmedStarter).
            const isStarterLabel = isPitcher && (
                (cols[idx('starting_pitcher')] || '').trim().toUpperCase() === 'YES' ||
                position === 'SP'
            )

            // DST rows often omit a player name — fall back to "{Team} D/ST"
            if (isDstRow && !fullName) fullName = `${team} D/ST`

            if (!fullName || !salary) return

            let operatorPosition = position
            let rosterSlots
            if (isNflSlate) {
                operatorPosition = normalizeNflPosition(position)
                rosterSlots = getNflRosterSlots(position)
            } else {
                if (position === 'P') operatorPosition = isStarterLabel ? 'SP' : 'RP'
                rosterSlots = isPitcher ? ['P'] : [position]
            }

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
                // Manual slates are user-curated — trust every parsed pitcher row
                // (SP or RP) instead of silently hiding relievers or anyone the
                // starting_pitcher/position heuristic misclassifies. See
                // isConfirmedStarter, which bypasses this check entirely for
                // slateSource === 'manual' but still reads it as a fallback for
                // live slates.
                IsStartingPitcher: isPitcher,
                IsNfl: isNflSlate,
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
                SalaryCap: cap,
                SlateRosterSlots: slots,
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
            setError(null)
            setLoading(false)
            setLineups([new Array(slots.length).fill(null)])
            setActiveLineup(0)
            setShowSlateUpload(false)
            setImportedProjections({})
            setCustomProjections({})
            setImportStatus(null)

            console.log(`Manual slate loaded: ${parsed.length} players, ${slateInfo.NumberOfGames} games`)

            // Debug: confirm pitchers survived parsing. 0 here means parsing
            // dropped them; a nonzero count that still doesn't show in the
            // table means the filter (isConfirmedStarter/eligiblePool) is at fault.
            const pitcherCount = parsed.filter(p =>
                p.OperatorPosition === 'SP' || p.OperatorPosition === 'RP'
            ).length
            console.log(`Manual slate parsed: ${parsed.length} players (${pitcherCount} pitchers)`)
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

        const currentExcluded = legacyRules.excludedPlayers
        const newExclusions = unprojected.filter(p =>
            !currentExcluded.find(ep => ep.SlatePlayerID === p.SlatePlayerID)
        )

        setLegacyRules(prev => ({
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
            const isPitcher = p.OperatorPosition === 'SP' ||
                p.OperatorPosition === 'RP' ||
                p.OperatorPosition === 'P' ||
                (p.OperatorRosterSlots || []).includes('P')
            // Manual slate or non-pitcher: always eligible (isConfirmedStarter
            // already returns true for slateSource === 'manual', kept explicit here too)
            if (isPitcher && slateSource === 'live') {
                return isConfirmedStarter(p)
            }
            if (legacyRules.excludedPlayers.find(ep => ep.SlatePlayerID === p.SlatePlayerID)) return false
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

    // Stack Builder's own player pool list — filtered independently of the
    // main table's posFilter/search so its tabs and search box actually affect
    // the list they're drawn next to, instead of silently changing (or being
    // silently ignored by) the main player table's filters.
    const stackBuilderFilteredPlayers = eligiblePool.filter(p => {
        if (stackBuilderPosFilter !== 'ALL') {
            const pos = p.OperatorPosition || ''
            if (stackBuilderPosFilter === 'P') {
                if (!['SP', 'RP', 'P'].includes(pos) && !(p.OperatorRosterSlots || []).includes('P')) return false
            } else if (stackBuilderPosFilter === 'DST' || stackBuilderPosFilter === 'DEF') {
                if (pos !== 'DST' && pos !== 'DEF' &&
                    !(p.OperatorRosterSlots || []).includes('DST') &&
                    !(p.OperatorRosterSlots || []).includes('DEF')) return false
            } else if (pos.includes('/')) {
                if (!pos.split('/').includes(stackBuilderPosFilter)) return false
            } else if (pos !== stackBuilderPosFilter) {
                return false
            }
        }

        if (stackBuilderSearch) {
            const q = stackBuilderSearch.toLowerCase()
            const name = (p.OperatorPlayerName || '').toLowerCase()
            const team = (p.Team || '').toLowerCase()
            if (!name.includes(q) && !team.includes(q)) return false
        }

        return true
    })
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
        console.log('Locked:', legacyRules.lockedPlayers.map(p => p.OperatorPlayerName))
        console.log('Excluded:', legacyRules.excludedPlayers.map(p => p.OperatorPlayerName))
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
                    opponent: getOpponent(p),
                    opp: getOpponent(p),
                    projectedPoints: getProjection(p),
                    ownershipProjection: getEffectiveOwnership(p),
                    locked: !!legacyRules.lockedPlayers.find(
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
                lockedIds: legacyRules.lockedPlayers.map(p => p.SlatePlayerID),
                excludedIds: legacyRules.excludedPlayers.map(p => p.SlatePlayerID),
                pitcherPoolIds: pitcherPool.map(p => p.SlatePlayerID),
                commonPoolIds: commonPool.map(p => p.SlatePlayerID),
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
                setGenerationError(data.error || 'Failed to generate lineups')
                setAppending(false)
                return
            }

            // Map returned players to full player objects
            const newLineups = data.lineups.map(lu => mapLineupPlayersToSlots(lu.players, eligiblePool, slots))

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
                legacyRules,
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
            if (state.legacyRules) setLegacyRules(state.legacyRules)
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
                    lockedIds: legacyRules.lockedPlayers.map(p => p.SlatePlayerID),
                    excludedIds: legacyRules.excludedPlayers.map(p => p.SlatePlayerID),
                    pitcherPoolIds: pitcherPool.map(p => p.SlatePlayerID),
                    commonPoolIds: commonPool.map(p => p.SlatePlayerID),
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

        const newExcluded = [...legacyRules.excludedPlayers]
        aiAnalysis.global_avoid?.forEach(pa => {
            const player = findPlayerByName(pa.name)
            if (player && !newExcluded.find(p => p.SlatePlayerID === player.SlatePlayerID)) {
                newExcluded.push(player)
            }
        })
        setLegacyRules(prev => ({
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

        const newExcluded = [...legacyRules.excludedPlayers]
        aiAnalysis.players_to_avoid?.forEach(pa => {
            const player = findPlayerByName(pa.name)
            if (player && !newExcluded.find(
                p => p.SlatePlayerID === player.SlatePlayerID
            )) {
                newExcluded.push(player)
                appliedCount++
            }
        })
        setLegacyRules(prev => ({
            ...prev,
            excludedPlayers: newExcluded
        }))

        setError(null)
    }

    // ─── Stack helper functions ──────────────────────────────────────────────
    const addStack = (team, player) => {
        // Normalize to the same lowercase payload shape used everywhere else a
        // player gets locked into a stack (see getLockedId/getLockedName) —
        // pushing the raw uppercase-keyed player object here was the same bug.
        const lockedPayload = player ? {
            slatePlayerId: player.SlatePlayerID,
            operatorPlayerName: player.OperatorPlayerName,
            operatorPosition: player.OperatorPosition,
            operatorSalary: player.OperatorSalary,
            team: player.Team,
        } : null
        const newStack = {
            id: Date.now().toString(),
            team: team || player?.Team || '',
            lockedPlayers: lockedPayload ? [lockedPayload] : [],
            lineupCount: 10,
            minUniquePlayers: 2,
            reasoning: '',
            source: 'manual',
            status: 'pending',
            generatedLineups: [],
        }
        setMultiStackRules(prev => [...prev, newStack])
        return newStack.id
    }

    const removeStack = (stackId) => setMultiStackRules(prev => prev.filter(s => s.id !== stackId))

    const updateStack = (stackId, updates) =>
        setMultiStackRules(prev => prev.map(s => s.id === stackId ? { ...s, ...updates } : s))

    const addPlayerToStack = (stackId, player) =>
        setMultiStackRules(prev => prev.map(s => {
            if (s.id !== stackId) return s
            if (s.lockedPlayers.find(p => getLockedId(p) === player.SlatePlayerID)) return s
            // Normalize to the lowercase payload shape (matches the stack-assignment
            // modal's convention, and pitcherPool/commonPool elsewhere) instead of
            // pushing the raw uppercase-keyed player object — see getLockedId above.
            const payload = {
                slatePlayerId: player.SlatePlayerID,
                operatorPlayerName: player.OperatorPlayerName,
                operatorPosition: player.OperatorPosition,
                operatorSalary: player.OperatorSalary,
                team: player.Team,
            }
            return { ...s, team: s.team || player.Team, lockedPlayers: [...s.lockedPlayers, payload] }
        }))

    const removePlayerFromStack = (stackId, playerId) =>
        setMultiStackRules(prev => prev.map(s => {
            if (s.id !== stackId) return s
            return { ...s, lockedPlayers: s.lockedPlayers.filter(p => getLockedId(p) !== playerId) }
        }))

    const addToPitcherPool = (player) => {
        if (pitcherPool.find(p => p.SlatePlayerID === player.SlatePlayerID)) return
        setPitcherPool(prev => [...prev, { ...player, maxExposurePct: 35, warning: null }])
    }

    const addToCommonPool = (player) => {
        if (commonPool.find(p => p.SlatePlayerID === player.SlatePlayerID)) return
        setCommonPool(prev => [...prev, { ...player, maxExposurePct: 50 }])
    }
    // ─── End Stack helper functions ──────────────────────────────────────────

    // ─── Multi-Stack Builder helpers ────────────────────────────────────────
    const getOpponent = (player) => {
        if (!selectedSlate?.DfsSlateGames) return player.Opponent || null
        const game = selectedSlate.DfsSlateGames.find(sg => sg.SlateGameID === player.SlateGameID)
        if (!game?.Game) return player.Opponent || null
        return player.Team === game.Game.AwayTeam ? game.Game.HomeTeam : game.Game.AwayTeam
    }

    const buildPlayerPayload = (p) => ({
        slatePlayerId: p.SlatePlayerID,
        slateGameId: p.SlateGameID,
        operatorPlayerName: p.OperatorPlayerName,
        operatorPosition: p.OperatorPosition,
        operatorSalary: p.OperatorSalary,
        operatorRosterSlots: p.OperatorRosterSlots || [],
        team: p.Team,
        opponent: getOpponent(p),
        opp: getOpponent(p),
        projectedPoints: getProjection(p),
        ownershipProjection: getEffectiveOwnership(p),
        value: getValueScore(p),
        locked: false,
    })

    const mapLineupPlayersToSlots = (luPlayers, pool, slotList) => {
        const newLineup = new Array(slotList.length).fill(null)
        const usedIds = new Set()
        slotList.forEach((slot, slotIndex) => {
            const eligible = luPlayers.filter(p => {
                if (usedIds.has(p.slatePlayerId)) return false
                const pos = p.operatorPosition || ''
                const rs = p.operatorRosterSlots || []
                if (slot === 'P') return pos === 'SP' || pos === 'RP' || pos === 'P' || rs.includes('P')
                if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(pos) || pos.split('/').some(part => ['RB', 'WR', 'TE'].includes(part))
                if (pos.includes('/')) return pos.split('/').includes(slot)
                if (rs.includes(slot)) return true
                return pos === slot
            })
                // Deterministic order: same eligible set always yields the same pick,
                // regardless of what order the backend returned lu.players in.
                .sort((a, b) => (a.slatePlayerId ?? 0) - (b.slatePlayerId ?? 0))
            if (eligible.length > 0) {
                const pick = eligible[0]
                const fullPlayer = pool.find(ep => ep.SlatePlayerID === pick.slatePlayerId)
                if (fullPlayer) { newLineup[slotIndex] = fullPlayer; usedIds.add(pick.slatePlayerId) }
            }
        })
        return newLineup
    }

    const isInPitcherPool = (p) => pitcherPool.some(pp => pp.slatePlayerId === p.SlatePlayerID)
    const isInCommonPool = (p) => commonPool.some(cp => cp.slatePlayerId === p.SlatePlayerID)
    // A stack rule's lockedPlayers array has historically mixed two shapes
    // depending on which "add to stack" UI added the entry: addPlayerToStack
    // pushed the raw player object (SlatePlayerID/OperatorPlayerName, uppercase),
    // while the stack-assignment modal built its own payload (slatePlayerId/
    // operatorPlayerName, lowercase). Reading only one casing silently dropped
    // whichever half was added via the other path — which is exactly why
    // lockedPlayerIds sent to the optimizer, and the locked-player chips in the
    // UI, would go missing depending on how a player was locked. These
    // accessors work regardless of which shape an entry has (including ones
    // already saved in an existing browser session before this fix).
    const getLockedId = (lp) => lp?.slatePlayerId ?? lp?.SlatePlayerID
    const getLockedName = (lp) => lp?.operatorPlayerName ?? lp?.OperatorPlayerName
    const getPlayerStacks = (p) => multiStackRules.filter(r => r.lockedPlayers.some(lp => getLockedId(lp) === p.SlatePlayerID))

    const generateStack = async (stackId) => {
        const stack = multiStackRules.find(s => s.id === stackId)
        if (!stack) return

        updateStack(stackId, { status: 'generating' })
        setError(null)

        console.log('Generating stack:', stack.team, 'Locked:', stack.lockedPlayers.map(p =>
            `${getLockedName(p)}(${getLockedId(p)})`
        ))

        try {
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
                        operatorRosterSlots: p.OperatorRosterSlots || [],
                        team: p.Team,
                        opponent: getOpponent(p),
                        opp: getOpponent(p),
                        projectedPoints: parseFloat(getProjection(p)) || 0,
                        ownershipProjection: parseFloat(getEffectiveOwnership(p)) || 0,
                        locked: !!stack.lockedPlayers.find(lp => getLockedId(lp) === p.SlatePlayerID),
                    })),
                    slots,
                    cap,
                    minSalary: teamSalaryMin ? parseInt(teamSalaryMin) : 49500,
                    maxSalary: teamSalaryMax ? parseInt(teamSalaryMax) : 50000,
                    numLineups: stack.lineupCount,
                    lockedPlayerIds: stack.lockedPlayers.map(getLockedId),
                    excludedIds: legacyRules.excludedPlayers.map(p => p.SlatePlayerID),
                    pitcherPoolIds: pitcherPool.length > 0 ? pitcherPool.map(p => p.SlatePlayerID) : [],
                    commonPoolIds: commonPool.length > 0 ? commonPool.map(p => p.SlatePlayerID) : [],
                    fillPoolIds: fillPool.map(p => p.SlatePlayerID),
                    stackTeam: stack.team || null,
                    stackTeamSize: 5,
                    stackDistribution: Array(stack.lineupCount).fill(stack.team || null),
                    playersPerTeamMax,
                    playersPerGameMax,
                    hittersVsPitcher,
                    uniquePlayersPerLineup: stack.minUniquePlayers || 2,
                    numberOfGames: selectedSlate?.NumberOfGames || 10,
                    ownershipTargets: Object.fromEntries(
                        Object.entries(customOwnership)
                            .filter(([_, v]) => v !== '' && v !== undefined && parseFloat(v) > 0)
                            .map(([id, pct]) => [String(parseInt(id)), parseFloat(pct)])
                    ),
                })
            })

            const data = await res.json()

            if (!data.success) {
                updateStack(stackId, { status: 'error', error: data.error || 'Failed to generate' })
                return
            }

            const generatedLineups = data.lineups.map(lu => mapLineupPlayersToSlots(lu.players, eligiblePool, slots))

            updateStack(stackId, { status: 'generated', generatedLineups, error: null })

            setLineups(prev => {
                const existing = prev.filter(l => l && l.some(p => p !== null))
                return [...existing, ...generatedLineups]
            })
            setLineupCount(prev => prev + generatedLineups.length)

        } catch (err) {
            console.error('Stack generation error:', err)
            updateStack(stackId, { status: 'error', error: err.message || 'Network error' })
        }
    }

    const generateSingleStack = async (ruleId) => {
        const rule = multiStackRules.find(r => r.id === ruleId)
        if (!rule || eligiblePool.length === 0) return
        setMultiStackRules(prev => prev.map(r => r.id === ruleId ? { ...r, status: 'generating' } : r))
        try {
            const res = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    players: eligiblePool.map(buildPlayerPayload),
                    slots, cap,
                    minSalary: parseInt(salaryMin) || 49500,
                    maxSalary: parseInt(salaryMax) || 50000,
                    numLineups: rule.lineupCount,
                    minUniquePlayers: rule.minUniquePlayers || 2,
                    lockedPlayerIds: rule.lockedPlayers.map(getLockedId),
                    pitcherPoolIds: pitcherPool.map(p => p.slatePlayerId),
                    commonPoolIds: commonPool.map(p => p.slatePlayerId),
                    globalExposureCaps,
                    globalExposureActual,
                    totalLineupsSoFar: allGeneratedLineups.length,
                    stackTeam: rule.team,
                    stackTeamSize: 5,
                    stackSize: 5,
                    stackDistribution: Array(rule.lineupCount).fill(rule.team),
                    numberOfGames: selectedSlate?.NumberOfGames || 10,
                    playersPerTeamMax: 5,
                    playersPerGameMax: 8,
                    uniquePlayersPerLineup: rule.minUniquePlayers || 2,
                })
            })
            const data = await res.json()
            if (data.success) {
                const mapped = data.lineups.map(lu => mapLineupPlayersToSlots(lu.players, eligiblePool, slots))
                setMultiStackRules(prev => prev.map(r => r.id === ruleId
                    ? { ...r, status: 'generated', generatedLineups: mapped } : r))
                setAllGeneratedLineups(prev => [
                    ...prev.filter(l => l.stackId !== ruleId),
                    ...mapped.map(lu => ({ lineup: lu, stackId: ruleId, team: rule.team }))
                ])
                if (data.updatedExposure) setGlobalExposureActual(data.updatedExposure)
            } else {
                setMultiStackRules(prev => prev.map(r => r.id === ruleId
                    ? { ...r, status: 'error', errorMessage: data.error || 'Failed' } : r))
            }
        } catch (err) {
            setMultiStackRules(prev => prev.map(r => r.id === ruleId
                ? { ...r, status: 'error', errorMessage: err.message } : r))
        }
    }

    const generateAllStacks = async () => {
        const pending = multiStackRules.filter(s => s.status !== 'generated')
        if (pending.length === 0) return
        for (const stack of pending) {
            await generateStack(stack.id)
        }
    }

    const fetchAiStackSuggestions = async () => {
        if (eligiblePool.length === 0) { setError('Load a slate first'); return }
        setAiSuggestLoading(true)
        try {
            const res = await fetch('/api/ai-stack-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    players: eligiblePool.map(p => ({
                        operatorPlayerName: p.OperatorPlayerName,
                        operatorPosition: p.OperatorPosition,
                        operatorSalary: p.OperatorSalary,
                        team: p.Team,
                        projectedPoints: parseFloat(getProjection(p)) || 0,
                        ownershipProjection: parseFloat(getEffectiveOwnership(p)) || 0,
                    })),
                    slate: selectedSlate,
                    sport, platform,
                    numTotalLineups: multiStackRules.reduce((s, r) => s + r.lineupCount, 0) || 50,
                    slateNotes: slateNotes.trim(),
                })
            })
            const data = await res.json()
            if (data.success) setAiSuggestions(data.analysis)
            else setError(data.error || 'AI suggestion failed')
        } catch (err) {
            setError('AI suggestion failed')
        }
        setAiSuggestLoading(false)
    }

    const addStackFromSuggestion = (suggestion) => {
        const lockedPlayers = (suggestion.players || []).map(name => {
            const p = eligiblePool.find(ep =>
                ep.OperatorPlayerName?.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(ep.OperatorPlayerName?.toLowerCase())
            )
            return p ? {
                slatePlayerId: p.SlatePlayerID,
                operatorPlayerName: p.OperatorPlayerName,
                operatorPosition: p.OperatorPosition,
                operatorSalary: p.OperatorSalary,
            } : null
        }).filter(Boolean)
        const newRule = {
            id: crypto.randomUUID(),
            team: suggestion.team,
            lockedPlayers,
            lineupCount: suggestion.lineupCount || 10,
            minUniquePlayers: 2,
            reasoning: suggestion.reasoning || '',
            source: 'ai',
            status: 'pending',
            errorMessage: '',
            generatedLineups: [],
        }
        setMultiStackRules(prev => [...prev, newRule])
    }

    const exportStackBuilderCSV = () => {
        const toExport = activeStackFilter === 'all'
            ? allGeneratedLineups
            : allGeneratedLineups.filter(l => l.stackId === activeStackFilter)
        const validLineups = toExport.map(l => l.lineup).filter(l => l && l.some(p => p))
        if (validLineups.length === 0) return
        const headers = slots.join(',')
        const rows = validLineups.map(lu => slots.map((_, i) => {
            const p = lu[i]
            return p ? `${p.OperatorPlayerName} (${p.OperatorPlayerID || p.SlatePlayerID})` : ''
        }).join(','))
        downloadCSV([headers, ...rows].join('\n'), `DFSSZN_Stacks_${validLineups.length}lineups.csv`)
    }
    // ─── End Multi-Stack Builder helpers ─────────────────────────────────────

    return (
        <div className="min-h-screen" style={{ background: '#0A1628' }}>

            {/* Top Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#223366]"
                style={{ background: 'rgba(10,22,40,0.97)' }}>
                <div className="flex items-center gap-2 px-4 h-14 flex-wrap">

                    {/* Logo */}
                    <div className="text-lg font-black text-white mr-2">
                        DFS<span className="text-[#FFB800]">SZN</span>
                    </div>

                    {/* Sport tabs */}
                    <div className="flex rounded-lg overflow-hidden border border-[#223366]">
                        {['MLB', 'NBA', 'NFL'].map(s => (
                            <button key={s} onClick={() => handleSportChange(s.toLowerCase())}
                                className="px-3 py-1.5 text-xs font-black transition-all"
                                style={{
                                    background: sport.toUpperCase() === s ? '#FFB800' : 'transparent',
                                    color: sport.toUpperCase() === s ? '#0A1628' : '#8A9BBE'
                                }}>
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Platform toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-[#223366]">
                        {['draftkings', 'fanduel'].map(p => (
                            <button key={p} onClick={() => setPlatform(p)}
                                className="px-3 py-1.5 text-xs font-bold transition-all"
                                style={{
                                    background: platform === p ? '#1A2E55' : 'transparent',
                                    color: platform === p ? '#FFB800' : '#8A9BBE'
                                }}>
                                {p === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-[#223366]" />

                    {/* Slate source toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-[#223366]">
                        <button onClick={() => { setSlateSource('live'); fetchSlates() }}
                            className="px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5"
                            style={{
                                background: slateSource === 'live' ? '#1A2E55' : 'transparent',
                                color: slateSource === 'live' ? '#22C55E' : '#8A9BBE'
                            }}>
                            <span className="w-1.5 h-1.5 rounded-full"
                                style={{ background: slateSource === 'live' ? '#22C55E' : '#8A9BBE' }} />
                            Live
                        </button>
                        <button onClick={() => setShowSlateUpload(true)}
                            className="px-3 py-1.5 text-xs font-bold transition-all"
                            style={{
                                background: slateSource === 'manual' ? '#1A2E55' : 'transparent',
                                color: slateSource === 'manual' ? '#FFB800' : '#8A9BBE'
                            }}>
                            📄 Manual{slateSource === 'manual' && <span className="ml-1 text-[#22C55E]">✓</span>}
                        </button>
                    </div>

                    {optimizerStatus === 'sleeping' && (
                        <div className="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5"
                            style={{
                                background: 'rgba(255,184,0,0.1)',
                                color: '#FFB800',
                                border: '1px solid rgba(255,184,0,0.2)'
                            }}>
                            <span className="animate-pulse">⚡</span>
                            Optimizer waking up…
                        </div>
                    )}

                    <div className="w-px h-6 bg-[#223366]" />

                    {/* Tool buttons */}
                    {[
                        {
                            label: 'Import',
                            icon: '📥',
                            active: Object.keys(importedProjections).length > 0,
                            onClick: () => setShowImport(!showImport),
                            badge: Object.keys(importedProjections).length || null,
                        },
                        {
                            label: 'Filters',
                            icon: '⚙️',
                            active: !!(multiStackRules.length || pitcherPool.length || commonPool.length || legacyRules.excludedPlayers.length),
                            onClick: () => setShowGameFilters(true),
                            badge: (multiStackRules.length + pitcherPool.length + commonPool.length + legacyRules.excludedPlayers.length) || null,
                        },
                        {
                            label: 'Notes',
                            icon: '📝',
                            active: slateNotes.length > 0,
                            onClick: () => setShowSlateNotes(!showSlateNotes),
                            badge: null,
                        },
                        {
                            label: 'Stack Builder',
                            icon: '⚡',
                            active: showStackBuilder || multiStackRules.length > 0,
                            onClick: () => setShowStackBuilder(v => !v),
                            badge: multiStackRules.length || null,
                            gold: true,
                        },
                        {
                            label: aiLoading ? 'Analyzing…' : 'AI Analysis',
                            icon: aiLoading ? '⚡' : '🤖',
                            active: !!aiAnalysis,
                            onClick: fetchAiAnalysis,
                            disabled: aiLoading,
                            badge: null,
                        },
                    ].map(btn => (
                        <button key={btn.label}
                            onClick={btn.onClick}
                            disabled={btn.disabled}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            style={{
                                background: btn.active ? 'rgba(255,184,0,0.08)' : '#132244',
                                borderColor: btn.active ? 'rgba(255,184,0,0.3)' : '#223366',
                                color: btn.active ? '#FFB800' : '#8A9BBE',
                                opacity: btn.disabled ? 0.6 : 1,
                            }}>
                            <span>{btn.icon}</span>
                            <span>{btn.label}</span>
                            {btn.badge > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-black"
                                    style={{ background: '#FFB800', color: '#0A1628' }}>
                                    {btn.badge}
                                </span>
                            )}
                        </button>
                    ))}

                    {/* AI Build + Reset — right side */}
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setShowAiCountModal(true)} disabled={aiBuilding}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black border transition-all"
                            style={{
                                background: 'rgba(34,197,94,0.1)',
                                borderColor: '#22C55E',
                                color: '#22C55E',
                                opacity: aiBuilding ? 0.7 : 1,
                            }}>
                            {aiBuilding ? '⚡ Building…' : '🤖 AI Build'}
                        </button>
                        <button
                            onClick={() => { sessionStorage.removeItem('dfsszn_optimizer_state'); window.location.reload() }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE] hover:border-red-400 hover:text-red-400 transition-all"
                            style={{ background: '#132244' }}
                            title="Reset all optimizer state">
                            ↺ Reset
                        </button>
                    </div>
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
                            { label: 'AI Chat', icon: '💬', active: false, href: '/dashboard/chat' },
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
                                        setLegacyRules(prev => ({
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

                    {/* Game Filter Bar */}
                    {players.length > 0 && (
                        <div className="mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setGameFilter(null)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0"
                                    style={{
                                        background: !gameFilter ? 'rgba(255,184,0,0.1)' : '#132244',
                                        borderColor: !gameFilter ? '#FFB800' : '#223366',
                                        color: !gameFilter ? '#FFB800' : '#8A9BBE'
                                    }}>
                                    ALL
                                </button>

                                <div className="w-px h-4 bg-[#223366] shrink-0" />

                                {(() => {
                                    const games = selectedSlate?.DfsSlateGames || []

                                    if (games.length > 0) {
                                        return games.map(sg => {
                                            const g = sg.Game || {}
                                            const away = g.AwayTeam || ''
                                            const home = g.HomeTeam || ''
                                            const ou = g.OverUnder
                                            const gameId = sg.SlateGameID
                                            const isGameActive = gameFilter?.type === 'game' && gameFilter?.gameId === gameId
                                            const isAwayActive = gameFilter?.type === 'team' && gameFilter?.team === away
                                            const isHomeActive = gameFilter?.type === 'team' && gameFilter?.team === home

                                            return (
                                                <div key={gameId}
                                                    className="flex items-center rounded-lg overflow-hidden border shrink-0"
                                                    style={{
                                                        borderColor: isGameActive ? '#FFB800' : (isAwayActive || isHomeActive) ? 'rgba(255,184,0,0.4)' : '#223366',
                                                        background: '#132244'
                                                    }}>
                                                    <button
                                                        onClick={() => setGameFilter(isAwayActive ? null : { type: 'team', team: away })}
                                                        className="px-2.5 py-1 text-xs font-black transition-all"
                                                        style={{
                                                            background: isAwayActive ? '#FFB800' : 'transparent',
                                                            color: isAwayActive ? '#0A1628' : '#ffffff'
                                                        }}>
                                                        {away}
                                                    </button>
                                                    <button
                                                        onClick={() => setGameFilter(isGameActive ? null : { type: 'game', gameId })}
                                                        className="px-1.5 py-1 transition-all border-x border-[#223366]"
                                                        style={{
                                                            background: isGameActive ? 'rgba(255,184,0,0.1)' : 'transparent',
                                                            color: isGameActive ? '#FFB800' : '#556080',
                                                            fontSize: '10px',
                                                            lineHeight: 1,
                                                            minWidth: '28px',
                                                            textAlign: 'center'
                                                        }}>
                                                        <div>@</div>
                                                        {ou && <div className="font-bold" style={{ color: isGameActive ? '#FFB800' : '#8A9BBE' }}>{ou}</div>}
                                                    </button>
                                                    <button
                                                        onClick={() => setGameFilter(isHomeActive ? null : { type: 'team', team: home })}
                                                        className="px-2.5 py-1 text-xs font-black transition-all"
                                                        style={{
                                                            background: isHomeActive ? '#FFB800' : 'transparent',
                                                            color: isHomeActive ? '#0A1628' : '#ffffff'
                                                        }}>
                                                        {home}
                                                    </button>
                                                </div>
                                            )
                                        })
                                    }

                                    // Fallback: team pills from player data
                                    const teams = [...new Set(players.map(p => p.Team).filter(Boolean))].sort()
                                    return teams.map(team => {
                                        const isActive = gameFilter?.type === 'team' && gameFilter?.team === team
                                        return (
                                            <button key={team}
                                                onClick={() => setGameFilter(isActive ? null : { type: 'team', team })}
                                                className="px-2.5 py-1 rounded-lg text-xs font-black border transition-all shrink-0"
                                                style={{
                                                    background: isActive ? '#FFB800' : '#132244',
                                                    borderColor: isActive ? '#FFB800' : '#223366',
                                                    color: isActive ? '#0A1628' : '#B8C5D6'
                                                }}>
                                                {team}
                                            </button>
                                        )
                                    })
                                })()}

                                {gameFilter && (
                                    <div className="ml-auto flex items-center gap-1.5 text-xs shrink-0">
                                        <span style={{ color: '#FFB800' }}>
                                            {gameFilter.type === 'team' ? gameFilter.team : 'Game'} only
                                        </span>
                                        <button
                                            onClick={() => setGameFilter(null)}
                                            className="text-[#8A9BBE] hover:text-[#EF4444] transition-colors font-bold">
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
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

                    {/* ──── MULTI-STACK BUILDER ──────────────────────────────── */}
                    {showStackBuilder && (
                        <div className="mb-4">

                            {sport === 'nfl' && (
                                <div className="mb-3 p-3 rounded-xl border border-[#223366]" style={{ background: '#132244' }}>
                                    <div className="text-xs font-bold text-[#FFB800] mb-1">🏈 NFL Stack Logic</div>
                                    <div className="text-xs text-[#8A9BBE]">
                                        Select a QB to auto-stack with pass catchers from the same team. Click 🔒 on a QB
                                        then add WR/TE teammates to the same stack.
                                    </div>
                                </div>
                            )}

                            {/* Stack Builder Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-black text-white">⚡ Stack Builder</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[#8A9BBE]">Salary:</span>
                                        <input value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                                            className="w-20 text-xs text-center text-white border border-[#223366] rounded px-1 py-0.5 outline-none"
                                            style={{background:'#132244'}} placeholder="49500" />
                                        <span className="text-xs text-[#8A9BBE]">–</span>
                                        <input value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                                            className="w-20 text-xs text-center text-white border border-[#223366] rounded px-1 py-0.5 outline-none"
                                            style={{background:'#132244'}} placeholder="50000" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        const newRule = {
                                            id: crypto.randomUUID(), team: '', lockedPlayers: [], lineupCount: 10,
                                            minUniquePlayers: 2, reasoning: '', source: 'manual',
                                            status: 'pending', errorMessage: '', generatedLineups: []
                                        }
                                        setMultiStackRules(prev => [...prev, newRule])
                                    }} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#B8C5D6]"
                                        style={{background:'#132244'}}>+ New Stack</button>
                                    <button onClick={generateAllStacks}
                                        disabled={!!generatingProgress || multiStackRules.length === 0}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                        style={{background:'rgba(34,197,94,0.15)', borderColor:'#22C55E', color:'#22C55E',
                                            opacity: (!!generatingProgress || multiStackRules.length === 0) ? 0.5 : 1}}>
                                        {generatingProgress
                                            ? `⚡ ${generatingProgress.current}/${generatingProgress.total}: ${generatingProgress.teamName}`
                                            : '⚡ Generate All'}
                                    </button>
                                    <button onClick={fetchAiStackSuggestions}
                                        disabled={aiSuggestLoading}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                                        style={{background:'rgba(45,212,191,0.1)', borderColor:'#2DD4BF', color:'#2DD4BF',
                                            opacity: aiSuggestLoading ? 0.5 : 1}}>
                                        {aiSuggestLoading ? '⚡ Analyzing...' : '🤖 AI Suggest'}
                                    </button>
                                    {allGeneratedLineups.length > 0 && (
                                        <button onClick={exportStackBuilderCSV}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#B8C5D6]"
                                            style={{background:'#132244'}}>
                                            📥 Export CSV
                                        </button>
                                    )}
                                    {allGeneratedLineups.length > 0 && (
                                        <button onClick={() => setAllGeneratedLineups([])}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#EF4444] border border-[#EF4444]"
                                            style={{background:'rgba(239,68,68,0.1)'}}>
                                            Clear Lineups
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Two-column layout */}
                            <div style={{display:'flex', gap:'12px', alignItems:'flex-start'}}>

                                {/* LEFT: Player Pool */}
                                <div style={{width:'380px', flexShrink:0}}>
                                    <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{background:'#0F1E38'}}>
                                        <div className="px-3 py-2 border-b border-[#223366] flex items-center gap-2" style={{background:'#1A2E55'}}>
                                            <span className="text-xs font-black text-white">Player Pool</span>
                                            {gameFilter ? (
                                                <span className="text-xs text-[#FFB800] font-bold">
                                                    {stackBuilderFilteredPlayers.length} players
                                                    {gameFilter.type === 'team' ? ` from ${gameFilter.team}` : ' in selected game'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[#8A9BBE]">{stackBuilderFilteredPlayers.length} players</span>
                                            )}
                                            <div className="ml-auto flex items-center gap-1">
                                                {(POSITIONS[sport] || []).map(pos => (
                                                    <button key={pos} onClick={() => setStackBuilderPosFilter(pos)}
                                                        className="px-1.5 py-0.5 rounded text-xs font-bold transition-all"
                                                        style={{
                                                            background: stackBuilderPosFilter === pos ? '#FFB800' : 'transparent',
                                                            color: stackBuilderPosFilter === pos ? '#0A1628' : '#8A9BBE',
                                                        }}>{pos}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="px-3 py-2 border-b border-[#223366]">
                                            <input value={stackBuilderSearch} onChange={e => setStackBuilderSearch(e.target.value)}
                                                placeholder="Search players…"
                                                className="w-full text-xs bg-transparent text-white outline-none placeholder-[#8A9BBE]" />
                                        </div>
                                        {(stackBuilderPosFilter !== 'ALL' || stackBuilderSearch) && (
                                            <div className="px-3 py-1.5 border-b border-[#223366] text-xs text-[#8A9BBE]">
                                                {stackBuilderFilteredPlayers.length} players
                                                {stackBuilderPosFilter !== 'ALL' && (
                                                    <span className="ml-1 text-[#FFB800]">· {stackBuilderPosFilter} filter active</span>
                                                )}
                                                {stackBuilderSearch && (
                                                    <span className="ml-1 text-[#FFB800]">· &quot;{stackBuilderSearch}&quot;</span>
                                                )}
                                            </div>
                                        )}
                                        <div style={{maxHeight:'320px', overflowY:'auto'}}>
                                            {stackBuilderFilteredPlayers.slice(0, 100).map(p => {
                                                const isPitcher = p.OperatorPosition === 'SP' || p.OperatorPosition === 'RP'
                                                const inPPool = isInPitcherPool(p)
                                                const inCPool = isInCommonPool(p)
                                                const pStacks = getPlayerStacks(p)
                                                return (
                                                    <div key={p.SlatePlayerID} className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1A2E55] hover:bg-[#1A2E55] transition-colors">
                                                        <span className="text-xs w-6 text-center font-bold"
                                                            style={{color: isPitcher ? '#FFB800' : '#818CF8'}}>
                                                            {p.OperatorPosition}
                                                        </span>
                                                        <span className="text-xs text-white flex-1 truncate">{p.OperatorPlayerName}</span>
                                                        <span className="text-xs text-[#8A9BBE] w-8">{p.Team}</span>
                                                        <span className="text-xs text-[#B8C5D6] w-12 text-right">${(p.OperatorSalary/1000).toFixed(1)}k</span>
                                                        <span className="text-xs text-[#22C55E] w-8 text-right">{getProjection(p).toFixed(1)}</span>
                                                        {pStacks.length > 0 && (
                                                            <div className="flex gap-0.5">
                                                                {pStacks.slice(0,2).map(r => (
                                                                    <span key={r.id} className="w-1.5 h-1.5 rounded-full" style={{background:'#FFB800'}} title={r.team} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button title="Add to stack" onClick={() => { setStackModalPlayer(p); setShowStackModal(true) }}
                                                            className="text-xs px-1.5 py-0.5 rounded transition-colors"
                                                            style={{background:'rgba(255,184,0,0.15)', color:'#FFB800'}}>🔒</button>
                                                        <button title={isPitcher ? 'Add to pitcher pool' : 'Add to common pool'}
                                                            onClick={() => {
                                                                const payload = { slatePlayerId: p.SlatePlayerID, operatorPlayerName: p.OperatorPlayerName, operatorPosition: p.OperatorPosition, operatorSalary: p.OperatorSalary, team: p.Team, maxExposurePct: isPitcher ? 35 : 50, source: 'manual' }
                                                                if (isPitcher) {
                                                                    if (!inPPool) setPitcherPool(prev => [...prev, payload])
                                                                    else setPitcherPool(prev => prev.filter(pp => pp.slatePlayerId !== p.SlatePlayerID))
                                                                } else {
                                                                    if (!inCPool) setCommonPool(prev => [...prev, payload])
                                                                    else setCommonPool(prev => prev.filter(cp => cp.slatePlayerId !== p.SlatePlayerID))
                                                                }
                                                            }}
                                                            className="text-xs px-1.5 py-0.5 rounded transition-colors"
                                                            style={{
                                                                background: (isPitcher ? inPPool : inCPool) ? 'rgba(34,197,94,0.2)' : 'rgba(129,140,248,0.15)',
                                                                color: (isPitcher ? inPPool : inCPool) ? '#22C55E' : '#818CF8'
                                                            }}>
                                                            {isPitcher ? (inPPool ? '✓⚾' : '⚾') : (inCPool ? '✓🎯' : '🎯')}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Pitcher Pool */}
                                    {pitcherPool.length > 0 && (
                                        <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{background:'#0F1E38'}}>
                                            <div className="px-3 py-2 border-b border-[#223366] flex items-center justify-between" style={{background:'#1A2E55'}}>
                                                <span className="text-xs font-black text-[#FFB800]">⚾ Pitcher Pool ({pitcherPool.length})</span>
                                            </div>
                                            {pitcherPool.map(pp => {
                                                const hasConflict = multiStackRules.some(r => r.team === pp.team)
                                                return (
                                                    <div key={pp.slatePlayerId} className="px-3 py-2 flex items-center gap-2 border-b border-[#1A2E55] text-xs">
                                                        <span className="text-white flex-1">{pp.operatorPlayerName}</span>
                                                        {hasConflict && <span className="text-[#FFB800]">⚠ vs stack</span>}
                                                        <span className="text-[#8A9BBE]">{pp.maxExposurePct}%</span>
                                                        <input type="range" min={0} max={100} value={pp.maxExposurePct || 35}
                                                            onChange={e => setPitcherPool(prev => prev.map(p2 => p2.slatePlayerId === pp.slatePlayerId ? {...p2, maxExposurePct: parseInt(e.target.value)} : p2))}
                                                            className="w-14" />
                                                        <button onClick={() => setPitcherPool(prev => prev.filter(p2 => p2.slatePlayerId !== pp.slatePlayerId))}
                                                            className="text-[#EF4444]">✕</button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Common Pool */}
                                    {commonPool.length > 0 && (
                                        <div className="rounded-xl border border-[#223366] overflow-hidden" style={{background:'#0F1E38'}}>
                                            <div className="px-3 py-2 border-b border-[#223366] flex items-center justify-between" style={{background:'#1A2E55'}}>
                                                <span className="text-xs font-black text-[#818CF8]">🎯 Common Pool ({commonPool.length})</span>
                                                <span className="text-xs text-[#8A9BBE]">fills non-locked slots</span>
                                            </div>
                                            {commonPool.map(cp => (
                                                <div key={cp.slatePlayerId} className="px-3 py-2 flex items-center gap-2 border-b border-[#1A2E55] text-xs">
                                                    <span className="text-white flex-1">{cp.operatorPlayerName}</span>
                                                    <span className="text-[#8A9BBE]">{cp.team}</span>
                                                    <span className="text-[#8A9BBE]">{cp.maxExposurePct}%</span>
                                                    <input type="range" min={0} max={100} value={cp.maxExposurePct || 50}
                                                        onChange={e => setCommonPool(prev => prev.map(p2 => p2.slatePlayerId === cp.slatePlayerId ? {...p2, maxExposurePct: parseInt(e.target.value)} : p2))}
                                                        className="w-14" />
                                                    <button onClick={() => setCommonPool(prev => prev.filter(p2 => p2.slatePlayerId !== cp.slatePlayerId))}
                                                        className="text-[#EF4444]">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: Stack Cards + Lineups */}
                                <div style={{flex:1, minWidth:0}}>

                                    {/* AI Suggestions Panel */}
                                    {aiSuggestions && (
                                        <div className="mb-4 rounded-xl border border-[#2DD4BF] overflow-hidden" style={{background:'#0F1E38'}}>
                                            <div className="px-4 py-3 border-b border-[#2DD4BF] flex items-center justify-between" style={{background:'rgba(45,212,191,0.05)'}}>
                                                <div>
                                                    <span className="text-sm font-black text-white">🤖 AI Stack Suggestions</span>
                                                    <span className="ml-2 text-xs text-[#8A9BBE]">Review and add to your builder</span>
                                                </div>
                                                <button onClick={() => setAiSuggestions(null)} className="text-[#8A9BBE] hover:text-white text-sm">✕</button>
                                            </div>
                                            <div className="px-4 py-2 border-b border-[#223366] flex items-center gap-2" style={{background:'rgba(255,184,0,0.05)'}}>
                                                <span className="text-xs text-[#FFB800]">⚠</span>
                                                <span className="text-xs text-[#B8C5D6]">{aiSuggestions.ownership_disclaimer || 'Ownership projections are model estimates, not from a live feed'}</span>
                                            </div>
                                            {aiSuggestions.slate_summary && (
                                                <div className="px-4 py-3 border-b border-[#223366]">
                                                    <p className="text-xs text-[#B8C5D6]">{aiSuggestions.slate_summary}</p>
                                                </div>
                                            )}
                                            <div className="p-4 space-y-3">
                                                {aiSuggestions.suggested_stacks?.map((s, i) => (
                                                    <div key={i} className="rounded-lg border border-[#223366] p-3" style={{background:'#132244'}}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded text-xs font-black" style={{background:'rgba(255,184,0,0.15)', color:'#FFB800'}}>{s.team}</span>
                                                                <span className="text-xs text-[#B8C5D6]">{s.lineupCount} lineups</span>
                                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{background:'rgba(255,184,0,0.1)', color:'#FFB800'}}>⚠ Est. own%</span>
                                                            </div>
                                                            <button onClick={() => addStackFromSuggestion(s)}
                                                                className="px-2 py-1 rounded text-xs font-bold"
                                                                style={{background:'rgba(45,212,191,0.15)', color:'#2DD4BF', border:'1px solid rgba(45,212,191,0.3)'}}>
                                                                + Add Stack
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {s.players?.map(name => (
                                                                <span key={name} className="px-2 py-0.5 rounded-full text-xs" style={{background:'rgba(34,197,94,0.15)', color:'#22C55E'}}>{name}</span>
                                                            ))}
                                                        </div>
                                                        {s.reasoning && <p className="text-xs text-[#8A9BBE] italic">{s.reasoning}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                            {aiSuggestions.suggested_pitcher_pool?.length > 0 && (
                                                <div className="px-4 pb-4">
                                                    <div className="text-xs font-bold text-[#FFB800] mb-2">Suggested Pitcher Pool</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {aiSuggestions.suggested_pitcher_pool.map((p, i) => (
                                                            <button key={i} onClick={() => {
                                                                const found = eligiblePool.find(ep => ep.OperatorPlayerName?.toLowerCase().includes(p.name.toLowerCase()))
                                                                if (found && !pitcherPool.some(pp => pp.slatePlayerId === found.SlatePlayerID)) {
                                                                    setPitcherPool(prev => [...prev, { slatePlayerId: found.SlatePlayerID, operatorPlayerName: found.OperatorPlayerName, operatorPosition: found.OperatorPosition, operatorSalary: found.OperatorSalary, team: found.Team, maxExposurePct: p.maxExposurePct || 35, source: 'ai' }])
                                                                }
                                                            }} className="px-2 py-1 rounded text-xs" style={{background:'rgba(255,184,0,0.1)', color:'#FFB800', border:'1px solid rgba(255,184,0,0.2)'}}>
                                                                + {p.name} ({p.maxExposurePct}%)
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {aiSuggestions.suggested_common_pool?.length > 0 && (
                                                <div className="px-4 pb-4">
                                                    <div className="text-xs font-bold text-[#818CF8] mb-2">Suggested Common Pool</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {aiSuggestions.suggested_common_pool.map((p, i) => (
                                                            <button key={i} onClick={() => {
                                                                const found = eligiblePool.find(ep => ep.OperatorPlayerName?.toLowerCase().includes(p.name.toLowerCase()))
                                                                if (found && !commonPool.some(cp => cp.slatePlayerId === found.SlatePlayerID)) {
                                                                    setCommonPool(prev => [...prev, { slatePlayerId: found.SlatePlayerID, operatorPlayerName: found.OperatorPlayerName, operatorPosition: found.OperatorPosition, operatorSalary: found.OperatorSalary, team: found.Team, maxExposurePct: p.maxExposurePct || 50, source: 'ai' }])
                                                                }
                                                            }} className="px-2 py-1 rounded text-xs" style={{background:'rgba(129,140,248,0.1)', color:'#818CF8', border:'1px solid rgba(129,140,248,0.2)'}}>
                                                                + {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Stack Cards */}
                                    {multiStackRules.length === 0 && !aiSuggestions && (
                                        <div className="text-center py-10 text-[#8A9BBE] text-sm rounded-xl border border-dashed border-[#223366]">
                                            No stacks yet. Add players from the pool with 🔒 or use 🤖 AI Suggest.
                                        </div>
                                    )}
                                    {multiStackRules.map(rule => (
                                        <div key={rule.id} className="mb-3 rounded-xl border overflow-hidden" style={{background:'#0F1E38', borderColor: rule.status === 'generated' ? '#22C55E' : rule.status === 'error' ? '#EF4444' : rule.status === 'generating' ? '#FFB800' : '#223366'}}>
                                            <div className="px-4 py-2.5 border-b border-[#223366] flex items-center gap-2" style={{background:'#1A2E55'}}>
                                                <span className="px-2 py-0.5 rounded text-xs font-black" style={{background:'rgba(255,184,0,0.15)', color:'#FFB800'}}>{rule.team || '—'}</span>
                                                <input value={rule.team}
                                                    onChange={e => setMultiStackRules(prev => prev.map(r => r.id === rule.id ? {...r, team: e.target.value.toUpperCase()} : r))}
                                                    placeholder="Team…"
                                                    className="text-xs bg-transparent text-white outline-none w-16"
                                                />
                                                {rule.source === 'ai' && <span className="text-xs text-[#2DD4BF]">🤖 AI</span>}
                                                <span className="ml-auto text-xs font-bold" style={{color: rule.status === 'generated' ? '#22C55E' : rule.status === 'error' ? '#EF4444' : rule.status === 'generating' ? '#FFB800' : '#8A9BBE'}}>
                                                    {rule.status === 'generated' ? `✓ ${rule.generatedLineups.length} lineups` : rule.status === 'error' ? '✗ Error' : rule.status === 'generating' ? '⚡ Generating…' : '○ Pending'}
                                                </span>
                                                <button onClick={() => generateStack(rule.id)}
                                                    disabled={rule.status === 'generating' || eligiblePool.length === 0}
                                                    className="px-2 py-1 rounded text-xs font-bold"
                                                    style={{background:'rgba(34,197,94,0.15)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.3)', opacity: (rule.status === 'generating' || eligiblePool.length === 0) ? 0.5 : 1}}>
                                                    ⚡
                                                </button>
                                                <button onClick={() => setMultiStackRules(prev => prev.filter(r => r.id !== rule.id))}
                                                    className="text-xs text-[#8A9BBE] hover:text-[#EF4444]">✕</button>
                                            </div>
                                            <div className="px-4 py-2 flex flex-wrap gap-1">
                                                {rule.lockedPlayers.map(lp => (
                                                    <span key={getLockedId(lp)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{background:'rgba(34,197,94,0.15)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.2)'}}>
                                                        {getLockedName(lp)}
                                                        <button onClick={() => setMultiStackRules(prev => prev.map(r => r.id === rule.id ? {...r, lockedPlayers: r.lockedPlayers.filter(p => getLockedId(p) !== getLockedId(lp))} : r))}
                                                            className="hover:text-[#EF4444]">×</button>
                                                    </span>
                                                ))}
                                                {rule.lockedPlayers.length === 0 && <span className="text-xs text-[#8A9BBE]">No locked players — use 🔒 in player pool</span>}
                                            </div>
                                            <div className="px-4 py-2 flex items-center gap-4 border-t border-[#1A2E55]">
                                                <div className="flex items-center gap-1 text-xs">
                                                    <span className="text-[#8A9BBE]">Lineups:</span>
                                                    <input type="number" min={1} max={150} value={rule.lineupCount}
                                                        onChange={e => setMultiStackRules(prev => prev.map(r => r.id === rule.id ? {...r, lineupCount: parseInt(e.target.value) || 1} : r))}
                                                        className="w-12 text-center text-white bg-transparent border border-[#223366] rounded px-1 outline-none" />
                                                </div>
                                                <div className="flex items-center gap-1 text-xs">
                                                    <span className="text-[#8A9BBE]">Min unique:</span>
                                                    <select value={rule.minUniquePlayers}
                                                        onChange={e => setMultiStackRules(prev => prev.map(r => r.id === rule.id ? {...r, minUniquePlayers: parseInt(e.target.value)} : r))}
                                                        className="text-white bg-transparent border border-[#223366] rounded px-1 outline-none text-xs"
                                                        style={{background:'#132244'}}>
                                                        {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {rule.status === 'error' && rule.errorMessage && (
                                                <div className="px-4 py-2 text-xs text-[#EF4444] border-t border-[#1A2E55]">{rule.errorMessage}</div>
                                            )}
                                            {rule.reasoning && (
                                                <div className="px-4 py-2 text-xs text-[#8A9BBE] border-t border-[#1A2E55] italic">{rule.reasoning}</div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Generated Lineups */}
                                    {allGeneratedLineups.length > 0 && (
                                        <div className="mt-4">
                                            {/* Filter tabs */}
                                            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                                                <button onClick={() => setActiveStackFilter('all')}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                                                    style={{background: activeStackFilter === 'all' ? 'rgba(255,184,0,0.2)' : '#132244', color: activeStackFilter === 'all' ? '#FFB800' : '#8A9BBE', border: '1px solid ' + (activeStackFilter === 'all' ? '#FFB800' : '#223366')}}>
                                                    All ({allGeneratedLineups.length})
                                                </button>
                                                {multiStackRules.filter(r => r.status === 'generated').map(rule => (
                                                    <button key={rule.id} onClick={() => setActiveStackFilter(rule.id)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                                                        style={{background: activeStackFilter === rule.id ? 'rgba(255,184,0,0.2)' : '#132244', color: activeStackFilter === rule.id ? '#FFB800' : '#8A9BBE', border: '1px solid ' + (activeStackFilter === rule.id ? '#FFB800' : '#223366')}}>
                                                        {rule.team} ({rule.generatedLineups.length})
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Lineup cards */}
                                            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))', gap:'12px'}}>
                                                {(activeStackFilter === 'all' ? allGeneratedLineups : allGeneratedLineups.filter(l => l.stackId === activeStackFilter)).map((luObj, i) => {
                                                    const lu = luObj.lineup
                                                    const teamName = luObj.team
                                                    const totalSal = lu.reduce((s, p) => s + (p?.OperatorSalary || 0), 0)
                                                    const totalProj = lu.reduce((s, p) => s + (p ? getProjection(p) : 0), 0)
                                                    return (
                                                        <div key={i} className="rounded-xl border border-[#223366] overflow-hidden" style={{background:'#0F1E38'}}>
                                                            <div className="px-3 py-2 flex items-center justify-between border-b border-[#223366]" style={{background:'#1A2E55'}}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-[#8A9BBE]">#{i+1}</span>
                                                                    {teamName && <span className="px-2 py-0.5 rounded text-xs font-bold" style={{background:'rgba(255,184,0,0.15)', color:'#FFB800'}}>{teamName}</span>}
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs">
                                                                    <span className="text-[#8A9BBE]">${totalSal.toLocaleString()}</span>
                                                                    <span className="text-[#FFB800] font-bold">{totalProj.toFixed(1)} pts</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-2 space-y-0.5">
                                                                {slots.map((slot, si) => {
                                                                    const p = lu[si]
                                                                    const isStack = p?.Team === teamName
                                                                    return (
                                                                        <div key={si} className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                                                                            style={{background: isStack ? 'rgba(255,184,0,0.08)' : 'transparent'}}>
                                                                            <span className="w-6 text-[#8A9BBE]">{slot}</span>
                                                                            {p ? (
                                                                                <>
                                                                                    <span style={{flex:1, color: isStack ? '#FFB800' : 'white', fontWeight: isStack ? 700 : 400}}>{p.OperatorPlayerName}</span>
                                                                                    <span className="text-[#8A9BBE]">{p.Team}</span>
                                                                                    <span className="text-[#22C55E]">{getProjection(p).toFixed(1)}</span>
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-[#EF4444]">EMPTY</span>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Exposure summary */}
                                            <div className="mt-4 rounded-xl border border-[#223366] overflow-hidden" style={{background:'#0F1E38'}}>
                                                <div className="px-4 py-2 border-b border-[#223366]" style={{background:'#1A2E55'}}>
                                                    <span className="text-xs font-black text-white">Player Exposure ({allGeneratedLineups.length} lineups)</span>
                                                </div>
                                                <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)'}}>
                                                    {(() => {
                                                        const counts = {}
                                                        allGeneratedLineups.forEach(luObj => luObj.lineup.forEach(p => {
                                                            if (!p) return
                                                            if (!counts[p.SlatePlayerID]) counts[p.SlatePlayerID] = { player: p, count: 0 }
                                                            counts[p.SlatePlayerID].count++
                                                        }))
                                                        return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 30).map(({ player, count }) => (
                                                            <div key={player.SlatePlayerID} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1A2E55] text-xs">
                                                                <span className="text-[#8A9BBE] w-6">{player.OperatorPosition}</span>
                                                                <span className="text-white flex-1 truncate">{player.OperatorPlayerName}</span>
                                                                <span className="text-[#8A9BBE]">{player.Team}</span>
                                                                <span className="text-[#FFB800] font-bold">{Math.round((count / allGeneratedLineups.length) * 100)}%</span>
                                                            </div>
                                                        ))
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stack Assignment Modal */}
                            {showStackModal && stackModalPlayer && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.7)'}}>
                                    <div className="w-80 rounded-2xl border border-[#223366] p-6" style={{background:'#0F1E38'}}>
                                        <h3 className="text-sm font-black text-white mb-4">Add {stackModalPlayer.OperatorPlayerName} to stack:</h3>
                                        <div className="space-y-2">
                                            {multiStackRules.map(rule => (
                                                <button key={rule.id}
                                                    onClick={() => {
                                                        const payload = { slatePlayerId: stackModalPlayer.SlatePlayerID, operatorPlayerName: stackModalPlayer.OperatorPlayerName, operatorPosition: stackModalPlayer.OperatorPosition, operatorSalary: stackModalPlayer.OperatorSalary }
                                                        if (!rule.lockedPlayers.some(lp => getLockedId(lp) === stackModalPlayer.SlatePlayerID)) {
                                                            setMultiStackRules(prev => prev.map(r => r.id === rule.id ? {...r, lockedPlayers: [...r.lockedPlayers, payload], team: r.team || stackModalPlayer.Team} : r))
                                                        }
                                                        setShowStackModal(false)
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-white border border-[#223366] hover:border-[#FFB800] transition-all"
                                                    style={{background:'#132244'}}>
                                                    <span className="font-bold text-[#FFB800]">{rule.team || 'Unnamed'}</span>{' '}— {rule.lockedPlayers.length} players, {rule.lineupCount} lineups
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    const payload = { slatePlayerId: stackModalPlayer.SlatePlayerID, operatorPlayerName: stackModalPlayer.OperatorPlayerName, operatorPosition: stackModalPlayer.OperatorPosition, operatorSalary: stackModalPlayer.OperatorSalary }
                                                    setMultiStackRules(prev => [...prev, { id: crypto.randomUUID(), team: stackModalPlayer.Team || '', lockedPlayers: [payload], lineupCount: 10, minUniquePlayers: 2, reasoning: '', source: 'manual', status: 'pending', errorMessage: '', generatedLineups: [] }])
                                                    setShowStackModal(false)
                                                }}
                                                className="w-full px-3 py-2 rounded-lg text-xs font-bold border border-[#2DD4BF] text-[#2DD4BF]"
                                                style={{background:'rgba(45,212,191,0.1)'}}>
                                                + Create New Stack with this player
                                            </button>
                                        </div>
                                        <button onClick={() => setShowStackModal(false)} className="mt-4 w-full text-xs text-[#8A9BBE] hover:text-white">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* ──── END MULTI-STACK BUILDER ──────────────────────────── */}

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
                            { id: 'excluded', label: `EXCLUDED${legacyRules.excludedPlayers.length > 0 ? ` (${legacyRules.excludedPlayers.length})` : ''}` },
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
                                                            {/* Add to lineup */}
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
                                                            {/* Add to stack */}
                                                            <button
                                                                onClick={() => setAssignModalPlayer(player)}
                                                                title="Add to stack"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: multiStackRules.some(s => s.lockedPlayers.find(p => getLockedId(p) === player.SlatePlayerID)) ? 'rgba(34,197,94,0.2)' : 'transparent',
                                                                    color: multiStackRules.some(s => s.lockedPlayers.find(p => getLockedId(p) === player.SlatePlayerID)) ? '#22C55E' : '#8A9BBE',
                                                                    border: '1px solid rgba(34,51,102,0.5)'
                                                                }}>
                                                                🔒
                                                            </button>
                                                            {/* Pitcher pool */}
                                                            {(player.OperatorPosition === 'SP' || player.OperatorPosition === 'RP') && (
                                                                <button
                                                                    onClick={() => addToPitcherPool(player)}
                                                                    title="Add to pitcher pool"
                                                                    className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                    style={{
                                                                        background: pitcherPool.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(255,184,0,0.2)' : 'transparent',
                                                                        color: pitcherPool.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#FFB800' : '#8A9BBE',
                                                                        border: '1px solid rgba(34,51,102,0.5)'
                                                                    }}>
                                                                    ⚾
                                                                </button>
                                                            )}
                                                            {/* Common pool */}
                                                            {player.OperatorPosition !== 'SP' && player.OperatorPosition !== 'RP' && (
                                                                <button
                                                                    onClick={() => addToCommonPool(player)}
                                                                    title="Add to common pool"
                                                                    className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                    style={{
                                                                        background: commonPool.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(99,102,241,0.2)' : 'transparent',
                                                                        color: commonPool.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#818CF8' : '#8A9BBE',
                                                                        border: '1px solid rgba(34,51,102,0.5)'
                                                                    }}>
                                                                    🎯
                                                                </button>
                                                            )}
                                                            {/* Exclude */}
                                                            <button
                                                                onClick={() => {
                                                                    const inExcluded = legacyRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID)
                                                                    setLegacyRules(prev => ({
                                                                        ...prev,
                                                                        excludedPlayers: inExcluded
                                                                            ? prev.excludedPlayers.filter(p => p.SlatePlayerID !== player.SlatePlayerID)
                                                                            : [...prev.excludedPlayers, player]
                                                                    }))
                                                                }}
                                                                title="Exclude player"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-xs transition-all"
                                                                style={{
                                                                    background: legacyRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? 'rgba(239,68,68,0.2)' : 'transparent',
                                                                    color: legacyRules.excludedPlayers.find(p => p.SlatePlayerID === player.SlatePlayerID) ? '#EF4444' : '#8A9BBE',
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
                                                        {sport === 'nfl' && ['RB', 'WR', 'TE'].includes(player.OperatorPosition) && (
                                                            <span className="text-xs px-1 py-0 rounded ml-1"
                                                                style={{ background: 'rgba(251,146,60,0.15)', color: '#FB923C', fontSize: '9px' }}>
                                                                FLEX
                                                            </span>
                                                        )}
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
                                        {legacyRules.lockedPlayers.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                                                🔒 {legacyRules.lockedPlayers.length} locked
                                            </span>
                                        )}
                                        {fillPool.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                                                🎯 {fillPool.length} fill pool
                                            </span>
                                        )}
                                        {legacyRules.excludedPlayers.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                                ✕ {legacyRules.excludedPlayers.length} excluded
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
                                                                            {legacyRules.lockedPlayers.find(lp => lp.SlatePlayerID === player.SlatePlayerID) && (
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
                                    {legacyRules.lockedPlayers.length > 0 && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#8A9BBE]">
                                            <span>🔒</span>
                                            <span>{legacyRules.lockedPlayers.length} locked players in all lineups</span>
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

            {/* Stack Builder Panel */}
            {showGameFilters && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setShowGameFilters(false)} />

                    <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-[#223366] overflow-hidden"
                        style={{ background: '#0F1E38', width: '460px' }}>

                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#223366]"
                            style={{ background: '#1A2E55' }}>
                            <div className="text-base font-black text-white">🔗 Stack Builder</div>
                            <button onClick={() => setShowGameFilters(false)}
                                className="text-[#8A9BBE] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#223366]">
                                ✕
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#223366] shrink-0">
                            {[
                                { id: 'stacks', label: '🔗 Stacks', badge: multiStackRules.length || null },
                                { id: 'pitchers', label: '⚾ Pitchers', badge: pitcherPool.length || null },
                                { id: 'common', label: '🎯 Common Pool', badge: commonPool.length || null },
                                { id: 'rules', label: '⚙️ Rules' },
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setGameFiltersTab(tab.id)}
                                    className="flex-1 py-3 text-xs font-bold border-b-2 transition-all relative"
                                    style={{
                                        borderColor: gameFiltersTab === tab.id ? '#FFB800' : 'transparent',
                                        color: gameFiltersTab === tab.id ? '#FFB800' : '#8A9BBE',
                                        background: gameFiltersTab === tab.id ? 'rgba(255,184,0,0.05)' : 'transparent'
                                    }}>
                                    {tab.label}
                                    {tab.badge > 0 && (
                                        <span className="ml-1 px-1 rounded-full text-xs font-black"
                                            style={{ background: '#FFB800', color: '#0A1628', fontSize: '10px' }}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4">

                            {/* STACKS TAB */}
                            {gameFiltersTab === 'stacks' && (
                                <div className="space-y-3">
                                    {sport === 'nfl' && (
                                        <div className="mb-1 p-3 rounded-xl border border-[#223366]" style={{ background: '#132244' }}>
                                            <div className="text-xs font-bold text-[#FFB800] mb-1">🏈 NFL Stack Logic</div>
                                            <div className="text-xs text-[#8A9BBE]">
                                                Click 🔒 on a QB in the player pool to start a stack, then add WR/TE teammates
                                                to the same stack. The optimizer requires that QB plus 2+ pass catchers from
                                                his team, and will look to bring back a pass catcher from the opposing team.
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-[#8A9BBE]">Each stack locks players into lineups and generates them separately.</div>
                                        <button
                                            onClick={() => addStack('', null)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                                            style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                                            + Add Stack
                                        </button>
                                    </div>

                                    {multiStackRules.length === 0 ? (
                                        <div className="text-center py-10 rounded-xl border border-dashed border-[#223366]">
                                            <div className="text-3xl mb-2">🔗</div>
                                            <div className="text-sm font-bold text-white mb-1">No stacks yet</div>
                                            <div className="text-xs text-[#8A9BBE] mb-3">Click + Add Stack or use 🔒 on a player</div>
                                            <button
                                                onClick={() => addStack('', null)}
                                                className="px-4 py-2 rounded-lg text-xs font-bold"
                                                style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                                                + Add Stack
                                            </button>
                                        </div>
                                    ) : (
                                        multiStackRules.map((rule, idx) => (
                                            <div key={rule.id} className="p-3 rounded-xl border"
                                                style={{
                                                    background: '#0A1628',
                                                    borderColor: rule.status === 'done' ? '#22C55E' : rule.status === 'generating' ? '#FFB800' : '#223366'
                                                }}>
                                                {/* Stack header */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="text-xs text-[#8A9BBE] shrink-0">#{idx + 1}</div>
                                                    <input
                                                        value={rule.team}
                                                        onChange={e => updateStack(rule.id, { team: e.target.value.toUpperCase() })}
                                                        placeholder="TEAM"
                                                        className="w-16 px-2 py-1 rounded text-xs font-black text-center outline-none border border-[#223366] focus:border-[#FFB800] text-white uppercase"
                                                        style={{ background: '#132244' }}
                                                        maxLength={4}
                                                    />
                                                    <div className="flex items-center gap-1 ml-1">
                                                        <span className="text-xs text-[#8A9BBE]">Lineups:</span>
                                                        <input
                                                            type="number"
                                                            value={rule.lineupCount}
                                                            onChange={e => updateStack(rule.id, { lineupCount: Math.max(1, parseInt(e.target.value) || 1) })}
                                                            className="w-12 px-1 py-1 rounded text-xs font-bold text-center outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                                            style={{ background: '#132244' }}
                                                            min={1}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-[#8A9BBE]">Min unique:</span>
                                                        <input
                                                            type="number"
                                                            value={rule.minUniquePlayers}
                                                            onChange={e => updateStack(rule.id, { minUniquePlayers: Math.max(1, parseInt(e.target.value) || 1) })}
                                                            className="w-10 px-1 py-1 rounded text-xs font-bold text-center outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                                            style={{ background: '#132244' }}
                                                            min={1}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeStack(rule.id)}
                                                        className="ml-auto text-[#8A9BBE] hover:text-[#EF4444] transition-colors text-xs shrink-0">
                                                        ✕
                                                    </button>
                                                </div>

                                                {/* Locked players */}
                                                <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                                                    {rule.lockedPlayers.length === 0 ? (
                                                        <div className="text-xs text-[#8A9BBE] italic">No locked players — click 🔒 on any player</div>
                                                    ) : rule.lockedPlayers.map(p => (
                                                        <span key={getLockedId(p)}
                                                            className="px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
                                                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                                                            {getLockedName(p)}
                                                            <button onClick={() => removePlayerFromStack(rule.id, getLockedId(p))}
                                                                className="hover:text-white">✕</button>
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Generate button */}
                                                <div className="flex items-center gap-2">
                                                    {rule.status === 'generated' && (
                                                        <div className="text-xs text-[#22C55E] font-bold">
                                                            ✓ {rule.generatedLineups?.length || 0} lineups generated
                                                        </div>
                                                    )}
                                                    {rule.status === 'error' && (
                                                        <div className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                                            ⚠ {rule.error || 'Error generating — check console'}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => generateStack(rule.id)}
                                                        disabled={rule.status === 'generating' || eligiblePool.length === 0}
                                                        className="ml-auto px-4 py-1.5 rounded-lg text-xs font-black transition-all"
                                                        style={{
                                                            background: rule.status === 'generating' ? 'rgba(255,184,0,0.1)' : 'linear-gradient(135deg, #FFB800, #E6A500)',
                                                            color: rule.status === 'generating' ? '#FFB800' : '#0A1628',
                                                            opacity: eligiblePool.length === 0 ? 0.5 : 1
                                                        }}>
                                                        {rule.status === 'generating'
                                                            ? '⚡ Generating...'
                                                            : rule.status === 'generated'
                                                                ? `✓ ${rule.generatedLineups?.length || 0} done`
                                                                : '▶ Generate'
                                                        }
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    {multiStackRules.length > 0 && (
                                        <button
                                            onClick={generateAllStacks}
                                            disabled={multiStackRules.length === 0 || eligiblePool.length === 0 || multiStackRules.every(s => s.status === 'generated')}
                                            className="w-full py-3 rounded-xl text-sm font-black transition-all"
                                            style={{
                                                background: 'linear-gradient(135deg, #FFB800, #E6A500)',
                                                color: '#0A1628',
                                                opacity: multiStackRules.length === 0 ? 0.5 : 1
                                            }}>
                                            ▶ Generate All Stacks ({multiStackRules.filter(s => s.status !== 'generated').length} pending)
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* PITCHERS TAB */}
                            {gameFiltersTab === 'pitchers' && (
                                <div className="space-y-3">
                                    <div className="text-xs text-[#8A9BBE]">
                                        Whitelist pitchers eligible for generated lineups. Click ⚾ on any pitcher in the player table. If empty, all pitchers are eligible.
                                    </div>

                                    {pitcherPool.length === 0 ? (
                                        <div className="text-center py-10 rounded-xl border border-dashed border-[#223366]">
                                            <div className="text-3xl mb-2">⚾</div>
                                            <div className="text-sm font-bold text-white mb-1">No pitcher pool set</div>
                                            <div className="text-xs text-[#8A9BBE]">Click ⚾ on any SP/RP in the player table</div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-bold text-[#FFB800]">{pitcherPool.length} pitchers in pool</div>
                                                <button onClick={() => setPitcherPool([])} className="text-xs text-[#EF4444] hover:underline">Clear All</button>
                                            </div>
                                            <div className="space-y-2">
                                                {pitcherPool.map(player => (
                                                    <div key={player.SlatePlayerID}
                                                        className="p-3 rounded-xl border border-[#223366]"
                                                        style={{ background: '#0A1628' }}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-bold text-white truncate">{player.OperatorPlayerName}</div>
                                                                <div className="text-xs text-[#8A9BBE]">{player.Team} · {player.OperatorPosition} · ${player.OperatorSalary?.toLocaleString()}</div>
                                                            </div>
                                                            <button onClick={() => setPitcherPool(prev => prev.filter(p => p.SlatePlayerID !== player.SlatePlayerID))}
                                                                className="text-[#8A9BBE] hover:text-[#EF4444] text-xs shrink-0">✕</button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-[#8A9BBE]">Max exposure:</span>
                                                            <input
                                                                type="range" min="5" max="100" step="5"
                                                                value={player.maxExposurePct || 35}
                                                                onChange={e => setPitcherPool(prev => prev.map(p => p.SlatePlayerID === player.SlatePlayerID ? { ...p, maxExposurePct: parseInt(e.target.value) } : p))}
                                                                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                                                                style={{ background: `linear-gradient(to right, #FFB800 0%, #FFB800 ${player.maxExposurePct || 35}%, #223366 ${player.maxExposurePct || 35}%, #223366 100%)` }}
                                                            />
                                                            <span className="text-xs font-bold text-[#FFB800] w-8 text-right">{player.maxExposurePct || 35}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* COMMON POOL TAB */}
                            {gameFiltersTab === 'common' && (
                                <div className="space-y-3">
                                    <div className="text-xs text-[#8A9BBE]">
                                        Hitters eligible to appear across all stacks. Click 🎯 on any hitter in the player table. If empty, full hitter pool is used.
                                    </div>

                                    {commonPool.length === 0 ? (
                                        <div className="text-center py-10 rounded-xl border border-dashed border-[#223366]">
                                            <div className="text-3xl mb-2">🎯</div>
                                            <div className="text-sm font-bold text-white mb-1">No common pool set</div>
                                            <div className="text-xs text-[#8A9BBE]">Click 🎯 on any hitter in the player table</div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-bold text-[#818CF8]">{commonPool.length} players in common pool</div>
                                                <button onClick={() => setCommonPool([])} className="text-xs text-[#EF4444] hover:underline">Clear All</button>
                                            </div>
                                            <div className="space-y-2">
                                                {commonPool.map(player => (
                                                    <div key={player.SlatePlayerID}
                                                        className="p-3 rounded-xl border border-[#223366]"
                                                        style={{ background: '#0A1628' }}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-bold text-white truncate">{player.OperatorPlayerName}</div>
                                                                <div className="text-xs text-[#8A9BBE]">{player.Team} · {player.OperatorPosition} · ${player.OperatorSalary?.toLocaleString()}</div>
                                                            </div>
                                                            <button onClick={() => setCommonPool(prev => prev.filter(p => p.SlatePlayerID !== player.SlatePlayerID))}
                                                                className="text-[#8A9BBE] hover:text-[#EF4444] text-xs shrink-0">✕</button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-[#8A9BBE]">Max exposure:</span>
                                                            <input
                                                                type="range" min="5" max="100" step="5"
                                                                value={player.maxExposurePct || 50}
                                                                onChange={e => setCommonPool(prev => prev.map(p => p.SlatePlayerID === player.SlatePlayerID ? { ...p, maxExposurePct: parseInt(e.target.value) } : p))}
                                                                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                                                                style={{ background: `linear-gradient(to right, #818CF8 0%, #818CF8 ${player.maxExposurePct || 50}%, #223366 ${player.maxExposurePct || 50}%, #223366 100%)` }}
                                                            />
                                                            <span className="text-xs font-bold text-[#818CF8] w-8 text-right">{player.maxExposurePct || 50}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

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
                                                        <button key={n} onClick={() => setLegacyRules(prev => ({ ...prev, minFromSameTeam: n }))}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: legacyRules.minFromSameTeam === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: legacyRules.minFromSameTeam === n ? '#FFB800' : '#223366',
                                                                color: legacyRules.minFromSameTeam === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white mb-2">Max from same team</div>
                                                <div className="flex gap-1">
                                                    {[3,4,5,6].map(n => (
                                                        <button key={n} onClick={() => setLegacyRules(prev => ({ ...prev, maxFromSameTeam: n }))}
                                                            className="px-2.5 py-1 rounded text-xs font-bold border transition-all"
                                                            style={{
                                                                background: legacyRules.maxFromSameTeam === n ? 'rgba(255,184,0,0.1)' : '#0A1628',
                                                                borderColor: legacyRules.maxFromSameTeam === n ? '#FFB800' : '#223366',
                                                                color: legacyRules.maxFromSameTeam === n ? '#FFB800' : '#8A9BBE'
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {legacyRules.excludedPlayers.length > 0 && (
                                        <div className="pb-4 border-b border-[#223366]">
                                            <div className="text-xs text-[#EF4444] font-bold mb-2">✕ Excluded Players</div>
                                            <div className="flex flex-wrap gap-1">
                                                {legacyRules.excludedPlayers.map(p => (
                                                    <span key={p.SlatePlayerID}
                                                        className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1"
                                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                        {p.OperatorPlayerName}
                                                        <button onClick={() => setLegacyRules(prev => ({ ...prev, excludedPlayers: prev.excludedPlayers.filter(ep => ep.SlatePlayerID !== p.SlatePlayerID) }))}
                                                            className="hover:text-white ml-1">✕</button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setLegacyRules(prev => ({ ...prev, minFromSameTeam: 0, maxFromSameTeam: 5, excludedPlayers: [] }))
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
                                {sport === 'nfl'
                                    ? 'first_name, last_name, position, team, salary, ppg_projection, opp'
                                    : 'first_name, last_name, position, team, salary, ppg_projection'}
                            </div>
                            <input type="file" accept=".csv" onChange={handleManualSlateUpload} className="hidden" />
                        </label>

                        {sport === 'nfl' && (
                            <div className="mt-4 p-3 rounded-lg border border-[#223366]"
                                style={{ background: 'rgba(255,184,0,0.05)' }}>
                                <div className="text-xs font-bold text-[#FFB800] mb-1">🏈 NFL position values</div>
                                <div className="text-xs text-[#8A9BBE]">
                                    position column: QB, RB, WR, TE, K, DST (or DEF / D/ST). For defense rows, first_name/last_name
                                    can be left blank — the team name is used (e.g. &ldquo;Patriots D/ST&rdquo;).
                                </div>
                            </div>
                        )}

                        <div className="mt-4 p-3 rounded-lg border border-[#223366]"
                            style={{ background: '#0A1628' }}>
                            <div className="text-xs font-bold text-[#8A9BBE] uppercase tracking-wider mb-2">
                                Required Columns
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {(sport === 'nfl'
                                    ? ['first_name', 'last_name', 'position', 'team', 'salary', 'ppg_projection', 'opp', 'ownership_projection']
                                    : ['first_name', 'last_name', 'position', 'team', 'salary', 'ppg_projection']
                                ).map(col => (
                                    <span key={col} className="px-2 py-0.5 rounded text-xs font-mono"
                                        style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}>
                                        {col}
                                    </span>
                                ))}
                            </div>
                            <div className="text-xs text-[#8A9BBE] mt-2">
                                Optional: {sport === 'nfl' ? 'value_projection, confirmed_order, over_under, spread' : 'opp, ownership_projection, value_projection, confirmed_order, over_under, implied_team_score'}
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

            {/* Stack Assignment Modal */}
            {assignModalPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)' }}>
                    <div className="w-full max-w-sm p-6 rounded-2xl border border-[#223366] mx-4"
                        style={{ background: '#132244' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-lg font-black text-white">🔒 Add to Stack</div>
                                <div className="text-sm text-[#8A9BBE] mt-1">{assignModalPlayer.OperatorPlayerName}</div>
                            </div>
                            <button onClick={() => setAssignModalPlayer(null)}
                                className="text-[#8A9BBE] hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#223366]">
                                ✕
                            </button>
                        </div>

                        {multiStackRules.length === 0 ? (
                            <div className="text-center py-6">
                                <div className="text-2xl mb-2">🔗</div>
                                <div className="text-sm text-white mb-1">No stacks yet</div>
                                <div className="text-xs text-[#8A9BBE] mb-4">Create a stack first, then assign players to it.</div>
                                <button
                                    onClick={() => {
                                        const newId = addStack(assignModalPlayer.Team, assignModalPlayer)
                                        setAssignModalPlayer(null)
                                        setShowGameFilters(true)
                                        setGameFiltersTab('stacks')
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold"
                                    style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                                    + Create New Stack with this Player
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-xs text-[#8A9BBE] mb-3">Select a stack to add this player to:</div>
                                <div className="space-y-2 mb-4">
                                    {multiStackRules.map((rule, idx) => {
                                        const alreadyIn = rule.lockedPlayers.find(p => getLockedId(p) === assignModalPlayer.SlatePlayerID)
                                        return (
                                            <button
                                                key={rule.id}
                                                onClick={() => {
                                                    if (!alreadyIn) addPlayerToStack(rule.id, assignModalPlayer)
                                                    setAssignModalPlayer(null)
                                                }}
                                                disabled={!!alreadyIn}
                                                className="w-full p-3 rounded-xl border text-left transition-all"
                                                style={{
                                                    background: alreadyIn ? 'rgba(34,197,94,0.08)' : '#0A1628',
                                                    borderColor: alreadyIn ? '#22C55E' : '#223366',
                                                    opacity: alreadyIn ? 0.7 : 1
                                                }}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-bold text-white">
                                                            #{idx + 1} {rule.team || '—'}
                                                        </div>
                                                        <div className="text-xs text-[#8A9BBE]">
                                                            {rule.lockedPlayers.length} locked · {rule.lineupCount} lineups
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-bold"
                                                        style={{ color: alreadyIn ? '#22C55E' : '#8A9BBE' }}>
                                                        {alreadyIn ? '✓ Added' : '+ Add'}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                                <button
                                    onClick={() => {
                                        addStack(assignModalPlayer.Team, assignModalPlayer)
                                        setAssignModalPlayer(null)
                                    }}
                                    className="w-full py-2 rounded-lg text-xs font-bold border transition-all"
                                    style={{ background: 'transparent', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                                    + Create New Stack with this Player
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}