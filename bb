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

# ---  THE HELPER FUNCTION  ---
def log_transaction(team_code: str, round_num: int, action: str, details: str):
    """Saves an event to the Master Log."""
    try:
        supabase.table("master_log").insert({
            "team_id": team_code,
            "round": round_num,
            "action_type": action,
            "details": {"msg": details}
        }).execute()
    except Exception as e:
        print(f"⚠️ Log Error: {e}")

# --- DATA MODELS ---

class TeamInfoUpdate(BaseModel):
    team_code: str
    username: str
    password: str
    members: str

class RoundRequest(BaseModel):
    event_name: str

class TeamUpdate(BaseModel):
    team_code: str
    cash_change: int = 0
    debt_change: int = 0

class ManageTeamRequest(BaseModel):
    team_code: str
    username: str = None
    password: str = None
    members: str = None

class GlobalActionRequest(BaseModel):
    amount: int = 0

class BroadcastRequest(BaseModel):
    message: str

class TeamStatUpdate(BaseModel):
    team_code: str
    cash_change: int
    debt_change: int

class AuctionGrantRequest(BaseModel):
    team_code: str
    item_name: str
    price: int
    debt_reduction: int
class CreateCodeRequest(BaseModel):
    code: str
    team_id: str
    item_name: str
    price: int
    debt_reduction: int
class CreateCodeRequest(BaseModel):
    code: str
    team_id: str
    item_name: str
    price: int
    debt_reduction: int
class DeleteCatalogRequest(BaseModel):
    item_id: str    

# --- DYNAMIC CATALOG & REVOKE ---

class CatalogItem(BaseModel):
    category: str # 'supplier' or 'auction'
    name: str
    description: str
    cost: int
    debt_effect: int

class RevokeRequest(BaseModel):
    team_code: str
    asset_name: str

