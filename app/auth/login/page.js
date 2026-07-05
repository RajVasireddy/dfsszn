'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#0A1628'}}>
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#223366]" style={{background:'#132244'}}>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white font-sans">
            DFS<span className="text-[#FFB800]">SZN</span>
          </h1>
          <p className="text-[#8A9BBE] mt-2 text-sm">Welcome back. Lock in.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-[#8A9BBE] mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none border border-[#223366] focus:border-[#FFB800] transition-colors"
              style={{background:'#0A1628'}}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm text-[#8A9BBE] mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none border border-[#223366] focus:border-[#FFB800] transition-colors"
              style={{background:'#0A1628'}}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm transition-opacity"
            style={{background:'#FFB800', color:'#0A1628'}}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8A9BBE] mt-6">
          No account?{' '}
          <Link href="/auth/signup" className="text-[#FFB800] hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}