'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ─── CSV parser for player pool sources ───────────────────────────────────
const parsePlayerCSV = (csvText) => {
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',')
        .map(h => h.trim().toLowerCase())

    const idx = (name) => headers.indexOf(name)

    const players = []
    lines.slice(1).forEach(line => {
        if (!line.trim()) return
        const cols = line.split(',')

        const firstName = (cols[idx('first_name')] || '').trim()
        const lastName = (cols[idx('last_name')] || '').trim()
        const name = `${firstName} ${lastName}`.trim()
        const pos = (cols[idx('position')] || '').trim().toUpperCase()
        const team = (cols[idx('team')] || '').trim().toUpperCase()
        const salary = parseInt(cols[idx('salary')]) || 0
        const proj = parseFloat(cols[idx('ppg_projection')]) || 0
        const own = parseFloat(cols[idx('ownership_projection')]) || 0
        const opp = (cols[idx('opp')] || '').trim().toUpperCase()

        if (!name || !salary) return

        players.push({ name, pos, team, salary, proj, own, opp })
    })

    return players
}

const buildPlayerPoolContext = (players) => {
    // Build a compact but complete text representation for Claude to reason over
    const byPosition = {}
    players.forEach(p => {
        if (!byPosition[p.pos]) byPosition[p.pos] = []
        byPosition[p.pos].push(p)
    })

    let context = `PLAYER POOL (${players.length} players):\n\n`

    Object.entries(byPosition).forEach(([pos, posPlayers]) => {
        posPlayers.sort((a, b) => b.proj - a.proj)
        context += `${pos}:\n`
        posPlayers.forEach(p => {
            context += `  ${p.name} (${p.team}${p.opp ? ' vs ' + p.opp : ''}) `
            context += `$${p.salary.toLocaleString()} `
            context += `Proj:${p.proj} Own:${p.own}%\n`
        })
        context += '\n'
    })

    return context
}

// Rough client-side token estimate (~4 chars/token for English) — good enough
// for a "is this context getting big" warning, not meant to be exact.
const estimateTokens = (text) => Math.ceil((text || '').length / 4)

// Best-effort "who's the stack" guess for highlighting — the API doesn't mark
// this explicitly per player, so infer it from whichever team appears most
// among skill-position players (mirrors the same heuristic used elsewhere
// in this app for rebalancing exposure).
const getStackTeam = (players) => {
    const counts = {}
    players.forEach(p => {
        if (!p.team) return
        counts[p.team] = (counts[p.team] || 0) + 1
    })
    const [team, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0]
    return count >= 2 ? team : null
}

const POS_COLORS = {
    QB: '#FFB800', RB: '#22C55E', WR: '#818CF8', TE: '#FB923C', K: '#A78BFA', DST: '#2DD4BF', DEF: '#2DD4BF', FLEX: '#FB923C',
    P: '#FFB800', SP: '#FFB800', RP: '#FFB800', C: '#A78BFA', '1B': '#818CF8', '2B': '#F472B6', '3B': '#FB923C', SS: '#2DD4BF', OF: '#22C55E',
}
const posColor = (pos) => POS_COLORS[pos] || '#8A9BBE'