# --- ROUTES ---

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/calculate-round")
def calculate_round(request: RoundRequest):
    print(f"\n⚡ STARTING CALCULATION: {request.event_name}")
    
    # 1. Fetch Data
    teams = supabase.table("teams").select("*").execute().data
    catalog_items = supabase.table("catalog").select("*").execute().data
    
    # 2. Create Lookup Map
    catalog_map = {item['name']: item for item in catalog_items}
    
    updated_count = 0
    logs = []

    for team in teams:
        choice = team.get("inventory_choice", "None")
        team_code = team['code']
        
        # SKIP if no choice made
        if choice == "None":
            continue
            
        # SAFETY: If item was deleted from catalog, skip math to prevent crash
        if choice not in catalog_map:
            print(f"   -> ⚠️ Skipping {team_code}: Item '{choice}' not in catalog.")
            continue

        # 3. Get Base Stats (For Reference Only)
        item_data = catalog_map[choice]
        base_cost = item_data['cost']
        base_debt = item_data['debt_effect']
        
        # 4. Math Logic (UPDATED FOR INSTANT PAY)
        # We start at 0 because they ALREADY PAID in the app.
        cash_change = 0 
        debt_change = 0 
        msg = f"Processed {choice}"

        # --- DYNAMIC EVENT LOGIC ---
        
        if request.event_name == "The Carbon Tax":
            # Rule: Tax based on TOTAL CURRENT DEBT
            current_total_debt = team['carbon_debt']
            tax = current_total_debt * 10 
            cash_change -= tax
            msg += f" (Taxed -${tax})"
            
        elif request.event_name == "The Economic Recession":
            # Rule: Items were 20% cheaper. Refund them the difference!
            # Example: Bought for 1000. Should be 800. Refund 200.
            discount = int(base_cost * 0.20)
            cash_change += discount 
            # But sales were bad, flat penalty
            cash_change -= 200      
            msg += f" (Recession Adjustment: +${discount}, Sales Lost -$200)"
            
        elif request.event_name == "The Tech Breakthrough":
            # Rule: If Green Item (negative debt), Refund 50% of cost
            if base_debt < 0:
                discount = int(base_cost * 0.50)
                cash_change += discount
                msg += f" (Green Tech Rebate: +${discount})"

        elif request.event_name == "The Viral Expose":
            # Rule: High Debt Fine
            if team['carbon_debt'] > 20:
                cash_change -= 300
                msg += " (Scandal Fine: -$300)"

        # 5. Update Database
        # Only apply the EVENT changes here
        new_cash = team['cash'] + cash_change
        new_debt = max(0, team['carbon_debt'] + debt_change)
        
        supabase.table("teams").update({
            "cash": new_cash,
            "carbon_debt": new_debt,
            "last_action_round": 999
        }).eq("code", team_code).execute()

        # --- NEW: LOGGING ---
        log_transaction(team_code, current_round, "ROUND_CALC", msg)
        # --------------------
        
        updated_count += 1
        logs.append(f"[{team_code}] {msg}")

    return {"status": "success", "updated": updated_count, "logs": logs}
    print(f"\n⚡ STARTING CALCULATION: {request.event_name}")
    
    # 1. Fetch Data
    teams = supabase.table("teams").select("*").execute().data
    catalog_items = supabase.table("catalog").select("*").execute().data
    
    # 2. Create Lookup Map
    catalog_map = {item['name']: item for item in catalog_items}
    
    updated_count = 0
    logs = []

    for team in teams:
        choice = team.get("inventory_choice", "None")
        team_code = team['code']
        
        # SKIP LOGIC
        if choice == "None" or choice not in catalog_map:
            if choice != "None":
                print(f"   -> ❌ NAME MISMATCH: '{choice}' not found in Catalog.")
            continue

        # 3. Get Base Stats from Catalog
        item_data = catalog_map[choice]
        base_cost = item_data['cost']
        base_debt = item_data['debt_effect']
        
        # 4. Apply Event Logic
        cash_change = -base_cost
        debt_change = base_debt
        msg = f"Bought {choice}"

        # --- DYNAMIC EVENT LOGIC ---
        
        if request.event_name == "The Carbon Tax":
            # Rule: Pay $10 for every point of Debt you have
            # This is dynamic: Dirty items = High Team Debt = High Tax
            current_total_debt = max(0, team['carbon_debt'] + base_debt)
            tax = current_total_debt * 10 
            cash_change -= tax
            msg += f" (Taxed -${tax})"
            
        elif request.event_name == "The Economic Recession":
            # Rule: Everything is 20% cheaper to buy, BUT you lose $200 in sales
            discount = int(base_cost * 0.20)
            cash_change += discount # Add back 20% (Save money)
            cash_change -= 200      # Lost sales penalty
            msg += f" (Recession: Saved ${discount}, Lost $200 Sales)"
            
        elif request.event_name == "The Tech Breakthrough":
            # Rule: If the item helps the environment (Negative Debt), it's 50% off
            if base_debt < 0:
                discount = int(base_cost * 0.50)
                cash_change += discount
                msg += f" (Green Tech Discount: +${discount})"

        elif request.event_name == "The Viral Expose":
            # Rule: If you have High Debt (>20), you get fined $300
            if (team['carbon_debt'] + base_debt) > 20:
                cash_change -= 300
                msg += " (Viral Scandal Fine: -$300)"

        # 5. Update Database
        new_cash = team['cash'] + cash_change
        new_debt = max(0, team['carbon_debt'] + debt_change)
        
        supabase.table("teams").update({
            "cash": new_cash,
            "carbon_debt": new_debt,
            "last_action_round": 999
        }).eq("code", team_code).execute()
        
        updated_count += 1
        logs.append(f"[{team_code}] {msg}")

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
    """Creates a new team with credentials."""
    print(f"➕ Registering Team: {req.username}")
    supabase.table("teams").insert({
        "code": req.team_code,  # Internal ID
        "username": req.username,
        "password": req.password,
        "members": req.members,
        "cash": 1500,
        "carbon_debt": 0,
        "inventory_choice": "None",
        "last_action_round": 0
    }).execute()
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
    print("♻️ FACTORY RESET")
    # 1. Reset Teams (Clear Cash, Debt, AND Assets)
    supabase.table("teams").update({
        "cash": 1500, 
        "carbon_debt": 0, 
        "inventory_choice": "None", 
        "last_action_round": 0,
        "assets": ""  # <--- FIX: Clear assets string
    }).neq("code", "placeholder").execute()
    
    # 2. Reset Config
    supabase.table("config").update({"value": "1"}).eq("key", "current_round").execute()
    supabase.table("config").update({"value": "None"}).eq("key", "active_event").execute()
    supabase.table("config").update({"value": "Welcome!"}).eq("key", "system_message").execute()
    
    # 3. Clear Claim Codes (Optional: Delete all created LOBBY codes)
    # Note: Supabase-py doesn't support 'truncate', so we delete where ID is not null
    supabase.table("claim_codes").delete().neq("code", "INVALID_CODE").execute()
    
    return {"status": "success"}
