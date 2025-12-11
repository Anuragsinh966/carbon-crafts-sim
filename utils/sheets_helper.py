import streamlit as st
from supabase import create_client, Client
import pandas as pd

# --- CONNECT TO SUPABASE ---
@st.cache_resource
def init_connection():
    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["key"]
        return create_client(url, key)
    except Exception as e:
        st.error(f"❌ Supabase Connection Failed: {e}")
        st.stop()

supabase: Client = init_connection()

# --- READ DATA ---
def get_all_teams():
    """Fetches Teams and normalizes column names and types."""
    try:
        response = supabase.table("Teams").select("*").execute()
        df = pd.DataFrame(response.data)
        
        if not df.empty:
            # 1. Rename columns to match our code (Title Case)
            df.columns = [c.lower() for c in df.columns] 
            rename_map = {
                'teamid': 'TeamID',
                'password': 'Password',
                'cash': 'Cash',
                'carbondebt': 'CarbonDebt',
                'lastactionround': 'LastActionRound'
            }
            df = df.rename(columns=rename_map)

            # 2. FIX: FORCE NUMBERS (This prevents the TypeError)
            # errors='coerce' turns bad text into 0. fillna(0) ensures no empty slots.
            df['Cash'] = pd.to_numeric(df['Cash'], errors='coerce').fillna(0).astype(int)
            df['CarbonDebt'] = pd.to_numeric(df['CarbonDebt'], errors='coerce').fillna(0).astype(int)
            df['LastActionRound'] = pd.to_numeric(df['LastActionRound'], errors='coerce').fillna(0).astype(int)
            
        return df
    except Exception as e:
        # If the database connection completely fails, return an empty table
        return pd.DataFrame()

def get_game_state():
    try:
        response = supabase.table("Config").select("*").execute()
        data = {item['Key']: item['Value'] for item in response.data}
        return data
    except:
        return {"current_round": 1, "active_event": "None"}

def get_team_data(team_id):
    df = get_all_teams()
    if df.empty: return None
    
    clean_id = str(team_id).strip()
    # Case-insensitive search
    team = df[df['TeamID'].str.lower() == clean_id.lower()]
    
    if not team.empty:
        return team.iloc[0].to_dict()
    return None

# --- WRITE DATA ---
def submit_decision(team_id, round_num, choice):
    try:
        # Supabase requires exact column names as defined in the database
        supabase.table("Decisions").insert({
            "TeamID": team_id,
            "Round": round_num,
            "SupplierChoice": choice,
            "Timestamp": str(pd.Timestamp.now())
        }).execute()
        
        # Update Team
        supabase.table("Teams").update({"LastActionRound": round_num}).eq("TeamID", team_id).execute()
        return True
    except Exception as e:
        st.error(f"Submit Error: {e}")
        return False

def update_config(key, value):
    try:
        supabase.table("Config").update({"Value": str(value)}).eq("Key", key).execute()
    except Exception as e:
        st.error(f"Config Error: {e}")

def admin_update_team_score(team_id, new_cash, new_debt):
    try:
        supabase.table("Teams").update({
            "Cash": new_cash,
            "CarbonDebt": new_debt
        }).eq("TeamID", team_id).execute()
    except Exception as e:
        st.error(f"Update Failed: {e}")