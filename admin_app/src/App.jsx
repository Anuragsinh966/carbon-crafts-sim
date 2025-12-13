import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Play, RotateCw, Trophy, Edit, Mic, AlertOctagon, Save, X, Trash2 } from 'lucide-react'
import axios from 'axios'

// Uses the online URL if available, otherwise defaults to local
const ENGINE_URL = import.meta.env.VITE_ENGINE_URL || "http://127.0.0.1:8000"

export default function AdminApp() {
  const [teams, setTeams] = useState([])
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  
  // Navigation
  const [activeTab, setActiveTab] = useState("dashboard") // 'dashboard' | 'teams' | 'settings'

  // Control State
  const [selectedEvent, setSelectedEvent] = useState("The Carbon Tax")
  const [broadcastMsg, setBroadcastMsg] = useState("")
  
  // Edit Modal State
  const [editingTeam, setEditingTeam] = useState(null)
  const [manualCash, setManualCash] = useState(0)
  const [manualDebt, setManualDebt] = useState(0)

  // --- DATA SYNC ---
  const fetchData = async () => {
    const { data: tData } = await supabase.from('teams').select('*').order('code')
    const { data: cData } = await supabase.from('config').select('*')
    const configObj = {}
    if (cData) cData.forEach(c => configObj[c.key] = c.value)
    
    const processed = (tData || []).map(t => ({
      ...t,
      score: (t.cash * 0.6) + ((100 - t.carbon_debt) * 10)
    }))
    setTeams(processed)
    setConfig(configObj)
  }

  useEffect(() => {
    fetchData()
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // --- ACTIONS ---
  const handleEventRun = async () => {
    if(!confirm(`Deploy ${selectedEvent}?`)) return;
    setLoading(true)
    await supabase.from('config').update({ value: selectedEvent }).eq('key', 'active_event')
    await axios.post(`${ENGINE_URL}/calculate-round`, { event_name: selectedEvent })
    setLoading(false)
    alert("✅ Calculation Complete")
  }

  const handleManualUpdate = async () => {
    if (!editingTeam) return;
    try {
        await axios.post(`${ENGINE_URL}/admin/update-team`, {
            team_code: editingTeam.code,
            cash_change: parseInt(manualCash),
            debt_change: parseInt(manualDebt)
        })
        setEditingTeam(null)
        setManualCash(0)
        setManualDebt(0)
        alert("Updated Successfully")
        fetchData()
    } catch(e) { alert("Failed to update team") }
  }

  const handleBroadcast = async () => {
    await axios.post(`${ENGINE_URL}/admin/broadcast`, { message: broadcastMsg })
    alert("📢 Message Sent to Students")
    setBroadcastMsg("")
  }

  const handleReset = async () => {
      if(confirm("⚠️ DANGER: Are you sure you want to RESET THE WHOLE GAME?")) {
          await axios.post(`${ENGINE_URL}/admin/reset-game`)
          window.location.reload()
      }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* NAVBAR */}
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded text-emerald-400 font-bold">CC</div>
            <div>
                <h1 className="font-bold text-lg">Mission Control</h1>
                <p className="text-xs text-slate-400">Year {config.current_round}</p>
            </div>
        </div>
        <div className="flex bg-slate-800 rounded p-1">
            {['dashboard', 'teams', 'settings'].map(tab => (
                <button 
                    key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded text-sm font-bold capitalize ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    {tab}
                </button>
            ))}
        </div>
        <button onClick={fetchData}><RotateCw size={20} className={loading?'animate-spin':''}/></button>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        
        {/* === TAB 1: DASHBOARD === */}
        {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <h2 className="text-blue-400 font-bold mb-4 flex gap-2"><Play size={18}/> Controls</h2>
                    <select className="w-full bg-slate-950 p-3 rounded border border-slate-700 mb-3" 
                        value={selectedEvent} onChange={e=>setSelectedEvent(e.target.value)}>
                        <option>The Carbon Tax</option>
                        <option>The Viral Expose</option>
                        <option>The Economic Recession</option>
                        <option>The Tech Breakthrough</option>
                    </select>
                    <button onClick={handleEventRun} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded font-bold mb-4">
                        ⚡ Run Event
                    </button>
                    
                    <div className="border-t border-slate-800 pt-4">
                        <h3 className="text-sm font-bold text-slate-400 mb-2 flex gap-2"><Mic size={16}/> Broadcast</h3>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-950 border border-slate-700 rounded px-2" placeholder="Msg..." value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)}/>
                            <button onClick={handleBroadcast} className="bg-slate-700 px-3 rounded">Send</button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 h-[400px]">
                     <h2 className="text-emerald-400 font-bold mb-4 flex gap-2"><Trophy size={18}/> Leaderboard</h2>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teams.sort((a,b)=>b.score-a.score).slice(0,10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                            <XAxis dataKey="code" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'1px solid #334155'}}/>
                            <Bar dataKey="score" fill="#10b981" radius={[4,4,0,0]} barSize={40}/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* === TAB 2: TEAM MANAGEMENT === */}
        {activeTab === 'teams' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
                        <tr>
                            <th className="p-4">Team</th>
                            <th className="p-4">Cash</th>
                            <th className="p-4">Debt</th>
                            <th className="p-4 text-right">Edit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {teams.map(t => (
                            <tr key={t.code} className="hover:bg-slate-800/50">
                                <td className="p-4 font-bold">{t.code}</td>
                                <td className="p-4 text-emerald-400 font-mono">${t.cash}</td>
                                <td className="p-4 text-red-400 font-mono">{t.carbon_debt}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setEditingTeam(t)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded border border-slate-700">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* === TAB 3: SETTINGS === */}
        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto bg-red-900/10 border border-red-900/30 p-6 rounded-xl">
                <h2 className="text-red-500 font-bold mb-4 flex gap-2"><AlertOctagon/> Danger Zone</h2>
                <button onClick={handleReset} className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/50 py-4 rounded font-bold flex justify-center gap-2">
                    <Trash2/> FACTORY RESET GAME
                </button>
            </div>
        )}
      </main>

      {/* EDIT MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Edit {editingTeam.code}</h2>
                    <button onClick={()=>setEditingTeam(null)}><X className="text-slate-400"/></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-4 rounded border border-slate-800">
                            <label className="text-xs text-slate-500 uppercase font-bold">Add Cash</label>
                            <input type="number" className="w-full bg-transparent text-xl font-mono mt-1 outline-none" 
                                value={manualCash} onChange={e=>setManualCash(e.target.value)} placeholder="0"/>
                        </div>
                        <div className="bg-slate-950 p-4 rounded border border-slate-800">
                            <label className="text-xs text-slate-500 uppercase font-bold">Add Debt</label>
                            <input type="number" className="w-full bg-transparent text-xl font-mono mt-1 outline-none" 
                                value={manualDebt} onChange={e=>setManualDebt(e.target.value)} placeholder="0"/>
                        </div>
                    </div>
                    <button onClick={handleManualUpdate} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded font-bold flex justify-center gap-2">
                        <Save size={18}/> Apply
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}