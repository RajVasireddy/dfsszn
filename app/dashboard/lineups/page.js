'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function SavedLineups() {
  const [sessionLineups, setSessionLineups] = useState([])
  const [savedLineups, setSavedLineups] = useState([])
  const [activeTab, setActiveTab] = useState('session')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLineups()
  }, [])

  const fetchLineups = async () => {
    setLoading(true)

    // Load session lineups (from optimizer Send to My Lineups)
    try {
      const sessionData = sessionStorage.getItem('dfsszn_my_lineups')
      if (sessionData) {
        const parsed = JSON.parse(sessionData)
        setSessionLineups(parsed)
      }
    } catch (err) {
      console.error('Failed to load session lineups:', err)
    }

    // Load Supabase saved lineups
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('lineups')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) setSavedLineups(data || [])
    } catch (err) {
      console.error('Failed to load saved lineups:', err)
    }

    setLoading(false)
  }

  const deleteLineup = async (id) => {
    const supabase = createClient()
    await supabase.from('lineups').delete().eq('id', id)
    setSavedLineups(savedLineups.filter(l => l.id !== id))
  }

  const exportLineup = (lineup) => {
    const players = lineup.players
    const csv = players.map(p => p.Name || p.OperatorPlayerName).join(',')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lineup.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen" style={{ background: '#0A1628' }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#223366] px-6 h-14 flex items-center gap-4"
        style={{ background: 'rgba(10,22,40,0.97)' }}>
        <div className="text-xl font-black text-white">
          DFS<span className="text-[#FFB800]">SZN</span>
        </div>
        <Link href="/dashboard/optimizer"
          className="text-sm text-[#8A9BBE] hover:text-white transition-colors">
          ← Back to Optimizer
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">
              My <span className="text-[#FFB800]">Lineups</span>
            </h1>
            <p className="text-sm text-[#8A9BBE]">
              {sessionLineups.length} in session · {savedLineups.length} saved to DB
            </p>
          </div>
          <Link href="/dashboard/optimizer"
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: '#FFB800', color: '#0A1628' }}>
            + New Lineup
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#8A9BBE] animate-pulse">
            Loading lineups...
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-0 border-b border-[#223366] mb-6">
              <button
                onClick={() => setActiveTab('session')}
                className="px-6 py-3 text-sm font-bold border-b-2 transition-all"
                style={{
                  borderColor: activeTab === 'session' ? '#FFB800' : 'transparent',
                  color: activeTab === 'session' ? '#FFB800' : '#8A9BBE'
                }}>
                📋 My Lineups
                {sessionLineups.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: '#FFB800', color: '#0A1628' }}>
                    {sessionLineups.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className="px-6 py-3 text-sm font-bold border-b-2 transition-all"
                style={{
                  borderColor: activeTab === 'saved' ? '#FFB800' : 'transparent',
                  color: activeTab === 'saved' ? '#FFB800' : '#8A9BBE'
                }}>
                💾 Saved to DB
                {savedLineups.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(255,184,0,0.2)', color: '#FFB800' }}>
                    {savedLineups.length}
                  </span>
                )}
              </button>
            </div>

            {/* Session Lineups Tab */}
            {activeTab === 'session' && (
              <div>
                {sessionLineups.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4">📋</div>
                    <div className="text-white font-bold mb-2">No lineups yet</div>
                    <div className="text-[#8A9BBE] text-sm mb-6">
                      Generate lineups in the optimizer, select them with checkboxes,
                      and click Send to My Lineups
                    </div>
                    <Link href="/dashboard/optimizer"
                      className="px-6 py-3 rounded-lg text-sm font-bold"
                      style={{ background: '#FFB800', color: '#0A1628' }}>
                      Go to Optimizer
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-[#8A9BBE]">
                        {sessionLineups.length} lineups · Cleared when browser closes
                      </div>
                      <button
                        onClick={() => {
                          sessionStorage.removeItem('dfsszn_my_lineups')
                          setSessionLineups([])
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#223366] text-[#8A9BBE] hover:border-red-400 hover:text-red-400 transition-all">
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-3">
                      {sessionLineups.map((lineup, i) => (
                        <div key={lineup.id || i}
                          className="p-4 rounded-2xl border border-[#223366] hover:border-[#FFB800] transition-colors"
                          style={{ background: '#132244' }}>

                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold text-white mb-1">{lineup.name}</div>
                              <div className="flex gap-3 text-xs text-[#8A9BBE]">
                                <span className="uppercase font-bold" style={{ color: '#FFB800' }}>
                                  {lineup.sport}
                                </span>
                                <span>
                                  {lineup.platform === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                                </span>
                                {lineup.stack_team && (
                                  <span className="text-[#FFB800]">🔗 {lineup.stack_team} stack</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = sessionLineups.filter((_, idx) => idx !== i)
                                setSessionLineups(updated)
                                sessionStorage.setItem('dfsszn_my_lineups', JSON.stringify(updated))
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-red-400 hover:text-red-400"
                              style={{ borderColor: '#223366', color: '#8A9BBE' }}>
                              Delete
                            </button>
                          </div>

                          {/* Players */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {lineup.players?.map((player, pi) => (
                              <div key={pi}
                                className="px-2 py-1 rounded-lg text-xs font-semibold border"
                                style={{
                                  background: lineup.stack_team && player.Team === lineup.stack_team
                                    ? 'rgba(255,184,0,0.1)' : '#1A2E55',
                                  borderColor: lineup.stack_team && player.Team === lineup.stack_team
                                    ? 'rgba(255,184,0,0.3)' : '#223366',
                                  color: lineup.stack_team && player.Team === lineup.stack_team
                                    ? '#FFB800' : '#B8C5D6'
                                }}>
                                {player.OperatorPlayerName}
                              </div>
                            ))}
                          </div>

                          {/* Stats */}
                          <div className="flex gap-6 text-sm">
                            <div>
                              <span className="text-[#8A9BBE] text-xs">Salary </span>
                              <span className="font-bold text-white">
                                ${lineup.total_salary?.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#8A9BBE] text-xs">Proj Pts </span>
                              <span className="font-bold text-[#FFB800]">
                                {lineup.projected_points?.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Saved to DB Tab */}
            {activeTab === 'saved' && (
              <div>
                {savedLineups.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4">💾</div>
                    <div className="text-white font-bold mb-2">No saved lineups</div>
                    <div className="text-[#8A9BBE] text-sm mb-6">
                      Click Save in the optimizer to permanently save lineups to your account
                    </div>
                    <Link href="/dashboard/optimizer"
                      className="px-6 py-3 rounded-lg text-sm font-bold"
                      style={{ background: '#FFB800', color: '#0A1628' }}>
                      Go to Optimizer
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedLineups.map(lineup => (
                      <div key={lineup.id}
                        className="p-5 rounded-2xl border border-[#223366] transition-colors hover:border-[#FFB800]"
                        style={{ background: '#132244' }}>

                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="font-bold text-white mb-1">{lineup.name}</div>
                            <div className="flex gap-3 text-xs text-[#8A9BBE]">
                              <span className="uppercase font-bold" style={{ color: '#FFB800' }}>
                                {lineup.sport}
                              </span>
                              <span>
                                {lineup.platform === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                              </span>
                              <span>{new Date(lineup.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => exportLineup(lineup)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:bg-[#FFB800] hover:text-[#0A1628]"
                              style={{ borderColor: '#FFB800', color: '#FFB800' }}>
                              ↓ Export
                            </button>
                            <button
                              onClick={() => deleteLineup(lineup.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-red-400 hover:text-red-400"
                              style={{ borderColor: '#223366', color: '#8A9BBE' }}>
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {lineup.players?.map((player, i) => (
                            <div key={i}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border border-[#223366]"
                              style={{ background: '#1A2E55', color: '#B8C5D6' }}>
                              {player.OperatorPlayerName || player.Name}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="text-[#8A9BBE] text-xs">Salary </span>
                            <span className="font-bold text-white">
                              ${lineup.total_salary?.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#8A9BBE] text-xs">Proj Pts </span>
                            <span className="font-bold text-[#FFB800]">
                              {lineup.projected_points?.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
