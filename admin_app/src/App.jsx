import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Play, RotateCw, Gavel, Trophy, Lock, Unlock, Plus, Trash2, Mic, AlertOctagon, Wallet, Globe, Terminal, ShieldAlert, Edit, X, Save, RotateCcw, FileText } from 'lucide-react'
import axios from 'axios'

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"

export default function AdminApp() {
  const [adminAuth, setAdminAuth] = useState(false)
  const [adminPass, setAdminPass] = useState("") 
  const [teams, setTeams] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState([]) // Stores the dynamic items
  const [masterLogs, setMasterLogs] = useState([]) // Stores the history log

  // Edit Modal State
  const [editingTeam, setEditingTeam] = useState(null)
  const [editCash, setEditCash] = useState(0)
  const [editDebt, setEditDebt] = useState(0)
  const [editUser, setEditUser] = useState("")
  const [editPass, setEditPass] = useState("")
  const [editMembers, setEditMembers] = useState("")  
  
  // UI State
  const [activeTab, setActiveTab] = useState("dashboard")
  const [newTeamName, setNewTeamName] = useState("")
  const [selectedEvent, setSelectedEvent] = useState("The Carbon Tax")
  const [broadcastMsg, setBroadcastMsg] = useState("")
  const [logs, setLogs] = useState([]) // New: Live Logs

  
  // Auction State
  const [auctionItem, setAuctionItem] = useState({ name: "", debt: 0 })
  const [catType, setCatType] = useState("supplier")
  const [auctionWinner, setAuctionWinner] = useState("")
  const [auctionPrice, setAuctionPrice] = useState("")

  // --- DATA SYNC ---
  const fetchData = async () => {
    // 1. Get Teams
    const { data: tData } = await supabase.from('teams').select('*').order('code')
    // 2. Get Config
    const { data: cData } = await supabase.from('config').select('*')
    
    // --- NEW: 3. Get Catalog (The Fix) ---
    try {
        const catRes = await axios.get(`${ENGINE_URL}/catalog`)
        setCatalog(catRes.data)
    } catch (e) { console.error("Catalog Error") }

    // --- NEW: 4. GET LOGS ---
    try {
        const logRes = await axios.get(`${ENGINE_URL}/admin/logs`)
        setMasterLogs(logRes.data)
    } catch (e) { console.error("Log fetch failed") }
    // ------------------------

    const configObj = {}
    if (cData) cData.forEach(c => configObj[c.key] = c.value)
    
    const processed = (tData || []).map(t => ({
      ...t,
      score: (t.cash * 0.6) + ((100 - t.carbon_debt) * 10),
      is_locked: t.last_action_round >= 900 // Simple check for lock
    }))
    setTeams(processed)
    setConfig(configObj)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 4000)
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(sub) }
  }, [])

  // --- ACTIONS ---

  const handleCalculate = async () => {
    if(!confirm(`⚠️ RUN SIMULATION: ${selectedEvent}?`)) return;
    setLoading(true)
    try {
        await supabase.from('config').update({ value: selectedEvent }).eq('key', 'active_event')
        const res = await axios.post(`${ENGINE_URL}/calculate-round`, { event_name: selectedEvent })
        
        // Show Logs in Terminal
        const newLogs = res.data.logs || [`Updated ${res.data.updated} teams (No detailed logs)`]
        setLogs(prev => [`--- YEAR ${config.current_round} RESULTS ---`, ...newLogs, ...prev])
        
        fetchData()
    } catch (e) { alert("Engine Error"); console.error(e) }
    setLoading(false)
  }

  const handleNextYear = async () => {
      if(!confirm("Start Next Year? This unlocks everyone.")) return;
      await axios.post(`${ENGINE_URL}/start-new-year`)
      setLogs(prev => ["--- NEW YEAR STARTED ---", ...prev])
      fetchData()
  }

  // BULK ACTIONS
  const handleLockAll = async () => axios.post(`${ENGINE_URL}/admin/lock-all`).then(fetchData)
  const handleUnlockAll = async () => axios.post(`${ENGINE_URL}/admin/unlock-all`).then(fetchData)
  const handleStimulus = async () => {
      if(confirm("Give $500 to EVERY team?")) {
          await axios.post(`${ENGINE_URL}/admin/global-bonus`, { amount: 500 })
          fetchData()
      }
  }
  const handleAwardAuction = async () => {
    if(!confirm(`Confirm Sale:\n${auctionItem.name} to ${auctionWinner} for $${auctionPrice}?`)) return;

    try {
        await axios.post(`${ENGINE_URL}/admin/grant-auction-item`, {
            team_code: auctionWinner,
            item_name: auctionItem.name,
            price: parseInt(auctionPrice),
            debt_reduction: auctionItem.debt
        })
        alert(`✅ Sold! $${auctionPrice} deducted from ${auctionWinner}.`)
        setAuctionWinner("")
        setAuctionPrice("")
        fetchData()
    } catch (err) {
        alert("Error: Team not found or connection failed.")
    }
  }

  // TEAM ACTIONS
  const handleAddTeam = async () => {
      if(!newTeamName) return;
      await axios.post(`${ENGINE_URL}/admin/add-team`, { team_code: newTeamName })
      setNewTeamName("")
      fetchData()
  }
  const handleSaveStats = async () => {
    if (!editingTeam) return;
    try {
        await axios.post(`${ENGINE_URL}/admin/update-team-stats`, {
            team_code: editingTeam.code,
            cash_change: parseInt(editCash),
            debt_change: parseInt(editDebt)
        })
        setEditingTeam(null) // Close modal
        setEditCash(0)
        setEditDebt(0)
        fetchData() // Refresh UI
        alert("Stats Updated!")
    } catch (e) { alert("Update failed") }
}
   const handleSaveInfo = async () => { 
      if (!editingTeam) return;
      await axios.post(`${ENGINE_URL}/admin/update-team-info`, {
          team_code: editingTeam.code,
          username: editUser,
          password: editPass,
          members: editMembers
      })
      alert("Credentials Updated!")
  }
  const handleRemoveTeam = async (code) => {
      if(confirm(`Delete ${code}?`)) await axios.post(`${ENGINE_URL}/admin/remove-team`, { team_code: code }).then(fetchData)
  }
  const   handleResetTeam = async (code) => {
      if(!confirm(`⚠️ WARNING: Reset ${code} to start? \n(Cash -> $1500, Debt -> 0, Assets -> Empty)`)) return;
      await axios.post(`${ENGINE_URL}/admin/reset-single-team`, { team_code: code })
      alert(`${code} has been reset!`)
      fetchData()
  }
  const handleToggleLock = async (code) => axios.post(`${ENGINE_URL}/admin/toggle-lock`, { team_code: code }).then(fetchData)
  
  const handleBroadcast = async () => {
    await axios.post(`${ENGINE_URL}/admin/broadcast`, { message: broadcastMsg })
    setBroadcastMsg("")
    alert("Sent!")
  }

  const handleReset = async () => {
      if(confirm("⚠️ FACTORY RESET GAME?")) await axios.post(`${ENGINE_URL}/admin/reset-game`).then(() => window.location.reload())
  }

  // STATISTICS
  const totalCash = teams.reduce((acc, t) => acc + t.cash, 0)
  const avgDebt = teams.length ? Math.round(teams.reduce((acc, t) => acc + t.carbon_debt, 0) / teams.length) : 0

  if (!adminAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-4">
          <h1 className="text-xl font-bold">🛡️ Mission Control Access</h1>
          <input type="password" placeholder="Enter Admin Password" 
            className="w-full bg-slate-950 p-3 rounded border border-slate-700"
            onChange={e => setAdminPass(e.target.value)}
          />
          <button onClick={() => adminPass === "admin123" ? setAdminAuth(true) : alert("Wrong Password")}
            className="w-full bg-blue-600 py-3 rounded font-bold">
            Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* NAVBAR */}
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded text-white font-bold">CC</div>
            <div>
                <h1 className="font-bold text-lg leading-none">Mission Control</h1>
                <p className="text-xs text-slate-400">Year {config.current_round}</p>
            </div>
        </div>
        <div className="flex bg-slate-800/50 rounded p-1 border border-slate-700">
            {['dashboard', 'teams', 'ranking', 'auction', 'logs', 'settings'].map(tab => ( // Added 'auction'
                <button 
                    key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    {tab}
                </button>
            ))}
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* GLOBAL STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Active Teams" value={teams.length} icon={<Globe size={16}/>} />
            <StatCard label="Total Economy" value={`$${totalCash.toLocaleString()}`} icon={<Wallet size={16}/>} color="text-emerald-400" />
            <StatCard label="Avg Carbon Debt" value={`${avgDebt} CO2`} icon={<AlertOctagon size={16}/>} color="text-red-400" />
            <StatCard label="Decisions Made" value={teams.filter(t=>t.inventory_choice!=='None').length} icon={<RotateCw size={16}/>} />
        </div>

        {/* === TAB 1: DASHBOARD === */}
        {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT: CONTROLS */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                        <h2 className="text-blue-400 font-bold mb-4 flex items-center gap-2"><Play size={18}/> Game Engine</h2>
                        
                        <select className="w-full bg-slate-950 p-3 rounded border border-slate-700 mb-4 text-white font-mono" 
                            value={selectedEvent} onChange={e=>setSelectedEvent(e.target.value)}>
                            <option>The Carbon Tax</option>
                            <option>The Viral Expose</option>
                            <option>The Economic Recession</option>
                            <option>The Tech Breakthrough</option>
                        </select>
                        
                        <button onClick={handleCalculate} disabled={loading} 
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-lg font-bold mb-4 shadow-lg shadow-blue-900/20 text-lg transition-all flex items-center justify-center gap-2">
                            {loading ? <RotateCw className="animate-spin"/> : "⚡ RUN SIMULATION"}
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={handleNextYear} className="bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold">
                                ⏭️ Next Year
                            </button>
                            <button onClick={handleStimulus} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 py-3 rounded-lg font-bold text-sm">
                                💸 Stimulus
                            </button>
                        </div>
                    </div>

                    {/* LIVE LOG TERMINAL */}
                    <div className="bg-black p-4 rounded-xl border border-slate-800 h-64 overflow-y-auto font-mono text-xs shadow-inner">
                        <h3 className="text-slate-500 font-bold mb-2 flex gap-2 sticky top-0 bg-black pb-2 border-b border-slate-800"><Terminal size={14}/> SYSTEM LOGS</h3>
                        {logs.length === 0 && <span className="text-slate-700">Waiting for events...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className={`mb-1 ${log.includes('---') ? 'text-blue-400 font-bold mt-2' : 'text-slate-300'}`}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: LEADERBOARD */}
                <div className="lg:col-span-8 bg-slate-900 p-6 rounded-xl border border-slate-800 h-[600px]">
                     <h2 className="text-emerald-400 font-bold mb-4 flex gap-2"><Trophy size={18}/> Live Leaderboard</h2>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teams.sort((a,b)=>b.score-a.score).slice(0,12)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                            <XAxis dataKey="code" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'1px solid #334155'}} itemStyle={{color:'#10b981'}}/>
                            <Bar dataKey="score" fill="#10b981" radius={[4,4,0,0]} barSize={30}/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* === TAB 2: TEAMS & TOOLS === */}
        {activeTab === 'teams' && (
            <div className="space-y-6">
                
                {/* TOOLBAR */}
                {/* NEW REGISTRATION FORM */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-400">®️ Register New Team</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <input className="bg-slate-950 p-2 rounded border border-slate-700 text-white" placeholder="Team ID (e.g. Team1)" value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}/>
                        <input className="bg-slate-950 p-2 rounded border border-slate-700 text-white" placeholder="Username" id="reg-user" />
                        <input className="bg-slate-950 p-2 rounded border border-slate-700 text-white" placeholder="Password" id="reg-pass" />
                        <input className="bg-slate-950 p-2 rounded border border-slate-700 text-white" placeholder="Members (John, Doe)" id="reg-members" />
                    </div>
                    <button onClick={() => {
                        const user = document.getElementById('reg-user').value
                        const pass = document.getElementById('reg-pass').value
                        const mems = document.getElementById('reg-members').value
                        if(newTeamName && user && pass) {
                            axios.post(`${ENGINE_URL}/admin/add-team`, { 
                                team_code: newTeamName, 
                                username: user, 
                                password: pass, 
                                members: mems 
                            }).then(() => {
                                setNewTeamName("")
                                fetchData()
                                alert("Team Registered!")
                            })
                        } else { alert("Please fill all fields") }
                    }} className="bg-emerald-600 hover:bg-emerald-500 py-2 rounded font-bold text-sm">
                        + Register Team
                    </button>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1 bg-slate-900 p-2 rounded-xl border border-slate-800 flex gap-2">
                        <input className="bg-transparent border-none outline-none text-white flex-1 px-2 placeholder:text-slate-600" 
                            placeholder="New Team Code..." value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}/>
                        <button onClick={handleAddTeam} className="bg-emerald-600 px-4 rounded font-bold text-sm">Create</button>
                    </div>
                    <button onClick={handleLockAll} className="bg-orange-900/30 text-orange-400 border border-orange-900/50 px-4 rounded font-bold flex gap-2 items-center hover:bg-orange-900/50">
                        <Lock size={16}/> Lock All
                    </button>
                    <button onClick={handleUnlockAll} className="bg-blue-900/30 text-blue-400 border border-blue-900/50 px-4 rounded font-bold flex gap-2 items-center hover:bg-blue-900/50">
                        <Unlock size={16}/> Unlock All
                    </button>
                </div>

                {/* GRID VIEW */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {teams.map(t => (
                        <div key={t.code} className="bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition-all group relative">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{t.code}</h3>
                                {t.is_locked && <Lock size={14} className="text-orange-500"/>}
                            </div>
                            <div className="space-y-1 text-sm font-mono">
                                <div className="flex justify-between"><span className="text-slate-500">Cash</span> <span className="text-emerald-400">${t.cash}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Debt</span> <span className="text-red-400">{t.carbon_debt}</span></div>
                                <div className="flex justify-between pt-2 border-t border-slate-800">
                                    <span className="text-slate-500">Choice</span> 
                                    <span className="text-blue-300">{t.inventory_choice === 'None' ? '-' : t.inventory_choice}</span>
                                </div>
                            </div>
                            
                            {/* HOVER ACTIONS */}
                            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                
                                {/* --- NEW EDIT BUTTON --- */}
                                <button onClick={() => {
                                    setEditingTeam(t)
                                    setEditUser(t.username || "")
                                    setEditPass(t.password || "")
                                    setEditMembers(t.members || "")
                                }} className="px-4 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-500 flex items-center gap-2">
                                    <Edit size={12}/> Edit
                                </button>
                                {/* ----------------------- */}

                                <button onClick={()=>handleToggleLock(t.code)} className="px-4 py-1 bg-slate-700 rounded text-xs font-bold hover:bg-white hover:text-black transition-colors">
                                    {t.is_locked ? 'Unlock Team' : 'Lock Team'}
                                </button>

                                {/* --- RESET BUTTON --- */}
                                <button onClick={()=>handleResetTeam(t.code)} className="px-4 py-1 bg-orange-900/20 text-orange-400 rounded text-xs font-bold hover:bg-orange-600 hover:text-white transition-colors flex items-center gap-2">
                                    <RotateCcw size={12}/> Reset Team
                                </button>
                                {/* -------------------- */}

                                <button onClick={()=>handleRemoveTeam(t.code)} className="px-4 py-1 bg-red-900/20 text-red-400 rounded text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">
                                    Delete Team
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === TAB: RANKING (FIXED: NO MUTATION) === */}
        {activeTab === 'ranking' && (
            <div className="space-y-6">
                
                {/* 1. Header */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center">
                    <h2 className="text-2xl font-bold text-white mb-2 flex justify-center items-center gap-2">
                        <Trophy className="text-yellow-400" size={32}/> Official Leaderboard
                    </h2>
                    <p className="text-slate-400">Scores calculated based on Cash + Sustainability Rating.</p>
                </div>

                {/* 2. Chart */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-96">
                     <ResponsiveContainer width="100%" height="100%">
                        {/* FIX 1: Added [...teams] to create a copy before sorting */}
                        <BarChart data={[...teams].sort((a,b)=>b.score-a.score)} layout="vertical" margin={{left: 20}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false}/>
                            <XAxis type="number" stroke="#64748b" fontSize={10}/>
                            <YAxis dataKey="code" type="category" stroke="#fff" fontSize={12} width={60}/>
                            <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'1px solid #334155'}} cursor={{fill: '#1e293b'}}/>
                            <Bar dataKey="score" fill="#10b981" radius={[0,4,4,0]} barSize={20} label={{ position: 'right', fill: '#fff', fontSize: 10 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. Table */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                            <tr>
                                <th className="p-4">Rank</th>
                                <th className="p-4">Team</th>
                                <th className="p-4">Cash</th>
                                <th className="p-4">Debt</th>
                                <th className="p-4 text-emerald-400">Total Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {/* FIX 2: Added [...teams] to create a copy before sorting */}
                            {[...teams].sort((a,b)=>b.score-a.score).map((t, i) => (
                                <tr key={t.code} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-mono text-slate-500">#{i+1}</td>
                                    <td className="p-4 font-bold text-white text-lg">{t.code}</td>
                                    <td className="p-4 font-mono text-emerald-400 font-bold">${t.cash.toLocaleString()}</td>
                                    <td className="p-4 font-mono text-red-400 font-bold">{t.carbon_debt}</td>
                                    <td className="p-4 font-bold text-xl text-white">{Math.floor(t.score)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        )}
        
        {/* === TAB 3: LIVE AUCTIONEER === */}
        {activeTab === 'auction' && (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 text-center space-y-4">
                    <div className="inline-block p-4 bg-purple-900/20 rounded-full mb-2">
                        <Gavel size={48} className="text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Live Auction Console</h2>
                    <p className="text-slate-400">Award items to the highest bidder immediately.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT: ITEM SELECTION */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                        <h3 className="font-bold text-purple-400 uppercase text-xs tracking-wider">1. Select Item</h3>
                        <div className="space-y-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                             {/* DYNAMIC AUCTION LIST */}
                            {catalog.filter(i => i.category === 'auction').map((item) => (
                                <button 
                                    key={item.id}
                                    onClick={() => setAuctionItem({name: item.name, debt: item.debt_effect})} 
                                    className={`w-full p-4 rounded-lg border text-left transition-all ${auctionItem.name === item.name ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-purple-500'}`}
                                >
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-xs opacity-75">{item.debt_effect} Carbon Debt</div>
                                    <div className="text-xs text-slate-600 font-mono mt-1">Base Cost: ${item.cost}</div>
                                </button>
                            ))}
                            
                            {/* Empty State Message */}
                            {catalog.filter(i => i.category === 'auction').length === 0 && (
                                <div className="text-slate-500 text-sm text-center italic p-4">
                                    No auction items found. Add one in Settings!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: SECURE CODE GENERATOR */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                        <h3 className="font-bold text-emerald-400 uppercase text-xs tracking-wider flex items-center gap-2">
                            <Lock size={14}/> Generate Secure Code
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Target Team</label>
                                <input className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1 font-mono" 
                                    placeholder="Team3" id="sec-team"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Price ($)</label>
                                <input type="number" className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1 font-mono" 
                                    placeholder="700" id="sec-price"/>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500">Custom Code</label>
                            <input className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1 font-mono uppercase" 
                                placeholder="LOBBY-1" id="sec-code"/>
                        </div>

                        <div className="p-3 bg-slate-950 rounded text-xs text-slate-400 border border-slate-800">
                            Selected Item: <span className="text-white font-bold">{auctionItem.name || "None"}</span>
                        </div>

                        <button onClick={async () => {
                            const team = document.getElementById('sec-team').value
                            const price = document.getElementById('sec-price').value
                            const code = document.getElementById('sec-code').value
                            
                            if(!team || !price || !code || !auctionItem.name) return alert("Fill all fields + Select Item");

                            try {
                                await axios.post(`${ENGINE_URL}/admin/create-code`, {
                                    code: code,
                                    team_id: team,
                                    item_name: auctionItem.name,
                                    price: parseInt(price),
                                    debt_reduction: auctionItem.debt
                                })
                                alert(`✅ Code Active: ${code}\nOnly ${team} can use it for $${price}.`)
                            } catch (e) { alert("Error creating code") }
                        }} 
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-lg font-bold shadow-lg shadow-blue-900/20 text-lg flex items-center justify-center gap-2">
                            Generate Code
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* === TAB: LOGS === */}
        {activeTab === 'logs' && (
            <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <FileText className="text-blue-400"/> Global Transaction Ledger
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
                                <tr>
                                    <th className="p-3">Time</th>
                                    <th className="p-3">Rd</th>
                                    <th className="p-3">Team</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {masterLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 font-mono">
                                        <td className="p-3 text-slate-500 text-xs">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="p-3 text-slate-500">{log.round}</td>
                                        <td className="p-3 font-bold text-white">{log.team_id}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                                log.action_type === 'BUY_SUPPLIER' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' :
                                                log.action_type === 'ADMIN_EDIT' ? 'bg-orange-900/30 text-orange-400 border-orange-800' :
                                                'bg-blue-900/30 text-blue-400 border-blue-800'
                                            }`}>
                                                {log.action_type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-300">
                                            {log.details?.msg || JSON.stringify(log.details)}
                                        </td>
                                    </tr>
                                ))}
                                {masterLogs.length === 0 && (
                                    <tr><td colSpan="5" className="p-8 text-center text-slate-500 italic">No transactions recorded yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* === TAB 3: SETTINGS === */}
        {activeTab === 'settings' && (
            // CHANGE 1: Changed "grid h-96" to "flex flex-col" so items stack vertically
            <div className="flex flex-col items-center gap-8 py-10">

                {/* 1. DANGER ZONE (Existing) */}
                <div className="text-center space-y-4 p-8 border border-red-900/30 rounded-2xl bg-red-900/5 w-full max-w-2xl">
                    <ShieldAlert size={64} className="text-red-500 mx-auto"/>
                    <h2 className="text-red-500 font-bold text-2xl">Danger Zone</h2>
                    <p className="text-slate-400">Permanently delete all teams and reset year to 1.</p>
                    <button onClick={handleReset} className="bg-red-600 hover:bg-red-500 text-white py-3 px-8 rounded-lg font-bold shadow-lg shadow-red-900/20 w-full">
                        FACTORY RESET GAME
                    </button>
                    
                    <div className="h-px bg-slate-800 my-6"></div>
                    
                    <h3 className="text-slate-400 font-bold mb-2">Broadcast Message</h3>
                    <div className="flex gap-2">
                        <input className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white flex-1" 
                            placeholder="Announcement..." value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)}/>
                        <button onClick={handleBroadcast} className="bg-slate-800 hover:bg-slate-700 px-4 rounded font-bold">Send</button>
                    </div>
                </div>

                {/* 2. DYNAMIC CATALOG MANAGER */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-left w-full max-w-2xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Plus size={18}/> Add New Game Item</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Category</label>
                            <select 
                                id="cat-type" 
                                value={catType}
                                onChange={(e) => setCatType(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1"
                            >
                                <option value="supplier">Supplier (Tier Choice)</option>
                                <option value="auction">Auction Item</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Item Name</label>
                            <input id="cat-name" className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1" placeholder="e.g. Nuclear Plant"/>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Cost ($)</label>
                            {/* DISABLED IF AUCTION ITEM */}
                            <input 
                                id="cat-cost" 
                                type="number" 
                                disabled={catType === 'auction'}
                                className={`w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1 ${catType === 'auction' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                placeholder={catType === 'auction' ? "N/A (Bidding)" : "1000"}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold">Debt Effect</label>
                            <input id="cat-debt" type="number" className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1" placeholder="-50"/>
                        </div>
                        <div className="col-span-2">
                             <label className="text-xs text-slate-500 font-bold">Description</label>
                             <input id="cat-desc" className="w-full bg-slate-950 border border-slate-700 p-3 rounded text-white mt-1" placeholder="Short description..."/>
                        </div>
                    </div>

                    <button onClick={async () => {
                        const name = document.getElementById('cat-name').value
                        const debt = document.getElementById('cat-debt').value
                        const desc = document.getElementById('cat-desc').value
                        
                        // LOGIC: If Auction, Cost is 0. If Supplier, read the input.
                        let cost = 0
                        if (catType === 'supplier') {
                            cost = document.getElementById('cat-cost').value
                            if (!cost) return alert("Please enter a Cost");
                        }

                        if(!name) return alert("Please enter a Name");

                        try {
                            await axios.post(`${ENGINE_URL}/admin/add-catalog-item`, {
                                category: catType, 
                                name, 
                                description: desc, 
                                cost: parseInt(cost), 
                                debt_effect: parseInt(debt || 0)
                            })
                            alert("Item Added to Game!")
                        } catch(e) { alert("Error adding item") }
                    }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold">
                        Add to Game
                    </button>
                </div>

                {/* 3. EXISTING ITEMS MANAGER (DELETE OPTION) */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-left w-full max-w-2xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Trash2 size={18} className="text-red-400"/> Manage Existing Items
                    </h3>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {catalog.length === 0 && <p className="text-slate-500 italic">No items found.</p>}
                        
                        {catalog.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-slate-950 p-3 rounded border border-slate-800 hover:border-slate-600 transition-all">
                                <div>
                                    <div className="font-bold text-white flex items-center gap-2">
                                        {item.name}
                                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border ${item.category === 'auction' ? 'bg-purple-900/30 text-purple-400 border-purple-800' : 'bg-blue-900/30 text-blue-400 border-blue-800'}`}>
                                            {item.category}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Cost: ${item.cost} | Debt: {item.debt_effect}
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={async () => {
                                        if(!confirm(`⚠️ PERMANENTLY DELETE "${item.name}"?`)) return;
                                        try {
                                            await axios.post(`${ENGINE_URL}/admin/delete-catalog-item`, { item_id: item.id })
                                            // Refresh the list immediately
                                            const catRes = await axios.get(`${ENGINE_URL}/catalog`)
                                            setCatalog(catRes.data)
                                        } catch(e) { alert("Delete failed") }
                                    }}
                                    className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-500 rounded transition-colors"
                                    title="Delete Item"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        )}
      </main>

      {/* === PASTE THE MODAL CODE HERE === */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl animate-fade-in">
                
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">Editing {editingTeam.code}</h2>
                        <p className="text-xs text-slate-400">Current: ${editingTeam.cash} | {editingTeam.carbon_debt} Debt</p>
                    </div>
                    <button onClick={()=>setEditingTeam(null)} className="text-slate-500 hover:text-white"><X/></button>
                </div>

                <div className="space-y-4">
                    {/* --- CREDENTIALS SECTION --- */}
                    <div className="bg-slate-950 p-4 rounded border border-slate-800 mb-4 space-y-3">
                        <label className="text-xs text-blue-400 uppercase font-bold">Team Credentials</label>
                        <div className="space-y-2">
                            <input className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-white" 
                                placeholder="Username" value={editUser} onChange={e=>setEditUser(e.target.value)}/>
                            <input className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-white" 
                                placeholder="Password" value={editPass} onChange={e=>setEditPass(e.target.value)}/>
                            <input className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-white" 
                                placeholder="Members" value={editMembers} onChange={e=>setEditMembers(e.target.value)}/>
                        </div>
                        <button onClick={handleSaveInfo} className="w-full bg-blue-900/30 text-blue-400 border border-blue-900/50 py-2 rounded text-xs font-bold hover:bg-blue-900/50">
                            Update Login Info
                        </button>
                    </div>
                    
                    <div className="h-px bg-slate-800 my-4"></div>
                    {/* CASH INPUT */}
                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                        <label className="text-xs text-emerald-500 uppercase font-bold flex justify-between">
                            Add/Deduct Cash <span>(Use - for deduction)</span>
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-slate-500 font-bold">$</span>
                            <input type="number" className="w-full bg-transparent text-xl font-mono outline-none text-white" 
                                autoFocus
                                value={editCash} onChange={e=>setEditCash(e.target.value)} placeholder="0"/>
                        </div>
                    </div>

                    {/* DEBT INPUT */}
                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                        <label className="text-xs text-red-500 uppercase font-bold flex justify-between">
                            Add/Remove Debt <span>(Use - to reduce)</span>
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-slate-500 font-bold">CO2</span>
                            <input type="number" className="w-full bg-transparent text-xl font-mono outline-none text-white" 
                                value={editDebt} onChange={e=>setEditDebt(e.target.value)} placeholder="0"/>
                        </div>
                    </div>

                    <button onClick={handleSaveStats} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold flex justify-center items-center gap-2 mt-4 shadow-lg">
                        <Save size={18}/> Save Changes
                    </button>
                </div>
                {/* --- ASSET MANAGEMENT (REVOKE) --- */}
                <div className="bg-slate-950 p-4 rounded border border-slate-800 mb-4">
                    <label className="text-xs text-purple-400 uppercase font-bold mb-2 block">Current Assets</label>
                    <div className="flex flex-wrap gap-2">
                        {editingTeam.assets && editingTeam.assets.split(',').filter(a=>a).map((asset, i) => (
                            <div key={i} className="px-3 py-1 bg-purple-900/20 border border-purple-800 rounded-full text-xs flex items-center gap-2">
                                <span className="text-purple-300">{asset}</span>
                                <button onClick={async () => {
                                    if(!confirm(`Remove ${asset}?`)) return;
                                    await axios.post(`${ENGINE_URL}/admin/revoke-asset`, { team_code: editingTeam.code, asset_name: asset })
                                    alert("Item Revoked")
                                    // Close modal to force refresh or call fetchData()
                                    setEditingTeam(null); fetchData();
                                }} className="text-red-400 hover:text-white font-bold">×</button>
                            </div>
                        ))}
                        {(!editingTeam.assets || editingTeam.assets === "") && <span className="text-slate-600 text-xs italic">No assets owned.</span>}
                    </div>
                </div>
            </div>
        </div>
      )}
      {/* === END OF MODAL CODE === */}

    </div>
  )
}

function StatCard({ label, value, icon, color='text-white' }) {
    return (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-800 ${color}`}>{icon}</div>
            <div>
                <p className="text-xs text-slate-500 uppercase font-bold">{label}</p>
                <p className={`text-xl font-mono font-bold ${color}`}>{value}</p>
            </div>
        </div>
    )
}