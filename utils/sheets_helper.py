import streamlit as st
from supabase import create_client, Client
import pandas as pd
import json

# --- CONNECT TO SUPABASE ---
@st.cache_resource
def init_connection():
    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["key"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"❌ Connection Error: {e}")
        st.stop()

supabase: Client = init_connection()

# --- READ DATA (THE FIX IS HERE) ---
def get_all_teams():
    """Fetches teams and maps Supabase 'code' column to App 'TeamID'."""
    try:
        # 1. Fetch data from 'teams' table
        response = supabase.table("teams").select("*").execute()
        df = pd.DataFrame(response.data)
        
        if not df.empty:
            # 2. DEBUG: Print columns to terminal (Optional, helps you see what's happening)
            # print("Raw Columns from DB:", df.columns)

            # 3. RENAME: Map Supabase columns -> App columns
            # Your DB has 'code', 'carbon_debt', etc.
            rename_map = {
                'code': 'TeamID',           # THIS IS THE CRITICAL FIX
                'name': 'TeamName',
                'carbon_debt': 'CarbonDebt',
                'last_action_round': 'LastActionRound',
                'cash': 'Cash',
                'password': 'Password'
            }
            df = df.rename(columns=rename_map)
            
            # 4. SAFETY: Force numbers to be integers
            for col in ['Cash', 'CarbonDebt', 'LastActionRound']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
            
        return df
    except Exception as e:
        st.error(f"Database Read Error: {e}") # Show actual error instead of generic message
        return pd.DataFrame()

def get_game_state():
    try:
        response = supabase.table("config").select("*").execute()
        return {item['key']: item['value'] for item in response.data}
    except:
        return {"current_round": 1, "active_event": "None"}

def get_team_data(team_id):
    """Fetches specific team by their ID."""
    df = get_all_teams()
    if df.empty: return None
    
    clean_id = str(team_id).strip().lower()
    
    # Look for the team in the 'TeamID' column (which we just renamed from 'code')
    if 'TeamID' in df.columns:
        team = df[df['TeamID'].str.lower() == clean_id]
        if not team.empty:
            return team.iloc[0].to_dict()
            
    return None

# --- WRITE DATA ---
def submit_decision(team_id, round_num, choice):
    try:
        log_entry = {
            "team_id": team_id,
            "round": round_num,
            "action_type": "strategy_buy",
            "details": {"choice": choice} 
        }
        supabase.table("master_log").insert(log_entry).execute()
        # Update using 'code' because that is the actual DB column name
        supabase.table("teams").update({"last_action_round": round_num}).eq("code", team_id).execute()
        return True
    except Exception as e:
        st.error(f"Submit Error: {e}")
        return False

def update_config(key, value):
    try:
        supabase.table("config").update({"value": str(value)}).eq("key", key).execute()
    except Exception as e:
        st.error(f"Config Error: {e}")

def admin_update_team_score(team_id, new_cash, new_debt):
    try:
        supabase.table("teams").update({
            "cash": new_cash,
            "carbon_debt": new_debt
        }).eq("code", team_id).execute()
    except Exception as e:
        st.error(f"Update Failed: {e}")

def admin_adjust_team(team_id, cash_change, debt_change):
    try:
        team = get_team_data(team_id)
        if not team: return False
        
        new_cash = team['Cash'] + int(cash_change)
        new_debt = team['CarbonDebt'] + int(debt_change)
        
        admin_update_team_score(team_id, new_cash, new_debt)
        return True
    except:
        return False

def admin_unlock_team(team_id):
    try:
        supabase.table("teams").update({"last_action_round": 0}).eq("code", team_id).execute()
        return True
    except:
        return False