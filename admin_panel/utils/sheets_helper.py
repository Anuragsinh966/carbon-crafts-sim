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

# --- READ ---
def get_all_teams():
    response = supabase.table("teams").select("*").order("code", desc=False).execute()
    df = pd.DataFrame(response.data)
    if not df.empty:
        # Map DB columns to Friendly Names
        rename_map = {
            'code': 'TeamID',
            'name': 'TeamName',
            'carbon_debt': 'CarbonDebt',
            'last_action_round': 'LastActionRound',
            'cash': 'Cash',
            'inventory_choice': 'InventoryChoice',
            'assets': 'Assets'
        }
        df = df.rename(columns=rename_map)
    return df

def get_game_state():
    response = supabase.table("config").select("*").execute()
    # Convert list of rows to a simple dictionary: {'current_round': '1', ...}
    return {item['key']: item['value'] for item in response.data}

# --- WRITE (POWER FEATURES) ---
def update_config(key, value):
    supabase.table("config").update({"value": str(value)}).eq("key", key).execute()

def update_team_stat(team_id, field, value):
    """GOD MODE: Updates a specific field for a specific team."""
    # Map friendly name back to DB column if needed, or just pass direct
    db_field = field.lower()
    if field == 'TeamID': db_field = 'code'
    if field == 'CarbonDebt': db_field = 'carbon_debt'
    
    supabase.table("teams").update({db_field: value}).eq("code", team_id).execute()

def broadcast_message(msg):
    """Sends a message to all student devices via the config table."""
    update_config("system_message", msg)

def start_new_round(next_round):
    # 1. Reset Choices
    supabase.table("teams").update({"inventory_choice": "None"}).neq("code", "placeholder").execute()
    # 2. Update Round
    update_config("current_round", next_round)
    # 3. Clear Event
    update_config("active_event", "None")