const exportLineupsCSV = (lineups, sport) => {
    const sport_slots = sport === 'nfl'
        ? ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST']
        : ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF']

    const rows = [sport_slots.join(',')]

    lineups.forEach(lu => {
        const row = lu.players.map(p => p.name).join(',')
        rows.push(row)
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dfsszn_chat_lineups_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

const SUGGESTIONS = [
    'Generate 10 GPP lineups for tonight',
    'Which QBs should I stack?',
    'Who does the injury report affect?',
    'What stacks did the analysts recommend?',
    'Build me a contrarian portfolio',
    "What's the best value play at RB?",
]

export default function DfsChat() {
    const [sport, setSport] = useState('nfl')
    const [platform, setPlatform] = useState('draftkings')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sources, setSources] = useState([])
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [generatedLineups, setGeneratedLineups] = useState([])
    const messagesEndRef = useRef(null)
    const textareaRef = useRef(null)

    // Which of the four source sections are expanded
    const [expanded, setExpanded] = useState({ csv: true, injury: true, transcripts: true, vegas: true })

    // Section-local UI state
    const [injuryPasteOpen, setInjuryPasteOpen] = useState(false)
    const [injuryPasteText, setInjuryPasteText] = useState('')
    const [transcriptFormOpen, setTranscriptFormOpen] = useState(false)
    const [transcriptName, setTranscriptName] = useState('')
    const [transcriptText, setTranscriptText] = useState('')
    const [vegasNotes, setVegasNotes] = useState('')

    // ─── Auto-scroll to newest message ─────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ─── Auto-resize the input textarea, capped at ~4 rows ─────────────────
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const maxHeight = 4 * 24 // ~4 rows at a 24px line height
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    }, [input])

    // ─── Source helpers ─────────────────────────────────────────────────────
    const removeSource = (id) => setSources(prev => prev.filter(s => s.id !== id))
    const clearAllSources = () => setSources([])

    const upsertSource = (id, updates) => {
        setSources(prev => {
            const exists = prev.some(s => s.id === id)
            if (!exists) return prev
            return prev.map(s => s.id === id ? { ...s, ...updates } : s)
        })
    }

    // SECTION 1 — Player pool CSV
    const handleCsvUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const id = `csv-${Date.now()}`

        setSources(prev => [...prev, {
            id, type: 'csv', name: file.name, content: '', summary: 'Processing…',
            size: 0, uploadedAt: new Date(), status: 'processing',
        }])

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const players = parsePlayerCSV(event.target.result)
                if (players.length === 0) {
                    upsertSource(id, { summary: 'No players found — check column headers', status: 'error' })
                    return
                }
                const content = buildPlayerPoolContext(players)
                const positions = [...new Set(players.map(p => p.pos))].filter(Boolean)
                upsertSource(id, {
                    content,
                    summary: `${players.length} players · ${positions.join(', ')}`,
                    size: content.length,
                    status: 'ready',
                })
            } catch (err) {
                upsertSource(id, { summary: 'Failed to parse CSV', status: 'error' })
            }
        }
        reader.onerror = () => upsertSource(id, { summary: 'Failed to read file', status: 'error' })
        reader.readAsText(file)
        e.target.value = ''
    }

    // SECTION 2 — Injury report: PDF or pasted text
    const handlePdfUpload = async (file) => {
        const id = `pdf-${Date.now()}`

        setSources(prev => [...prev, {
            id, type: 'pdf', name: file.name, content: '', summary: 'Processing…',
            size: 0, uploadedAt: new Date(), status: 'processing',
        }])

        try {
            // Try reading as text first — some PDFs are plain text under the hood.
            // This is a heuristic, not real PDF parsing: a genuine binary PDF will
            // often still decode to a long (if garbled) string, so it can slip
            // through as "ready" with unusable content — paste the text manually
            // if the assistant's answers about it look off.
            const text = await file.text()

            if (text.length > 100) {
                upsertSource(id, {
                    content: text,
                    summary: `${file.name} (${text.length.toLocaleString()} chars)`,
                    size: text.length,
                    status: 'ready',
                })
            } else {
                upsertSource(id, {
                    summary: 'Binary PDF — please paste text content instead',
                    status: 'error',
                })
            }
        } catch (err) {
            upsertSource(id, {
                summary: 'Failed to read PDF — paste text instead',
                status: 'error',
            })
        }
    }

    const saveInjuryPaste = () => {
        if (!injuryPasteText.trim()) return
        const id = `injury-${Date.now()}`
        const content = injuryPasteText.trim()
        setSources(prev => [...prev, {
            id, type: 'pdf', name: 'Injury Report (pasted)', content,
            summary: `Pasted text (${content.length.toLocaleString()} chars)`,
            size: content.length, uploadedAt: new Date(), status: 'ready',
        }])
        setInjuryPasteText('')
        setInjuryPasteOpen(false)
    }

    // SECTION 3 — Expert transcripts / articles
    const addTranscriptSource = () => {
        if (!transcriptName.trim() || !transcriptText.trim()) return
        const content = transcriptText.trim()
        setSources(prev => [...prev, {
            id: `transcript-${Date.now()}`,
            type: 'transcript',
            name: transcriptName.trim(),
            content,
            summary: `${content.length.toLocaleString()} chars`,
            size: content.length,
            uploadedAt: new Date(),
            status: 'ready',
        }])
        setTranscriptName('')
        setTranscriptText('')
        setTranscriptFormOpen(false)
    }

    // SECTION 4 — Vegas / game data (single manual-entry source, upserted)
    const saveVegasNotes = () => {
        if (!vegasNotes.trim()) return
        const content = vegasNotes.trim()
        setSources(prev => {
            const existing = prev.find(s => s.id === 'vegas-notes')
            const updated = {
                id: 'vegas-notes', type: 'manual', name: 'Vegas & Game Notes', content,
                summary: `${content.length.toLocaleString()} chars`,
                size: content.length, uploadedAt: new Date(), status: 'ready',
            }
            if (existing) return prev.map(s => s.id === 'vegas-notes' ? updated : s)
            return [...prev, updated]
        })
    }

    const hasPlayerPool = sources.some(s => s.type === 'csv' && s.status === 'ready')
    const totalTokens = estimateTokens(sources.filter(s => s.status === 'ready').map(s => s.content).join('\n'))

    // ─── Send message ───────────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!input.trim() || loading) return

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)

        // Add a placeholder assistant message
        const assistantId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: '...',
            lineups: [],
            timestamp: new Date(),
            status: 'loading',
        }])

        try {
            const response = await fetch('/api/chat-lineup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    messages: messages.slice(-4),
                    sources: sources.filter(s => s.status === 'ready')
                        .map(s => ({
                            type: s.type,
                            name: s.name,
                            content: s.content,
                        })),
                    sport,
                    platform,
                    slots: sport === 'nfl'
                        ? ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST']
                        : ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'],
                    salaryCap: platform === 'fanduel' ? 60000 : 50000,
                }),
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))

                        if (data.type === 'status') {
                            // Update loading message
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, content: data.message, status: 'loading' }
                                    : m
                            ))
                        } else if (data.type === 'done') {
                            // Final message with lineups
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        content: data.message,
                                        lineups: data.lineups || [],
                                        sources_used: data.sources_used || [],
                                        status: 'done',
                                    }
                                    : m
                            ))
                            if (data.lineups?.length > 0) {
                                setGeneratedLineups(data.lineups)
                            }
                        } else if (data.type === 'error') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId
                                    ? {
                                        ...m,
                                        content: `❌ ${data.message}`,
                                        lineups: [],
                                        status: 'error',
                                    }
                                    : m
                            ))
                        }
                    } catch (parseErr) {
                        // Skip malformed SSE lines
                    }
                }
            }
        } catch (err) {
            console.error('Send error:', err)
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? {
                        ...m,
                        content: `❌ Network error: ${err.message}`,
                        lineups: [],
                        status: 'error',
                    }
                    : m
            ))
        }

        setLoading(false)
    }

    const navItems = [
        { label: 'Optimizer', icon: '⚡', active: false, href: '/dashboard/optimizer' },
        { label: 'Chat', icon: '💬', active: true, href: '/dashboard/chat' },
        { label: 'My Lineups', icon: '📋', active: false, href: '/dashboard/lineups' },
    ]

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
                            <button key={s} onClick={() => setSport(s.toLowerCase())}
                                className="px-3 py-1.5 text-xs font-black transition-all"
                                style={{
                                    background: sport.toUpperCase() === s ? '#FFB800' : 'transparent',
                                    color: sport.toUpperCase() === s ? '#0A1628' : '#8A9BBE',
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
                                    color: platform === p ? '#FFB800' : '#8A9BBE',
                                }}>
                                {p === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <div className="flex pt-14 h-screen">

                {/* Sidebar */}
                <aside className={`shrink-0 border-r border-[#223366] pt-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto transition-all ${sidebarOpen ? 'w-52' : 'w-14'}`}
                    style={{ background: '#0F1E38' }}>
                    <div className="px-2 mb-2 flex justify-end">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-[#8A9BBE] hover:text-white hover:bg-[#1A2E55] transition-colors"
                            title={sidebarOpen ? 'Collapse' : 'Expand'}>
                            {sidebarOpen ? '◀' : '▶'}
                        </button>
                    </div>
                    <div className="px-4 mb-4">
                        {sidebarOpen && (
                            <div className="text-xs font-semibold text-[#8A9BBE] uppercase tracking-widest mb-2">Tools</div>
                        )}
                        {navItems.map(item => (
                            <Link key={item.label} href={item.href}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm transition-all cursor-pointer"
                                title={item.label}
                                style={{
                                    background: item.active ? 'rgba(255,184,0,0.1)' : 'transparent',
                                    color: item.active ? '#FFB800' : '#B8C5D6',
                                    textDecoration: 'none',
                                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                                }}>
                                <span>{item.icon}</span>
                                {sidebarOpen && item.label}
                            </Link>
                        ))}
                    </div>
                </aside>

                {/* SOURCES PANEL */}
                <div style={{ width: '380px', flexShrink: 0 }} className="border-r border-[#223366] h-[calc(100vh-56px)] overflow-y-auto p-4">

                    <div className="flex items-center gap-2 mb-4">
                        <div className="text-sm font-black text-white">📁 Data Sources</div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>
                            {sources.length}
                        </span>
                    </div>

                    {/* Compact sport/platform selector (mirrors the top nav — same state) */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex rounded-lg overflow-hidden border border-[#223366]">
                            {['MLB', 'NBA', 'NFL'].map(s => (
                                <button key={s} onClick={() => setSport(s.toLowerCase())}
                                    className="px-2 py-1 text-xs font-black transition-all"
                                    style={{
                                        background: sport.toUpperCase() === s ? '#FFB800' : 'transparent',
                                        color: sport.toUpperCase() === s ? '#0A1628' : '#8A9BBE',
                                    }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex rounded-lg overflow-hidden border border-[#223366]">
                            {['draftkings', 'fanduel'].map(p => (
                                <button key={p} onClick={() => setPlatform(p)}
                                    className="px-2 py-1 text-xs font-bold transition-all"
                                    style={{
                                        background: platform === p ? '#1A2E55' : 'transparent',
                                        color: platform === p ? '#FFB800' : '#8A9BBE',
                                    }}>
                                    {p === 'draftkings' ? 'DK' : 'FD'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 1 — Player Pool CSV */}
                    <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{ background: '#0F1E38' }}>
                        <button onClick={() => setExpanded(prev => ({ ...prev, csv: !prev.csv }))}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-white"
                            style={{ background: '#1A2E55' }}>
                            <span>📊 Player Pool</span>
                            <span className="text-[#8A9BBE]">{expanded.csv ? '▲' : '▼'}</span>
                        </button>
                        {expanded.csv && (
                            <div className="p-3 space-y-2">
                                <label className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold cursor-pointer border transition-all"
                                    style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', borderColor: 'rgba(255,184,0,0.3)' }}>
                                    📊 Upload Player CSV
                                    <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                                </label>
                                <div className="text-xs text-[#8A9BBE]">
                                    Required columns: first_name, last_name, position, team, salary, ppg_projection, ownership_projection
                                </div>
                                {sources.filter(s => s.type === 'csv').map(s => (
                                    <SourceRow key={s.id} source={s} onRemove={removeSource} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 2 — Injury Report */}
                    <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{ background: '#0F1E38' }}>
                        <button onClick={() => setExpanded(prev => ({ ...prev, injury: !prev.injury }))}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-white"
                            style={{ background: '#1A2E55' }}>
                            <span>🩹 Injury Report</span>
                            <span className="text-[#8A9BBE]">{expanded.injury ? '▲' : '▼'}</span>
                        </button>
                        {expanded.injury && (
                            <div className="p-3 space-y-2">
                                <div className="flex gap-2">
                                    <label className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-bold cursor-pointer border transition-all"
                                        style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8', borderColor: 'rgba(129,140,248,0.3)' }}>
                                        📄 Upload PDF
                                        <input type="file" accept=".pdf" onChange={(e) => e.target.files[0] && handlePdfUpload(e.target.files[0])} className="hidden" />
                                    </label>
                                    <button onClick={() => setInjuryPasteOpen(!injuryPasteOpen)}
                                        className="flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-all"
                                        style={{ background: '#132244', color: '#8A9BBE', borderColor: '#223366' }}>
                                        ✏️ Paste Text
                                    </button>
                                </div>
                                {injuryPasteOpen && (
                                    <div className="space-y-2">
                                        <textarea value={injuryPasteText} onChange={e => setInjuryPasteText(e.target.value)}
                                            placeholder="Paste injury report text…"
                                            rows={5}
                                            className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                            style={{ background: '#0A1628' }} />
                                        <button onClick={saveInjuryPaste}
                                            className="w-full py-1.5 rounded-lg text-xs font-bold"
                                            style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                            Save
                                        </button>
                                    </div>
                                )}
                                {sources.filter(s => s.type === 'pdf').map(s => (
                                    <SourceRow key={s.id} source={s} onRemove={removeSource} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3 — Expert Transcripts / Articles */}
                    <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{ background: '#0F1E38' }}>
                        <button onClick={() => setExpanded(prev => ({ ...prev, transcripts: !prev.transcripts }))}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-white"
                            style={{ background: '#1A2E55' }}>
                            <span>🎙️ Expert Transcripts</span>
                            <span className="text-[#8A9BBE]">{expanded.transcripts ? '▲' : '▼'}</span>
                        </button>
                        {expanded.transcripts && (
                            <div className="p-3 space-y-2">
                                {!transcriptFormOpen ? (
                                    <button onClick={() => setTranscriptFormOpen(true)}
                                        className="w-full px-3 py-2 rounded-lg text-xs font-bold border transition-all"
                                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' }}>
                                        ➕ Add Source
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <input value={transcriptName} onChange={e => setTranscriptName(e.target.value)}
                                            placeholder='Name (e.g. "ETR Podcast 9/7")'
                                            className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                            style={{ background: '#0A1628' }} />
                                        <textarea value={transcriptText} onChange={e => setTranscriptText(e.target.value)}
                                            placeholder="Paste transcript or article text…"
                                            rows={6}
                                            className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                            style={{ background: '#0A1628' }} />
                                        <div className="flex gap-2">
                                            <button onClick={addTranscriptSource}
                                                className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                                                style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                                Add
                                            </button>
                                            <button onClick={() => { setTranscriptFormOpen(false); setTranscriptName(''); setTranscriptText('') }}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#223366] text-[#8A9BBE]">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {sources.filter(s => s.type === 'transcript').map(s => (
                                    <SourceRow key={s.id} source={s} onRemove={removeSource} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 4 — Vegas / Game Data */}
                    <div className="rounded-xl border border-[#223366] overflow-hidden mb-3" style={{ background: '#0F1E38' }}>
                        <button onClick={() => setExpanded(prev => ({ ...prev, vegas: !prev.vegas }))}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-white"
                            style={{ background: '#1A2E55' }}>
                            <span>🎰 Vegas / Game Data</span>
                            <span className="text-[#8A9BBE]">{expanded.vegas ? '▲' : '▼'}</span>
                        </button>
                        {expanded.vegas && (
                            <div className="p-3 space-y-2">
                                <textarea value={vegasNotes} onChange={e => setVegasNotes(e.target.value)}
                                    placeholder={'Paste Vegas lines, weather, or game notes:\n\nChiefs vs Raiders: O/U 47.5, KC -7\nMahomes listed as full practice\nWind: 12mph, Temp: 68F\n...'}
                                    rows={6}
                                    className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-[#223366] focus:border-[#FFB800] text-white"
                                    style={{ background: '#0A1628' }} />
                                <button onClick={saveVegasNotes}
                                    className="w-full py-1.5 rounded-lg text-xs font-bold"
                                    style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                    Save
                                </button>
                                {sources.filter(s => s.id === 'vegas-notes').map(s => (
                                    <SourceRow key={s.id} source={s} onRemove={removeSource} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Context size + clear all */}
                    <div className="mt-4 pt-3 border-t border-[#223366]">
                        <div className="text-xs text-[#8A9BBE] mb-1">
                            📊 Total context: {totalTokens.toLocaleString()} tokens
                        </div>
                        {totalTokens > 50000 && (
                            <div className="text-xs mb-2" style={{ color: '#FFB800' }}>
                                ⚠ Large context — responses may be slower
                            </div>
                        )}
                        {sources.length > 0 && (
                            <button onClick={clearAllSources}
                                className="w-full py-1.5 rounded-lg text-xs font-bold border transition-all"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                                🗑 Clear All Sources
                            </button>
                        )}
                    </div>
                </div>

                {/* CHAT PANEL */}
                <div className="flex-1 flex flex-col h-[calc(100vh-56px)] min-w-0">

                    {/* Header */}
                    <div className="px-5 py-3 border-b border-[#223366] shrink-0">
                        <div className="text-sm font-black text-white">🤖 DFS AI Assistant</div>
                        <div className="text-xs text-[#8A9BBE]">Powered by Claude — ask anything about tonight&apos;s slate</div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="text-sm text-[#8A9BBE] mb-4">
                                    👋 I have your sources loaded. Try asking:
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                                    {SUGGESTIONS.map(sugg => (
                                        <button key={sugg} onClick={() => setInput(sugg)}
                                            className="px-3 py-2 rounded-full text-xs font-semibold border transition-all hover:border-[#FFB800] hover:text-[#FFB800]"
                                            style={{ background: '#132244', borderColor: '#223366', color: '#B8C5D6' }}>
                                            {sugg}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className="max-w-2xl">
                                    <div className="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap"
                                        style={msg.role === 'user' ? {
                                            background: 'rgba(255,184,0,0.08)',
                                            border: '1px solid rgba(255,184,0,0.2)',
                                            color: '#ffffff',
                                        } : {
                                            background: '#132244',
                                            border: '1px solid #223366',
                                            color: '#ffffff',
                                        }}>
                                        {msg.status === 'loading' ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    {[0, 1, 2].map(i => (
                                                        <div key={i}
                                                            className="w-1.5 h-1.5 rounded-full animate-bounce"
                                                            style={{
                                                                background: '#FFB800',
                                                                animationDelay: `${i * 0.15}s`,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-xs text-[#8A9BBE]">
                                                    {msg.content === '...'
                                                        ? 'Thinking...'
                                                        : msg.content}
                                                </span>
                                            </div>
                                        ) : msg.content}
                                    </div>

                                    {msg.sources_used?.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-[#8A9BBE]">
                                            <span>📚 Sources used:</span>
                                            {msg.sources_used.map((name, i) => (
                                                <span key={i} className="px-1.5 py-0.5 rounded"
                                                    style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8' }}>
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {msg.lineups?.length > 0 && (
                                        <div className="mt-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                {msg.lineups.map((lu, i) => (
                                                    <LineupCard key={i} lineup={lu} />
                                                ))}
                                            </div>
                                            <button onClick={() => exportLineupsCSV(msg.lineups, sport)}
                                                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                                                style={{ background: 'linear-gradient(135deg, #FFB800, #E6A500)', color: '#0A1628' }}>
                                                📥 Export {msg.lineups.length} Lineups to CSV
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-[#223366] shrink-0">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault()
                                    sendMessage()
                                }
                            }}
                            placeholder="Ask about tonight's slate…"
                            rows={1}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-[#223366] focus:border-[#FFB800] text-white resize-none"
                            style={{ background: '#132244' }}
                        />
                        <div className="flex items-center justify-between mt-2">
                            {!hasPlayerPool ? (
                                <div className="text-xs" style={{ color: '#FFB800' }}>
                                    ⚠ No player pool loaded
                                </div>
                            ) : <div />}
                            <button onClick={sendMessage} disabled={!input.trim() || loading}
                                className="px-4 py-1.5 rounded-lg text-sm font-black transition-all"
                                style={{
                                    background: 'linear-gradient(135deg, #FFB800, #E6A500)',
                                    color: '#0A1628',
                                    opacity: (!input.trim() || loading) ? 0.5 : 1,
                                }}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// A single source's row in its section's list, shared across all four
// sections so the ready/processing/error look is consistent everywhere.
function SourceRow({ source, onRemove }) {
    const statusColor = source.status === 'ready' ? '#22C55E' : source.status === 'error' ? '#EF4444' : '#FFB800'
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#223366] text-xs"
            style={{ background: '#0A1628' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
            <div className="flex-1 min-w-0">
                <div className="text-white truncate">{source.name}</div>
                <div className="text-[#8A9BBE] truncate">{source.summary}</div>
            </div>
            <button onClick={() => onRemove(source.id)} className="text-[#8A9BBE] hover:text-[#EF4444] shrink-0">✕</button>
        </div>
    )
}

// Compact lineup card for chat messages — mirrors the optimizer page's palette.
function LineupCard({ lineup }) {
    const stackTeam = getStackTeam(lineup.players || [])
    return (
        <div className="rounded-xl border border-[#223366] overflow-hidden" style={{ background: '#132244' }}>
            <div className="px-3 py-2 border-b border-[#223366]" style={{ background: '#1A2E55' }}>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">#{lineup.lineup_number}</span>
                    <span className="text-xs font-bold text-[#22C55E]">{lineup.projected_points} pts</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                    {lineup.strategy && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                            style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>
                            🤖 {lineup.strategy}
                        </span>
                    )}
                    <span className="text-xs font-mono text-[#B8C5D6]">${lineup.total_salary?.toLocaleString()}</span>
                </div>
            </div>
            {lineup.reasoning && (
                <div className="px-3 py-2 text-xs text-[#8A9BBE] italic border-b border-[#223366]">
                    {lineup.reasoning}
                </div>
            )}
            <div>
                {(lineup.players || []).map((p, i) => {
                    const isStack = stackTeam && p.team === stackTeam
                    return (
                        <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs border-b border-[#1A2E55] last:border-b-0"
                            style={isStack ? { background: 'rgba(255,184,0,0.06)' } : undefined}>
                            <span className="w-8 shrink-0 font-bold" style={{ color: posColor(p.slot || p.position) }}>
                                {p.slot || p.position}
                            </span>
                            <span className={`flex-1 truncate ${isStack ? 'font-bold' : ''}`}
                                style={{ color: isStack ? '#FFB800' : '#ffffff' }}>
                                {p.name}
                            </span>
                            <span className="text-[#8A9BBE] w-8 shrink-0">{p.team}</span>
                            <span className="text-[#B8C5D6] w-14 shrink-0 text-right font-mono">${p.salary?.toLocaleString()}</span>
                            <span className="text-[#22C55E] w-8 shrink-0 text-right">{p.projected_points}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