# --- NEW: AUCTION CODE SYSTEM ---
class RedeemRequest(BaseModel):
    team_code: str
    secret_code: str

# Define your physical cards here
AUCTION_ITEMS = {
    "SCRUB-1": {"name": "Carbon Scrubber", "cost": 600, "debt_effect": -15},
    "FOREST-X": {"name": "Reforestation Deed", "cost": 400, "debt_effect": -10},
    "SOLAR-V":  {"name": "Solar Array", "cost": 800, "debt_effect": -20},
}

@app.post("/redeem-code")
def redeem_code(req: RedeemRequest):
    secret = req.secret_code.upper()
    team_code = req.team_code

    # 1. CHECK DATABASE (Secure Codes)
    db_code = supabase.table("claim_codes").select("*").eq("code", secret).maybe_single().execute()

    item_to_buy = None

    if db_code.data:
        # Found a secure code! Validate it.
        record = db_code.data

        if record['is_used']:
            raise HTTPException(status_code=400, detail="Code already used!")

        if record['team_id'] != team_code:
            raise HTTPException(status_code=400, detail="This code is not for your team!")

        # Prepare item data from DB
        item_to_buy = {
            "name": record['item_name'], 
            "cost": record['price'], 
            "debt_effect": record['debt_reduction'],
            "is_db_code": True # Flag to mark as DB code
        }

    else:
        # 2. CHECK LEGACY DICTIONARY (Global Codes)
        # (Keep your old AUCTION_ITEMS list here for backup)
        legacy_item = AUCTION_ITEMS.get(secret)
        if legacy_item:
            item_to_buy = legacy_item
        else:
            raise HTTPException(status_code=400, detail="Invalid Code")

    # 3. EXECUTE PURCHASE (Common Logic)
    res = supabase.table("teams").select("*").eq("code", team_code).single().execute()
    team = res.data

    if team['cash'] < item_to_buy['cost']:
        raise HTTPException(status_code=400, detail=f"Need ${item_to_buy['cost']}!")

    # Check if already owned
    current_assets = team.get('assets') or ""
    if item_to_buy['name'] in current_assets:
         raise HTTPException(status_code=400, detail="Already owned!")

    new_assets = f"{current_assets},{item_to_buy['name']}".strip(",")

    # Update Team
    supabase.table("teams").update({
        "cash": team['cash'] - item_to_buy['cost'],
        "assets": new_assets,
        "carbon_debt": max(0, team['carbon_debt'] + item_to_buy['debt_effect']) 
    }).eq("code", team_code).execute()

    # 4. MARK AS USED (If it was a DB code)
    if item_to_buy.get("is_db_code"):
        supabase.table("claim_codes").update({"is_used": True}).eq("code", secret).execute()

     # --- NEW: LOGGING ---
    try:
        current_round = supabase.table("config").select("value").eq("key", "current_round").single().execute().data['value']
        log_transaction(team_code, int(current_round), "REDEEM_CODE", f"Redeemed {item_to_buy['name']}")
    except: pass
    # --------------------   

    return {"status": "success", "item": item_to_buy['name']} 
@app.post("/admin/update-team-stats")
def update_team_stats(req: TeamStatUpdate):
    """Manually modifies a team's stats."""
    # 1. Get current stats
    res = supabase.table("teams").select("*").eq("code", req.team_code).single().execute()
    team = res.data
    
    if not team:
        return {"status": "error", "message": "Team not found"}

    # 2. Calculate new values
    new_cash = team['cash'] + req.cash_change
    new_debt = max(0, team['carbon_debt'] + req.debt_change) # Prevent negative debt

    # 3. Save to DB
    supabase.table("teams").update({
        "cash": new_cash,
        "carbon_debt": new_debt
    }).eq("code", req.team_code).execute()

    # --- NEW: LOGGING ---
    try:
        current_round = supabase.table("config").select("value").eq("key", "current_round").single().execute().data['value']
        log_transaction(req.team_code, int(current_round), "ADMIN_EDIT", f"Manual: Cash {req.cash_change}, Debt {req.debt_change}")
    except: pass # Don't crash if logging fails
    # --------------------
    
    return {"status": "success", "new_cash": new_cash}
@app.post("/admin/update-team-info")
def update_team_info(req: TeamInfoUpdate):
    """Updates team credentials."""
    supabase.table("teams").update({
        "username": req.username,
        "password": req.password,
        "members": req.members
    }).eq("code", req.team_code).execute()
    return {"status": "success"}
