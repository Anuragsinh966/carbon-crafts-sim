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

if not url or not key:
    print("❌ Error: Missing .env file or keys")

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

class BroadcastRequest(BaseModel):
    message: str

# --- ROUTES ---

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/calculate-round")
def calculate_round(request: RoundRequest):
    print(f"⚡ CALCULATING ROUND with event: {request.event_name}")
    response = supabase.table("teams").select("*").execute()
    updated_count = 0
    logs = []

    for team in response.data:
        choice = team.get("inventory_choice", "None")
        if choice and choice != "None":
            # 1. Calculate Outcome
            team_adapter = {'Cash': team['cash'], 'CarbonDebt': team['carbon_debt']}
            profit, debt_change, msg = game_logic.calculate_outcome(team_adapter, choice, request.event_name)
            
            # 2. Update Database (Deduct Cash/Update Debt)
            supabase.table("teams").update({
                "cash": int(team['cash'] + profit),
                "carbon_debt": int(team['carbon_debt'] + debt_change),
                "last_action_round": 999  # Lock them for this round
            }).eq("code", team['code']).execute()
            
            updated_count += 1
            logs.append(f"{team['code']}: {msg}")

    return {"status": "success", "updated": updated_count}

@app.post("/start-new-year")
def start_new_year():
    print("⏭️ STARTING NEW YEAR")
    # Reset Choices
    supabase.table("teams").update({"inventory_choice": "None"}).neq("code", "placeholder").execute()
    
    # Increment Round
    config_res = supabase.table("config").select("*").eq("key", "current_round").single().execute()
    new_round = int(config_res.data['value']) + 1
    
    supabase.table("config").update({"value": str(new_round)}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    
    return {"status": "success", "round": new_round}

# --- TEAM MANAGEMENT API ---

@app.post("/admin/add-team")
def add_team(req: ManageTeamRequest):
    """Creates a new team with default stats."""
    print(f"➕ Adding Team: {req.team_code}")
    supabase.table("teams").insert({
        "code": req.team_code,
        "cash": 1500,
        "carbon_debt": 0,
        "inventory_choice": "None",
        "last_action_round": 0
    }).execute()
    return {"status": "success"}

@app.post("/admin/remove-team")
def remove_team(req: ManageTeamRequest):
    """Deletes a team permanently."""
    print(f"❌ Removing Team: {req.team_code}")
    supabase.table("teams").delete().eq("code", req.team_code).execute()
    return {"status": "success"}

@app.post("/admin/toggle-lock")
def toggle_lock(req: ManageTeamRequest):
    """Locks or Unlocks a specific team."""
    # Check current status
    res = supabase.table("teams").select("last_action_round").eq("code", req.team_code).single().execute()
    current_val = res.data['last_action_round']
    
    # Toggle (If > 0, set to 0 to unlock. If 0, set to 999 to lock)
    new_val = 0 if current_val > 0 else 999
    
    supabase.table("teams").update({"last_action_round": new_val}).eq("code", req.team_code).execute()
    return {"status": "success", "locked": new_val > 0}

@app.post("/admin/broadcast")
def send_broadcast(req: BroadcastRequest):
    supabase.table("config").update({"value": req.message}).eq("key", "system_message").execute()
    return {"status": "success"}

@app.post("/admin/reset-game")
def reset_game_full():
    print("♻️ FACTORY RESET")
    supabase.table("teams").update({
        "cash": 1500, "carbon_debt": 0, "inventory_choice": "None", "last_action_round": 0
    }).neq("code", "placeholder").execute()
    
    supabase.table("config").update({"value": "1"}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    supabase.table("config").update({"value": "Welcome!"}).eq("key", "system_message").execute()
    return {"status": "success"}