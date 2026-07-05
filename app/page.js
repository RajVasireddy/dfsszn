import { createClient } from '@/lib/supabase'

export default async function Home() {
  const supabase = createClient()
  return (
    <main>
      <h1>DFSSZN — Supabase Connected ✅</h1>
    </main>
  )
}