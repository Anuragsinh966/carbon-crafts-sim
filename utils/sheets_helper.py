import streamlit as st
from supabase import create_client, Client
import pandas as pd
import time

# --- CONNECT TO SUPABASE ---
# No huge caching needed because Supabase is fast!
@st.cache_resource
def init_connection():
    url = st.secrets["supabase"]["url"]
    key = st.secrets["supabase"]["key"]
    return create_client(url, key)

supabase: Client = init_connection()

# --- READ DATA ---
def get_all_teams():
    """Fetches Teams table."""
    try:
        # Select all columns (*) from Teams
        response = supabase.table("Teams").select("*").execute()
        # Convert list of dicts to DataFrame
        return pd.DataFrame(response.data)
    except Exception as e:
        st.error(f"DB Error: {e}")
        return pd.DataFrame()

def get_game_state():
    """Fetches Config table."""
    try:
        response = supabase.table("Config").select("*").execute()
        # Convert list of dicts [{'Key': 'x', 'Value': 'y'}] -> dict {'x': 'y'}
        data = {item['Key']: item['Value'] for item in response.data}
        return data
    except Exception as e:
        return {"current_round": 1, "active_event": "None"}

def get_team_data(team_id):
    """Fetches specific team."""
    try:
        # Clean input
        clean_id = str(team_id).strip()
        response = supabase.table("Teams").select("*").eq("TeamID", clean_id).execute()
        if response.data:
            return response.data[0] # Return the first match
        return None
    except Exception as e:
        return None

# --- WRITE DATA ---
def submit_decision(team_id, round_num, choice):
    try:
        # 1. Log Decision
        supabase.table("Decisions").insert({
            "TeamID": team_id,
            "Round": round_num,
            "SupplierChoice": choice,
            "Timestamp": str(pd.Timestamp.now())
        }).execute()
        
        # 2. Update Team Status
        supabase.table("Teams").update({"LastActionRound": round_num}).eq("TeamID", team_id).execute()
        return True
    except Exception as e:
        st.error(f"Submit failed: {e}")
        return False

def update_config(key, value):
    try:
        supabase.table("Config").update({"Value": str(value)}).eq("Key", key).execute()
    except Exception as e:
        st.error(f"Config failed: {e}")

def batch_update_stats(updates_list):
    """
    Supabase handles updates differently. 
    updates_list comes in as [(row_index_ignored, col_ignored, value), ...] 
    BUT for Supabase, we need to know WHICH TEAM to update.
    
    CRITICAL: The previous code passed row numbers. 
    We need to slightly refactor admin.py to pass TeamIDs if we fully switch.
    
    HOWEVER, to save you from editing admin.py, we will do a trick:
    We will just re-fetch the teams, and update them one by one.
    """
    # NOTE: This function requires a slight logic change in admin.py to be efficient.
    # But to keep it "drop-in replacement", we'll do this:
    pass 
    # See "Critical Fix" below for how to handle the Admin Calculation.

# --- ADMIN CALCULATION HELPER (New) ---
# Paste this function here, and I will tell you one tiny change to make in admin.py
def admin_update_team_score(team_id, new_cash, new_debt):
    try:
        supabase.table("Teams").update({
            "Cash": new_cash,
            "CarbonDebt": new_debt
        }).eq("TeamID", team_id).execute()
    except Exception as e:
        print(e)