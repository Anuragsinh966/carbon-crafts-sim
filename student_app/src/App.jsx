import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ShoppingCart, Leaf, TrendingUp, AlertTriangle, CheckCircle, Lock, DollarSign } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [teamId, setTeamId] = useState('')
  
  // 1. Check if user is already logged in
  useEffect(() => {
    const stored = localStorage.getItem('carbon_team_id')
    if (stored) setSession(stored)
  }, [])

  // 2. Login Handler
  const handleLogin = async () => {
    if (!teamId) return alert("Please enter a Team ID")
    
    // Check if team exists in Supabase
    // Note: We use 'code' because that matches your DB column from your old project
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('code', teamId) 
      .single()

    if (data) {
      localStorage.setItem('carbon_team_id', teamId)
      setSession(teamId)
    } else {
      alert("Team ID not found! Ask the Game Master.")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('carbon_team_id')
    setSession(null)
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto bg-slate-900 text-slate-100">
      {!session ? (
        // --- LOGIN SCREEN ---
        <div className="flex flex-col items-center justify-center h-[80vh] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-emerald-400">🌍 Carbon Crafts</h1>
            <p className="text-slate-400">Executive Decision Portal</p>
          </div>
          
          <div className="w-full space-y-3 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <label className="text-sm font-bold text-slate-300">Team Identification</label>
            <input 
              type="text" 
              placeholder="e.g. Team1" 
              className="w-full p-4 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-emerald-500 focus:outline-none"
              onChange={(e) => setTeamId(e.target.value)}
            />
            <button 
              onClick={handleLogin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-lg font-bold transition-all"
            >
              Enter Boardroom
            </button>
          </div>
        </div>
      ) : (
        // --- DASHBOARD SCREEN ---
        <Dashboard teamId={session} onLogout={handleLogout} />
      )}
    </div>
  )
}

function Dashboard({ teamId, onLogout }) {
  const [team, setTeam] = useState(null)
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [auctionCode, setAuctionCode] = useState('')

  // 1. Fetch Data Function
  const fetchData = async () => {
    // Get Team Data
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('code', teamId)
      .single()
      
    // Get Game Config (Round, Event)
    const { data: configData } = await supabase.from('config').select('*')
    const configObj = {}
    configData?.forEach(item => configObj[item.key] = item.value)
    
    setTeam(teamData)
    setConfig(configObj)
  }

  // 2. Setup Realtime Listener (Auto-Refresh)
  useEffect(() => {
    fetchData()
    
    const subscription = supabase
      .channel('public:teams')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'teams', 
        filter: `code=eq.${teamId}` 
      }, (payload) => {
        setTeam(payload.new)
      })
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [teamId])

  // 3. Buy Action
  const buySupplier = async (tier, cost, debt) => {
    if(!confirm(`Confirm purchase of ${tier} for $${cost}?`)) return;

    setLoading(true)
    // IMPORTANT: This calls the SQL function we added earlier
    const { data, error } = await supabase.rpc('buy_supplier', {
      p_team_id: teamId,
      p_tier: tier,
      p_cost: cost,
      p_debt_impact: debt
    })
    
    if (error) alert("System Error: " + error.message)
    else alert(data)
    
    fetchData() // Force refresh
    setLoading(false)
  }

  // 4. Auction Code Action
  const redeemCode = async () => {
    if (!auctionCode) return
    setLoading(true)
    const { data, error } = await supabase.rpc('redeem_code', {
      p_team_id: teamId,
      p_code: auctionCode
    })
    
    if (error) alert("Invalid Code")
    else alert(data)
    
    setAuctionCode('')
    fetchData()
    setLoading(false)
  }

  if (!team) return <div className="p-10 text-center animate-pulse">Connecting to HQ...</div>

  // Game Math
  const currentRound = parseInt(config.current_round || 1)
  const isLocked = team.last_action_round >= currentRound
  const score = (team.cash * 0.6) + ((100 - team.carbon_debt) * 10)

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{team.name || teamId}</h2>
          <div className="flex items-center gap-2">
            <span className="bg-slate-700 text-xs px-2 py-1 rounded text-slate-300">YEAR {currentRound}</span>
            <span className="text-xs text-emerald-400 font-mono">LIVE</span>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs text-slate-400 hover:text-white underline">Logout</button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <DollarSign size={14} /> <span className="text-xs font-bold">CASH</span>
          </div>
          <p className="font-mono text-xl text-emerald-400">${team.cash}</p>
        </div>
        
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <TrendingUp size={14} /> <span className="text-xs font-bold">DEBT</span>
          </div>
          <p className="font-mono text-xl text-red-400">{team.carbon_debt}</p>
        </div>

        <div className="bg-slate-800 p-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-800 to-emerald-900/20">
          <div className="flex items-center gap-1 text-emerald-200 mb-1">
            <span className="text-xs font-bold">SCORE</span>
          </div>
          <p className="font-bold text-xl text-white">{Math.floor(score)}</p>
        </div>
      </div>

      {/* AUCTION CENTER */}
      <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30">
        <h3 className="text-sm font-bold text-indigo-200 mb-3 flex items-center gap-2">
          <ShoppingCart size={16}/> ACQUISITIONS
        </h3>
        <div className="flex gap-2">
          <input 
            value={auctionCode}
            onChange={(e) => setAuctionCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-lg text-center tracking-widest font-mono uppercase focus:border-indigo-500 outline-none"
          />
          <button 
            onClick={redeemCode} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 px-4 rounded-lg font-bold text-white text-sm"
          >
            CLAIM
          </button>
        </div>
        
        {/* Inventory Icons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {team.assets && team.assets.map((item, i) => (
            <span key={i} className="text-xs bg-slate-800 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 shadow-sm flex items-center gap-1">
               🔹 {item}
            </span>
          ))}
        </div>
      </div>

      {/* PROCUREMENT SECTION */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
          {isLocked ? <Lock size={16} className="text-orange-400"/> : <Leaf size={16} className="text-emerald-400"/>} 
          SUPPLY CHAIN STRATEGY
        </h3>

        {isLocked ? (
           <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-xl text-center flex flex-col items-center justify-center space-y-3">
             <div className="bg-green-500/10 p-4 rounded-full">
                <CheckCircle className="text-green-500" size={40} />
             </div>
             <div>
               <p className="text-white font-bold text-lg">Strategy Locked</p>
               <p className="text-sm text-slate-400">Wait for the market event results.</p>
             </div>
             <div className="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded">
               You selected: <span className="text-white font-mono">{team.inventory_choice}</span>
             </div>
           </div>
        ) : (
          <div className="space-y-3">
            {/* TIER A */}
            <button 
              onClick={() => buySupplier('Tier A (Ethical)', 1200, -1)}
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-750 border border-emerald-500/30 p-4 rounded-xl flex justify-between items-center group transition-all hover:border-emerald-500"
            >
              <div className="text-left">
                <span className="text-emerald-400 font-bold block text-lg">Tier A (Ethical)</span>
                <div className="text-xs text-slate-400 mt-1 flex gap-3">
                   <span className="text-slate-200 font-mono">$1200</span>
                   <span className="text-emerald-400 bg-emerald-900/30 px-1 rounded">-1 Debt</span>
                </div>
              </div>
              <Leaf className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
            </button>

            {/* TIER B */}
            <button 
               onClick={() => buySupplier('Tier B (Standard)', 800, 1)}
               disabled={loading}
               className="w-full bg-slate-800 hover:bg-slate-750 border border-blue-500/30 p-4 rounded-xl flex justify-between items-center group transition-all hover:border-blue-500"
            >
              <div className="text-left">
                <span className="text-blue-400 font-bold block text-lg">Tier B (Standard)</span>
                <div className="text-xs text-slate-400 mt-1 flex gap-3">
                   <span className="text-slate-200 font-mono">$800</span>
                   <span className="text-orange-300 bg-orange-900/20 px-1 rounded">+1 Debt</span>
                </div>
              </div>
            </button>

            {/* TIER C */}
            <button 
               onClick={() => buySupplier('Tier C (Dirty)', 500, 3)}
               disabled={loading}
               className="w-full bg-slate-800 hover:bg-slate-750 border border-red-500/30 p-4 rounded-xl flex justify-between items-center group transition-all hover:border-red-500"
            >
              <div className="text-left">
                <span className="text-red-400 font-bold block text-lg">Tier C (Dirty)</span>
                <div className="text-xs text-slate-400 mt-1 flex gap-3">
                   <span className="text-slate-200 font-mono">$500</span>
                   <span className="text-red-400 bg-red-900/20 px-1 rounded font-bold">+3 Debt</span>
                </div>
              </div>
              <AlertTriangle className="text-slate-600 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}