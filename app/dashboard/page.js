import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen" style={{background:'#0A1628'}}>
      
      {/* Nav */}
      <nav className="border-b border-[#223366] px-8 h-14 flex items-center justify-between"
        style={{background:'rgba(10,22,40,0.95)'}}>
        <div className="text-xl font-black text-white">
          DFS<span className="text-[#FFB800]">SZN</span>
        </div>
        <div className="text-sm text-[#8A9BBE]">
          {user.email}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-black text-white mb-2">
          Welcome to <span className="text-[#FFB800]">DFSSZN</span>
        </h1>
        <p className="text-[#8A9BBE] mb-12">
          Your war room is almost ready. More features coming soon.
        </p>

        {/* Sport Cards */}
        <div className="grid grid-cols-3 gap-4">
          {['MLB', 'NBA', 'NFL'].map((sport) => (
            <div key={sport}
              className="p-6 rounded-2xl border border-[#223366] cursor-pointer hover:border-[#FFB800] transition-colors"
              style={{background:'#132244'}}>
              <div className="text-2xl mb-3">
                {sport === 'MLB' ? '⚾' : sport === 'NBA' ? '🏀' : '🏈'}
              </div>
              <div className="text-xl font-black text-white mb-1">{sport}</div>
              <div className="text-sm text-[#8A9BBE]">Coming in Session 2</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}