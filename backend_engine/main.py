from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import pandas as pd
import game_logic

# 1. SETUP
load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ Error: Missing .env file or keys")

supabase: Client = create_client(url, key)
app = FastAPI()

# 2. CORS (Security)
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
    cash_change: int
    debt_change: int

class BroadcastRequest(BaseModel):
    message: str

# --- ROUTES ---

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/calculate-round")
def calculate_round(request: RoundRequest):
    print(f"⚡ Calculation requested: {request.event_name}")
    response = supabase.table("teams").select("*").execute()
    updated_count = 0
    logs = []

    for team in response.data:
        choice = team.get("inventory_choice", "None")
        if choice and choice != "None":
            # Map DB columns to logic adapter
            team_adapter = {'Cash': team['cash'], 'CarbonDebt': team['carbon_debt']}
            
            # Run Math
            profit, debt_change, msg = game_logic.calculate_outcome(team_adapter, choice, request.event_name)
            
            # Update DB
            supabase.table("teams").update({
                "cash": int(team['cash'] + profit),
                "carbon_debt": int(team['carbon_debt'] + debt_change)
            }).eq("code", team['code']).execute()
            
            updated_count += 1
            logs.append(f"{team['code']}: {msg}")

    return {"status": "success", "updated": updated_count}

@app.post("/start-new-year")
def start_new_year():
    print("⏭️ Starting Next Year")
    # Reset Choices
    supabase.table("teams").update({"inventory_choice": "None"}).neq("code", "placeholder").execute()
    
    # Increment Round
    config_res = supabase.table("config").select("*").eq("key", "current_round").single().execute()
    new_round = int(config_res.data['value']) + 1
    
    supabase.table("config").update({"value": str(new_round)}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    
    return {"status": "success", "round": new_round}

# --- NEW ADVANCED FEATURES ---

@app.post("/admin/update-team")
def update_team_manual(req: TeamUpdate):
    """Manually add/remove cash or debt from a specific team."""
    print(f"🛠️ Manual Update: {req.team_code} | Cash: {req.cash_change}")
    
    # Get current values
    res = supabase.table("teams").select("*").eq("code", req.team_code).single().execute()
    team = res.data
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    new_cash = team['cash'] + req.cash_change
    new_debt = team['carbon_debt'] + req.debt_change
    
    supabase.table("teams").update({
        "cash": new_cash,
        "carbon_debt": new_debt
    }).eq("code", req.team_code).execute()
    
    return {"status": "success", "new_cash": new_cash}

@app.post("/admin/broadcast")
def send_broadcast(req: BroadcastRequest):
    """Updates the global system message for students."""
    supabase.table("config").update({"value": req.message}).eq("key", "system_message").execute()
    return {"status": "success"}

@app.post("/admin/reset-game")
def reset_game_full():
    """⚠️ DANGER: Resets the entire game to start."""
    print("♻️ FACTORY RESET")
    
    # Reset Teams
    supabase.table("teams").update({
        "cash": 1500,
        "carbon_debt": 0,
        "inventory_choice": "None",
        "last_action_round": 0
    }).neq("code", "placeholder").execute()
    
    # Reset Config
    supabase.table("config").update({"value": "1"}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    supabase.table("config").update({"value": "Welcome!"}).eq("key", "system_message").execute()
    
    return {"status": "success"}