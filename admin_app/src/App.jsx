import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Play, RotateCw, Trophy, Lock, Unlock, Plus, Trash2, Mic, AlertOctagon, Save, X, Eye } from 'lucide-react'
import axios from 'axios'

// SMART URL (Uses Vercel env variable if online, otherwise local)
const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"

export default function AdminApp() {
  const [teams, setTeams] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  
  // Navigation
  const [activeTab, setActiveTab] = useState("dashboard") // 'dashboard' | 'teams' | 'settings'
  const [newTeamName, setNewTeamName] = useState("")

  // Game Control
  const [selectedEvent, setSelectedEvent] = useState("The Carbon Tax")
  const [broadcastMsg, setBroadcastMsg] = useState("")

  // --- DATA SYNC ---
  const fetchData = async () => {
    const { data: tData } = await supabase.from('teams').select('*').order('code')
    const { data: cData } = await supabase.from('config').select('*')
    const configObj = {}
    if (cData) cData.forEach(c => configObj[c.key] = c.value)
    
    const processed = (tData || []).map(t => ({
      ...t,
      score: (t.cash * 0.6) + ((100 - t.carbon_debt) * 10),
      is_locked: t.last_action_round >= parseInt(configObj.current_round || 1)
    }))
    setTeams(processed)
    setConfig(configObj)
  }

  useEffect(() => {
    fetchData()
    // Auto-Refresh Safety Net
    const interval = setInterval(fetchData, 4000)
    
    // Realtime Listener
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(sub) }
  }, [])

  // --- ACTIONS ---
  
  // 1. THE CALCULATE BUTTON
  const handleCalculate = async () => {
    if(!confirm(`⚠️ CONFIRM: Deduct money and apply ${selectedEvent}?`)) return;
    setLoading(true)
    try {
        await supabase.from('config').update({ value: selectedEvent }).eq('key', 'active_event')
        const res = await axios.post(`${ENGINE_URL}/calculate-round`, { event_name: selectedEvent })
        alert(`✅ Success! Updated ${res.data.updated} teams.`)
        fetchData()
    } catch (e) { alert("Connection Error: Is Python running?") }
    setLoading(false)
  }

  const handleNextYear = async () => {
      if(!confirm("Start Next Year? This resets choices.")) return;
      await axios.post(`${ENGINE_URL}/start-new-year`)
      fetchData()
  }

  // 2. TEAM MANAGEMENT ACTIONS
  const handleAddTeam = async () => {
      if(!newTeamName) return;
      await axios.post(`${ENGINE_URL}/admin/add-team`, { team_code: newTeamName })
      setNewTeamName("")
      fetchData()
  }

  const handleRemoveTeam = async (code) => {
      if(!confirm(`Delete ${code} permanently?`)) return;
      await axios.post(`${ENGINE_URL}/admin/remove-team`, { team_code: code })
      fetchData()
  }

  const handleToggleLock = async (code) => {
      await axios.post(`${ENGINE_URL}/admin/toggle-lock`, { team_code: code })
      fetchData()
  }

  const handleBroadcast = async () => {
    await axios.post(`${ENGINE_URL}/admin/broadcast`, { message: broadcastMsg })
    setBroadcastMsg("")
    alert("📢 Sent!")
  }

  const handleReset = async () => {
      if(confirm("⚠️ FACTORY RESET GAME?")) {
          await axios.post(`${ENGINE_URL}/admin/reset-game`)
          window.location.reload()
      }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* NAVBAR */}
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded text-emerald-400 font-bold border border-emerald-500/30">CC</div>
            <div>
                <h1 className="font-bold text-lg leading-none">Mission Control</h1>
                <p className="text-xs text-slate-400">Year {config.current_round} • {config.active_event || 'None'}</p>
            </div>
        </div>
        <div className="flex bg-slate-800/50 rounded p-1 border border-slate-700">
            {['dashboard', 'teams', 'settings'].map(tab => (
                <button 
                    key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    {tab}
                </button>
            ))}
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* === TAB 1: DASHBOARD (GAME FLOW) === */}
        {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT: CONTROLLER */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                        <h2 className="text-blue-400 font-bold mb-4 flex items-center gap-2"><Play size={18}/> Game Engine</h2>
                        
                        <label className="text-xs font-bold text-slate-500 uppercase">1. Select Event</label>
                        <select className="w-full bg-slate-950 p-3 rounded border border-slate-700 mb-4 mt-1 text-white" 
                            value={selectedEvent} onChange={e=>setSelectedEvent(e.target.value)}>
                            <option>The Carbon Tax</option>
                            <option>The Viral Expose</option>
                            <option>The Economic Recession</option>
                            <option>The Tech Breakthrough</option>
                        </select>
                        
                        <button onClick={handleCalculate} disabled={loading} 
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-lg font-bold mb-4 shadow-lg shadow-blue-900/20 text-lg transition-all">
                            {loading ? "Processing..." : "⚡ CALCULATE RESULTS"}
                        </button>
                        
                        <div className="h-px bg-slate-800 my-4"></div>
                        
                        <button onClick={handleNextYear} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold">
                            ⏭️ START NEXT YEAR
                        </button>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                         <h3 className="text-sm font-bold text-slate-400 mb-2 flex gap-2"><Mic size={16}/> Broadcast System</h3>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none focus:border-emerald-500" 
                                placeholder="Message to students..." value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)}/>
                            <button onClick={handleBroadcast} className="bg-slate-700 hover:bg-slate-600 px-4 rounded font-bold">Send</button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: LIVE DATA */}
                <div className="lg:col-span-8 bg-slate-900 p-6 rounded-xl border border-slate-800 h-[500px]">
                     <h2 className="text-emerald-400 font-bold mb-4 flex gap-2"><Trophy size={18}/> Live Leaderboard</h2>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teams.sort((a,b)=>b.score-a.score).slice(0,10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                            <XAxis dataKey="code" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'1px solid #334155', borderRadius:'8px'}} itemStyle={{color:'#10b981'}}/>
                            <Bar dataKey="score" fill="#10b981" radius={[4,4,0,0]} barSize={40}/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* === TAB 2: MANAGE TEAMS === */}
        {activeTab === 'teams' && (
            <div className="space-y-6">
                
                {/* ADD TEAM BAR */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex gap-4 items-center">
                    <Plus className="text-emerald-400"/>
                    <input className="bg-transparent border-none outline-none text-white flex-1 placeholder:text-slate-600" 
                        placeholder="Enter New Team ID (e.g. TeamAlpha)..." value={newTeamName} onChange={e=>setNewTeamName(e.target.value)}/>
                    <button onClick={handleAddTeam} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-bold text-sm">Create Team</button>
                </div>

                {/* TEAM LIST TABLE */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs tracking-wider">
                            <tr>
                                <th className="p-4">Team</th>
                                <th className="p-4">Cash / Debt</th>
                                <th className="p-4">Choice</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {teams.map(t => (
                                <tr key={t.code} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-bold text-white">{t.code}</td>
                                    <td className="p-4">
                                        <span className="text-emerald-400 font-mono">${t.cash}</span>
                                        <span className="text-slate-600 mx-2">|</span>
                                        <span className="text-red-400 font-mono">{t.carbon_debt} CO2</span>
                                    </td>
                                    <td className="p-4">
                                        {t.inventory_choice === 'None' ? 
                                            <span className="text-slate-600 italic">Waiting...</span> : 
                                            <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-xs border border-blue-800">{t.inventory_choice}</span>
                                        }
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleToggleLock(t.code)} className="group">
                                            {t.is_locked ? 
                                                <Lock size={16} className="text-orange-500 group-hover:text-white"/> : 
                                                <Unlock size={16} className="text-slate-600 group-hover:text-white"/>
                                            }
                                        </button>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleRemoveTeam(t.code)} className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-500 rounded transition-colors" title="Delete Team">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* === TAB 3: SETTINGS === */}
        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto bg-red-900/10 border border-red-900/30 p-8 rounded-xl text-center space-y-4">
                <AlertOctagon size={48} className="text-red-500 mx-auto"/>
                <h2 className="text-red-500 font-bold text-xl">Danger Zone</h2>
                <p className="text-slate-400 text-sm">This will wipe all cash, debt, and history for every team. It cannot be undone.</p>
                <button onClick={handleReset} className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/50 py-4 rounded-lg font-bold flex justify-center gap-2 transition-all">
                    FACTORY RESET GAME
                </button>
            </div>
        )}
      </main>
    </div>
  )
}