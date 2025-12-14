import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ShoppingCart, Leaf, TrendingUp, CheckCircle, Lock, DollarSign, Megaphone, Activity, Ticket } from 'lucide-react'
import axios from 'axios'

export default function App() {
  const [session, setSession] = useState(null)
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('carbon_team_id')
    if (stored) setSession(stored)
  }, [])

  const handleLogin = async () => {
    // Get values from the input boxes
    const user = document.getElementById('login-user').value
    const pass = document.getElementById('login-pass').value

    if (!user || !pass) return alert("Please enter Username and Password")

    // Secure Check
    const { data } = await supabase.from('teams')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single()

    if (data) {
      localStorage.setItem('carbon_team_id', data.code) // We still use the Code internally
      setSession(data.code)
    } else {
      alert("❌ Invalid Username or Password")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('carbon_team_id')
    setSession(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      {!session ? (
        <div className="w-full max-w-sm space-y-4 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secure Login</label>
              
              <input type="text" id="login-user" placeholder="Username" 
                className="w-full p-4 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-500 mb-2"
              />
              
              <input type="password" id="login-pass" placeholder="Password" 
                className="w-full p-4 rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <button onClick={handleLogin} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-lg font-bold shadow-lg transition-all">
              Authenticate
            </button>
          </div>
      ) : (
        <Dashboard teamId={session} onLogout={handleLogout} />
      )}
    </div>
  )
}

function Dashboard({ teamId, onLogout }) {
  const [team, setTeam] = useState(null)
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [redeemCode, setRedeemCode] = useState("")
  const [catalog, setCatalog] = useState([]) // Stores dynamic items

  const fetchData = async () => {
    // 1. Try to find the team
    const { data: tData, error } = await supabase
      .from('teams')
      .select('*')
      .eq('code', teamId)
      .maybeSingle() // Use maybeSingle() to avoid crashing on 0 rows

    // 2. CHECK: Does the team actually exist?
    if (error || !tData) {
      console.warn("Team deleted or not found. Logging out...")
      alert("⚠️ Your team access has been revoked by the Game Master.")
      
      // DESTROY THE ZOMBIE SESSION
      localStorage.removeItem('carbon_team_id')
      window.location.reload() // Force reload to go back to Login screen
      return 
    }

    // 3. If team exists, proceed as normal
    const { data: cData } = await supabase.from('config').select('*')
    const configObj = {}
    if(cData) cData.forEach(item => configObj[item.key] = item.value)
    
    setTeam(tData)
    // ... inside fetchData ...
    // Fetch Dynamic Catalog
    try {
        const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"
        const catRes = await axios.get(`${ENGINE_URL}/catalog`)
        setCatalog(catRes.data)
    } catch(e) { console.error("Catalog load failed") }
    setConfig(configObj)
  }

  useEffect(() => {
    fetchData()
    const sub = supabase.channel('student')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `code=eq.${teamId}` }, (payload) => setTeam(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, fetchData)
      .subscribe()
    const interval = setInterval(() => fetchData(), 4000)
    return () => { supabase.removeChannel(sub); clearInterval(interval) }
  }, [teamId])

  const submitChoice = async (tier, cost, debt) => {
    // 1. Pre-check (Visual only)
    if(team.cash < cost) return alert("Insufficient Funds!");
    if(!confirm(`Confirm purchase of ${tier}?\nCost: $${cost}\nDebt Impact: ${debt}`)) return;

    setLoading(true)

    try {
        const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"
        
        // 2. Send Request to Python Brain
        await axios.post(`${ENGINE_URL}/buy-supplier`, {
            team_code: teamId,
            item_name: tier,
            cost: cost,
            debt_effect: debt
        })

        // 3. Success! The server handled the math and the logs.
        // We just verify visual state here (optional, as auto-refresh will catch it too)
        alert("✅ Order Confirmed")
        fetchData() // Refresh immediately to see new cash

    } catch (error) {
        alert("Transaction Failed: " + (error.response?.data?.detail || error.message))
    }
    
    setLoading(false)
  }

  const handleRedeem = async () => {
      if(!redeemCode) return;
      setLoading(true)
      try {
          const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"
          await axios.post(`${ENGINE_URL}/redeem-code`, { team_code: teamId, secret_code: redeemCode })
          alert(`✅ Purchased Successfully!`); setRedeemCode(""); fetchData()
      } catch (err) { alert(err.response?.data?.detail || "Invalid Code") }
      setLoading(false)
  }

  // --- HELPER TO FIX THE CRASH ---
  // This converts whatever the database sends (Array or String) into a clean List
  const getAssetList = () => {
      if (!team.assets) return []
      if (Array.isArray(team.assets)) return team.assets // It's already an array
      return team.assets.toString().split(',').filter(a => a) // It's a string, so split it
  }

  if (!team) return <div className="p-10 text-center animate-pulse text-emerald-400">Connecting to HQ...</div>

  const currentRound = parseInt(config.current_round || 1)
  const isLocked = team.last_action_round >= currentRound
  const score = (team.cash * 0.6) + ((100 - team.carbon_debt) * 10)
  const eventColor = config.active_event !== 'None' ? 'text-yellow-400' : 'text-slate-500';

  return (
    <div className="pb-20">
      {config.system_message && config.system_message !== "Welcome!" && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 p-3 text-center">
            <p className="text-blue-200 text-sm font-bold flex justify-center items-center gap-2 animate-pulse">
                <Megaphone size={16}/> ADMIN MESSAGE: {config.system_message}
            </p>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center max-w-lg mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded text-emerald-400 font-bold">{team.code.substring(0,2)}</div>
                <div>
                    <h2 className="font-bold text-white text-lg leading-tight">{team.code}</h2>
                    <p className="text-xs text-slate-400 font-mono">YEAR {currentRound}</p>
                </div>
            </div>
            <button onClick={onLogout} className="text-xs text-slate-500 hover:text-white px-3 py-1 rounded border border-slate-700">Logout</button>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100} className="text-white"/></div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Market Status</h3>
            <p className={`text-xl font-bold ${eventColor} flex items-center gap-2`}>
                {config.active_event === 'None' ? 'Stable Market' : config.active_event}
                {config.active_event !== 'None' && <span className="flex h-2 w-2 rounded-full bg-yellow-500 animate-ping"></span>}
            </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
            <StatCard label="Cash" value={`$${team.cash}`} icon={<DollarSign size={14}/>} color="text-emerald-400" />
            <StatCard label="Debt" value={team.carbon_debt} icon={<TrendingUp size={14}/>} color="text-red-400" />
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-emerald-900/20">
                <div className="flex items-center gap-1 text-emerald-200/50 mb-1 text-xs font-bold uppercase">Score</div>
                <div className="text-xl font-bold text-white">{Math.floor(score)}</div>
            </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-dashed border-slate-700 mt-2 mb-2">
            <h3 className="text-sm font-bold text-purple-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Ticket size={16}/> Redeem Auction Code
            </h3>
            <div className="flex gap-2">
                <input 
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white uppercase outline-none focus:border-purple-500 font-mono"
                    placeholder="Enter Code (e.g. SCRUB-1)"
                    value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                />
                <button onClick={handleRedeem} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white px-6 rounded-lg font-bold">
                    {loading ? "..." : "Claim"}
                </button>
            </div>
            
            {/* UPDATED: Safe Asset Rendering */}
            <div className="mt-4 flex flex-wrap gap-2">
                {getAssetList().map((asset, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-900/30 text-purple-300 border border-purple-800 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={12}/> {asset}
                    </span>
                ))}
            </div>
        </div>

        <div>
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 border-t border-slate-800 pt-4">
                {isLocked ? <Lock size={16} className="text-orange-400"/> : <ShoppingCart size={16} className="text-emerald-400"/>} SUPPLY CHAIN
            </h3>
            {isLocked ? (
                <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-xl text-center space-y-3">
                    <div className="bg-green-500/10 p-4 rounded-full inline-block"><CheckCircle className="text-green-500" size={32} /></div>
                    <div><p className="text-white font-bold text-lg">Order Confirmed</p><p className="text-sm text-slate-400">Waiting for results.</p></div>
                    <div className="inline-block px-3 py-1 rounded bg-slate-700 text-slate-300 text-xs mt-2 border border-slate-600">You chose: <span className="text-white font-bold">{team.inventory_choice}</span></div>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* DYNAMIC SUPPLIER BUTTONS */}
                    {catalog.filter(i => i.category === 'supplier').sort((a,b)=>a.cost - b.cost).map((item) => (
                        <StrategyBtn 
                            key={item.id}
                            title={item.name} 
                            price={item.cost} 
                            debt={item.debt_effect} 
                            debtColor={item.debt_effect > 0 ? "text-red-500" : "text-emerald-400"} 
                            onClick={() => submitChoice(item.name, item.cost, item.debt_effect)} 
                            loading={loading}
                        />
                    ))}
                    {catalog.filter(i => i.category === 'supplier').length === 0 && <p className="text-slate-500 text-center text-sm">No suppliers available yet.</p>}
                </div>
            )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
    return (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1 text-slate-500 mb-1 text-xs font-bold uppercase">{icon} {label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
        </div>
    )
}

function StrategyBtn({ title, price, debt, debtColor, onClick, loading }) {
    return (
        <button onClick={onClick} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 p-4 rounded-xl flex justify-between items-center group text-left disabled:opacity-50">
            <div><span className="text-white font-bold block text-lg group-hover:text-emerald-400">{title}</span><div className="text-xs text-slate-400 mt-1"><span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">${price}</span></div></div>
            <div className={`text-sm font-bold ${debtColor} bg-slate-950 px-3 py-2 rounded-lg border border-slate-800`}>{debt > 0 ? `+${debt}` : debt} Debt</div>
        </button>
    )
}