import streamlit as st
from supabase import create_client, Client
import pandas as pd

# --- CONNECT ---
@st.cache_resource
def init_connection():
    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["key"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"Connection Error: {e}")
        st.stop()

supabase: Client = init_connection()

# --- READ DATA ---
def get_all_teams():
    """Reads all teams and normalizes column names for the app."""
    response = supabase.table("teams").select("*").order("code", desc=False).execute()
    df = pd.DataFrame(response.data)
    
    if not df.empty:
        # Standardize column names for game_logic.py
        rename_map = {
            'code': 'TeamID',
            'name': 'TeamName',
            'carbon_debt': 'CarbonDebt',
            'last_action_round': 'LastActionRound',
            'cash': 'Cash',
            'inventory_choice': 'InventoryChoice' # Crucial for new logic
        }
        df = df.rename(columns=rename_map)
    return df

def get_game_state():
    response = supabase.table("config").select("*").execute()
    return {item['key']: item['value'] for item in response.data}

# --- WRITE DATA (ADMIN ONLY) ---
def update_config(key, value):
    supabase.table("config").update({"value": str(value)}).eq("key", key).execute()

def admin_update_team_score(team_id, new_cash, new_debt):
    supabase.table("teams").update({
        "cash": int(new_cash),
        "carbon_debt": int(new_debt)
    }).eq("code", team_id).execute()

# --- RESET FUNCTION (NEW!) ---
def start_new_round(next_round_number):
    """
    1. Clears everyone's 'InventoryChoice' so they can buy again.
    2. Updates the 'current_round' number.
    3. Clears the 'active_event'.
    """
    # Clear choices
    supabase.table("teams").update({"inventory_choice": "None"}).neq("code", "placeholder").execute()
    
    # Update Config
    update_config("current_round", next_round_number)
    update_config("active_event", "None")