'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:'#0A1628'}}>
        <div className="w-full max-w-md p-8 rounded-2xl border border-[#223366] text-center" style={{background:'#132244'}}>
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-[#8A9BBE] text-sm">We sent a confirmation link to <strong className="text-white">{email}</strong>. Click it to activate your account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#0A1628'}}>
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#223366]" style={{background:'#132244'}}>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white">
            DFS<span className="text-[#FFB800]">SZN</span>
          </h1>
          <p className="text-[#8A9BBE] mt-2 text-sm">Create your free account.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm text-[#8A9BBE] mb-1 block">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none border border-[#223366] focus:border-[#FFB800] transition-colors"
              style={{background:'#0A1628'}}
              placeholder="Your name"
            />
          </div>

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
              minLength={6}
              className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none border border-[#223366] focus:border-[#FFB800] transition-colors"
              style={{background:'#0A1628'}}
              placeholder="Min 6 characters"
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
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8A9BBE] mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#FFB800] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}