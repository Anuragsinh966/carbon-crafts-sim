import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Play, RotateCw, Trophy, Lock, Unlock, Plus, Trash2, Mic, AlertOctagon, Wallet, Globe, Terminal, ShieldAlert } from 'lucide-react'
import axios from 'axios'

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"

export default function AdminApp() {
  const [teams, setTeams] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  
  // UI State
  const [activeTab, setActiveTab] = useState("dashboard")
  const [newTeamName, setNewTeamName] = useState("")
  const [selectedEvent, setSelectedEvent] = useState("The Carbon Tax")
  const [broadcastMsg, setBroadcastMsg] = useState("")
  const [logs, setLogs] = useState([]) // New: Live Logs

  // --- DATA SYNC ---
  const fetchData = async () => {
    const { data: tData } = await supabase.from('teams').select('*').order('code')
    const { data: cData } = await supabase.from('config').select('*')
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

  // TEAM ACTIONS
  const handleAddTeam = async () => {
      if(!newTeamName) return;
      await axios.post(`${ENGINE_URL}/admin/add-team`, { team_code: newTeamName })
      setNewTeamName("")
      fetchData()
  }
  const handleRemoveTeam = async (code) => {
      if(confirm(`Delete ${code}?`)) await axios.post(`${ENGINE_URL}/admin/remove-team`, { team_code: code }).then(fetchData)
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
            {['dashboard', 'teams', 'settings'].map(tab => (
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
                                <button onClick={()=>handleToggleLock(t.code)} className="px-4 py-1 bg-slate-700 rounded text-xs font-bold hover:bg-white hover:text-black">
                                    {t.is_locked ? 'Unlock Team' : 'Lock Team'}
                                </button>
                                <button onClick={()=>handleRemoveTeam(t.code)} className="px-4 py-1 bg-red-900/50 text-red-400 rounded text-xs font-bold hover:bg-red-600 hover:text-white">
                                    Delete Team
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === TAB 3: SETTINGS === */}
        {activeTab === 'settings' && (
            <div className="grid place-items-center h-96">
                <div className="text-center space-y-4 p-8 border border-red-900/30 rounded-2xl bg-red-900/5">
                    <ShieldAlert size={64} className="text-red-500 mx-auto"/>
                    <h2 className="text-red-500 font-bold text-2xl">Danger Zone</h2>
                    <p className="text-slate-400">Permanently delete all teams and reset year to 1.</p>
                    <button onClick={handleReset} className="bg-red-600 hover:bg-red-500 text-white py-3 px-8 rounded-lg font-bold shadow-lg shadow-red-900/20">
                        FACTORY RESET GAME
                    </button>
                    
                    <div className="h-px bg-slate-800 my-6"></div>
                    
                    <h3 className="text-slate-400 font-bold mb-2">Broadcast Message</h3>
                    <div className="flex gap-2">
                        <input className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white" 
                            placeholder="Announcement..." value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)}/>
                        <button onClick={handleBroadcast} className="bg-slate-800 hover:bg-slate-700 px-4 rounded font-bold">Send</button>
                    </div>
                </div>
            </div>
        )}
      </main>
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