@app.post("/admin/grant-auction-item")
def grant_auction_item(req: AuctionGrantRequest):
    """Admin manually gives an item at a specific auction price."""
    # 1. Get current team data
    res = supabase.table("teams").select("*").eq("code", req.team_code).single().execute()
    team = res.data
    
    if not team:
        return {"status": "error", "message": "Team not found"}

    # 2. Update Asset String
    current_assets = team.get('assets') or ""
    new_assets = f"{current_assets},{req.item_name}".strip(",")

    # 3. Deduct Cash & Reduce Debt immediately
    supabase.table("teams").update({
        "cash": team['cash'] - req.price,  # Deduct the BID PRICE, not default
        "carbon_debt": max(0, team['carbon_debt'] + req.debt_reduction),
        "assets": new_assets
    }).eq("code", req.team_code).execute()

   @app.post("/admin/grant-auction-item")
def grant_auction_item(req: AuctionGrantRequest):
    """Admin manually gives an item at a specific auction price."""
    res = supabase.table("teams").select("*").eq("code", req.team_code).single().execute()
    team = res.data
    
    if not team:
        return {"status": "error", "message": "Team not found"}

    current_assets = team.get('assets') or ""
    new_assets = f"{current_assets},{req.item_name}".strip(",")

    supabase.table("teams").update({
        "cash": team['cash'] - req.price,
        "carbon_debt": max(0, team['carbon_debt'] + req.debt_reduction),
        "assets": new_assets
    }).eq("code", req.team_code).execute()
    
    # --- NEW: LOGGING ---
    try:
        current_round = supabase.table("config").select("value").eq("key", "current_round").single().execute().data['value']
        log_transaction(req.team_code, int(current_round), "AUCTION_WIN", f"Won {req.item_name} for ${req.price}")
    except: pass
    # --------------------
    
    return {"status": "success", "deducted": req.price} 
    
    return {"status": "success", "deducted": req.price}
@app.post("/admin/create-code")
def create_claim_code(req: CreateCodeRequest):
    """Generates a secure, one-time code for a specific team."""
    try:
        supabase.table("claim_codes").insert({
            "code": req.code.upper(),
            "team_id": req.team_id,
            "item_name": req.item_name,
            "price": req.price,
            "debt_reduction": req.debt_reduction,
            "is_used": False
        }).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
# --- DYNAMIC CATALOG & REVOKE ---

@app.get("/catalog")
def get_catalog():
    """Fetches all buyable items for the Frontend."""
    return supabase.table("catalog").select("*").execute().data

@app.post("/admin/add-catalog-item")
def add_catalog_item(req: CatalogItem):
    """Admin adds a new button to the game."""
    supabase.table("catalog").insert(req.dict()).execute()
    return {"status": "success"}

@app.post("/admin/revoke-asset")
def revoke_asset(req: RevokeRequest):
    """Removes a specific item from a team's asset list."""
    res = supabase.table("teams").select("assets").eq("code", req.team_code).single().execute()
    if not res.data: return {"status": "error"}
    
    # Logic: Convert "A,B,C" -> List -> Remove B -> "A,C"
    current_list = [x for x in res.data['assets'].split(',') if x]
    if req.asset_name in current_list:
        current_list.remove(req.asset_name)
    
    new_assets = ",".join(current_list)
    
    supabase.table("teams").update({"assets": new_assets}).eq("code", req.team_code).execute()
    return {"status": "success"}
@app.post("/admin/delete-catalog-item")
def delete_catalog_item(req: DeleteCatalogRequest):
    """Permanently removes an item from the shop."""
    supabase.table("catalog").delete().eq("id", req.item_id).execute()
    return {"status": "success"}
@app.post("/admin/reset-single-team")
def reset_single_team(req: ManageTeamRequest):
    """Resets a single team to starting stats (Year 1 state)."""
    print(f"♻️ RESETTING TEAM: {req.team_code}")
    
    # Reset values to defaults: Cash 1500, Debt 0, No Inventory, No Assets
    supabase.table("teams").update({
        "cash": 1500,
        "carbon_debt": 0,
        "inventory_choice": "None",
        "last_action_round": 0,
        "assets": "" # Clears their inventory
    }).eq("code", req.team_code).execute()
    
    return {"status": "success", "message": f"{req.team_code} reset successfully"}
@app.get("/admin/logs")
def get_master_logs():
    """Fetches the history of all transactions."""
    # Fetch last 100 logs, ordered by newest first
    return supabase.table("master_log").select("*").order("timestamp", desc=True).limit(100).execute().data