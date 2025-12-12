import streamlit as st
from supabase import create_client, Client
import pandas as pd
import json

# --- CONNECT ---
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

# --- READ DATA ---
def get_all_teams():
    """Fetches teams and maps new DB columns to App variable names."""
    try:
        # Select from new 'teams' table
        response = supabase.table("teams").select("*").execute()
        df = pd.DataFrame(response.data)
        
        if not df.empty:
            # Map 'snake_case' DB columns to 'TitleCase' App variables
            rename_map = {
                'code': 'TeamID',          
                'carbon_debt': 'CarbonDebt', 
                'last_action_round': 'LastActionRound',
                'cash': 'Cash',
                'password': 'Password'
            }
            df = df.rename(columns=rename_map)
            
            # Force numbers to be Integers (Fixes TypeError)
            for col in ['Cash', 'CarbonDebt', 'LastActionRound']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
            
        return df
    except Exception as e:
        return pd.DataFrame()

def get_game_state():
    try:
        response = supabase.table("config").select("*").execute()
        return {item['key']: item['value'] for item in response.data}
    except:
        return {"current_round": 1, "active_event": "None"}

def get_team_data(team_id):
    df = get_all_teams()
    if df.empty: return None
    
    clean_id = str(team_id).strip().lower()
    # Look up by TeamID (which comes from the 'code' column)
    team = df[df['TeamID'].str.lower() == clean_id]
    
    if not team.empty:
        return team.iloc[0].to_dict()
    return None

# --- WRITE DATA ---
def submit_decision(team_id, round_num, choice):
    try:
        # Log to 'master_log' using JSON
        log_entry = {
            "team_id": team_id,
            "round": round_num,
            "action_type": "strategy_buy",
            "details": {"choice": choice} 
        }
        supabase.table("master_log").insert(log_entry).execute()
        
        # Update Team using 'code' column
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