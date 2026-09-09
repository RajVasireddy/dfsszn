# DFSSZN — DFS Lineup Optimizer

## Stack
- **Frontend**: Next.js + Tailwind CSS → Vercel
- **Auth/DB**: Supabase
- **Optimizer**: Python Flask + OR-Tools → Render
- **AI**: Anthropic Claude API
- **Data**: SportsDataIO

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.9+
- pip

### Setup

1. Clone repo
```
git clone https://github.com/RajVasireddy/dfsszn2.git
cd dfsszn2
```

2. Install Next.js dependencies
```
npm install
```

3. Install Python dependencies
```
cd optimizer-service
pip install -r requirements.txt
cd ..
```

4. Create .env.local (see .env.example)
```
cp .env.example .env.local
# Fill in your API keys
```

5. Start Python optimizer (Terminal 1)
```
cd optimizer-service
python app.py
```

6. Start Next.js (Terminal 2)
```
npm run dev
```

7. Open http://localhost:3000

## Deployment

### Python Optimizer (Render)
1. Create account at render.com
2. New Web Service → connect GitHub repo
3. Root directory: optimizer-service
4. Build: pip install -r requirements.txt
5. Start: gunicorn app:app --bind 0.0.0.0:$PORT
6. Copy the service URL

### Next.js (Vercel)
1. Push code to GitHub
2. Import project at vercel.com
3. Add environment variables (see .env.example)
4. Set OPTIMIZER_URL to your Render service URL
5. Deploy

## Features
- MLB + NFL lineup optimization
- OR-Tools CP-SAT mathematical optimizer
- Multi-stack builder
- AI slate analysis (Claude)
- DraftKings + FanDuel export
- Manual slate CSV upload
- Player exposure tracking

## Known limitations

- **Render free tier sleeps after inactivity.** The first optimizer request
  after a period of inactivity can take 30–60+ seconds while the service
  spins back up. `/api/keepalive` and the "Optimizer waking up…" indicator in
  the optimizer page soften this, but a genuinely cold instance can still
  exceed Vercel's serverless function time limit (see below) before Render
  finishes starting.
- **Vercel Hobby (free) plan caps serverless functions at 60 seconds** without
  Fluid Compute. `app/api/optimize/route.js` uses a 55-second internal timeout
  to fail gracefully with a friendly message before Vercel kills the function
  outright — but a large lineup request (e.g. 100+ lineups on a slate with
  restrictive stacking rules) can legitimately take longer than that to solve.
  If you hit this, either keep lineup counts modest, upgrade to Vercel Pro
  (300s functions), or move lineup generation to an async job-queue pattern.
- **NFL has no live slate feed** on the current SportsDataIO plan — the app
  routes NFL straight to manual CSV upload instead of a live fetch.
