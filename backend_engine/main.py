from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import game_logic

# 1. SETUP
load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class RoundRequest(BaseModel):
    event_name: str

class TeamUpdate(BaseModel):
    team_code: str
    cash_change: int = 0
    debt_change: int = 0

class ManageTeamRequest(BaseModel):
    team_code: str

class GlobalActionRequest(BaseModel):
    amount: int = 0

class BroadcastRequest(BaseModel):
    message: str

# --- ROUTES ---

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/calculate-round")
def calculate_round(request: RoundRequest):
    print(f"⚡ CALCULATING: {request.event_name}")
    response = supabase.table("teams").select("*").execute()
    updated_count = 0
    logs = []

    for team in response.data:
        choice = team.get("inventory_choice", "None")
        if choice and choice != "None":
            team_adapter = {'Cash': team['cash'], 'CarbonDebt': team['carbon_debt']}
            profit, debt_change, msg = game_logic.calculate_outcome(team_adapter, choice, request.event_name)
            
            supabase.table("teams").update({
                "cash": int(team['cash'] + profit),
                "carbon_debt": int(team['carbon_debt'] + debt_change),
                "last_action_round": 999 # Auto-lock
            }).eq("code", team['code']).execute()
            
            updated_count += 1
            logs.append(f"[{team['code']}] {msg} (Cash +{profit}, Debt {debt_change})")

    return {"status": "success", "updated": updated_count, "logs": logs}

@app.post("/start-new-year")
def start_new_year():
    # Unlock everyone by resetting last_action_round to 0
    supabase.table("teams").update({"inventory_choice": "None", "last_action_round": 0}).neq("code", "placeholder").execute()
    
    config_res = supabase.table("config").select("*").eq("key", "current_round").single().execute()
    new_round = int(config_res.data['value']) + 1
    
    supabase.table("config").update({"value": str(new_round)}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    return {"status": "success", "round": new_round}

# --- NEW POWER FEATURES ---

@app.post("/admin/lock-all")
def lock_all_teams():
    """Forces all teams to stop trading."""
    supabase.table("teams").update({"last_action_round": 999}).neq("code", "placeholder").execute()
    return {"status": "success"}

@app.post("/admin/unlock-all")
def unlock_all_teams():
    """Allows all teams to trade again."""
    supabase.table("teams").update({"last_action_round": 0}).neq("code", "placeholder").execute()
    return {"status": "success"}

@app.post("/admin/global-bonus")
def global_bonus(req: GlobalActionRequest):
    """Gives money to EVERY team (Stimulus Check)."""
    # Requires fetching all, calculating, and updating one by one (Supabase limit)
    teams = supabase.table("teams").select("*").execute().data
    for team in teams:
        new_cash = team['cash'] + req.amount
        supabase.table("teams").update({"cash": new_cash}).eq("code", team['code']).execute()
    return {"status": "success", "count": len(teams)}

# --- STANDARD MANAGEMENT ---
@app.post("/admin/add-team")
def add_team(req: ManageTeamRequest):
    supabase.table("teams").insert({"code": req.team_code, "cash": 1500, "carbon_debt": 0, "last_action_round": 0}).execute()
    return {"status": "success"}

@app.post("/admin/remove-team")
def remove_team(req: ManageTeamRequest):
    supabase.table("teams").delete().eq("code", req.team_code).execute()
    return {"status": "success"}

@app.post("/admin/toggle-lock")
def toggle_lock(req: ManageTeamRequest):
    res = supabase.table("teams").select("last_action_round").eq("code", req.team_code).single().execute()
    new_val = 0 if res.data['last_action_round'] > 0 else 999
    supabase.table("teams").update({"last_action_round": new_val}).eq("code", req.team_code).execute()
    return {"status": "success"}

@app.post("/admin/broadcast")
def send_broadcast(req: BroadcastRequest):
    supabase.table("config").update({"value": req.message}).eq("key", "system_message").execute()
    return {"status": "success"}

@app.post("/admin/reset-game")
def reset_game_full():
    supabase.table("teams").update({"cash": 1500, "carbon_debt": 0, "inventory_choice": "None", "last_action_round": 0}).neq("code", "placeholder").execute()
    supabase.table("config").update({"value": "1"}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    supabase.table("config").update({"value": "Welcome!"}).eq("key", "system_message").execute()
    return {"status": "success"}