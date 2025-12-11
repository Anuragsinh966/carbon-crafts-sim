import streamlit as st
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
import time

# --- CONNECT TO GOOGLE SHEETS (Cached) ---
@st.cache_resource
def connect_to_sheets():
    """Connects to Google Sheets using secrets.toml credentials."""
    try:
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds_dict = dict(st.secrets["gcp_service_account"])
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)
        sheet_name = st.secrets["sheets"]["sheet_name"]
        return client.open(sheet_name)
    except Exception as e:
        st.error(f"❌ Database Connection Error: {e}")
        st.stop()

# --- READ DATA (Smart Caching) ---
# ttl=10 means "Wait 10 seconds before asking Google again" to save API quota
@st.cache_data(ttl=10)
def get_all_teams():
    try:
        sh = connect_to_sheets()
        ws = sh.worksheet("Teams")
        data = ws.get_all_records()
        return pd.DataFrame(data)
    except Exception as e:
        # Use st.warning sparingly to avoid UI clutter during loads
        return pd.DataFrame()

@st.cache_data(ttl=10)
def get_game_state():
    try:
        sh = connect_to_sheets()
        ws = sh.worksheet("Config")
        data = ws.get_all_records()
        return {row['Key']: row['Value'] for row in data}
    except Exception as e:
        return {"current_round": 1, "active_event": "None"}

def get_team_data(team_id):
    """Gets data for one specific team."""
    df = get_all_teams()
    if df.empty: return None
    team = df[df['TeamID'] == team_id]
    if not team.empty:
        return team.iloc[0].to_dict()
    return None

# --- WRITE DATA ---
def submit_decision(team_id, round_num, choice):
    """Logs decision with retry protection."""
    sh = connect_to_sheets()
    try:
        # 1. Log Decision
        ws_log = sh.worksheet("Decisions")
        ws_log.append_row([team_id, round_num, choice, str(pd.Timestamp.now())])
        
        # 2. Update Team Status
        ws_teams = sh.worksheet("Teams")
        cell = ws_teams.find(team_id)
        if cell:
            ws_teams.update_cell(cell.row, 6, round_num)
        
        # Clear cache so the user sees the update immediately
        get_all_teams.clear() 
        return True
    except Exception as e:
        st.error(f"Failed to submit: {e}. Please try again.")
        return False

def update_config(key, value):
    sh = connect_to_sheets()
    try:
        ws = sh.worksheet("Config")
        cell = ws.find(key)
        ws.update_cell(cell.row, 2, value)
        get_game_state.clear() # Clear cache
    except Exception as e:
        st.error(f"Config Update Failed: {e}")

def batch_update_stats(updates_list):
    """
    Updates list: [(row_num, col_num, value), ...]
    Safe slow update loop to prevent API errors.
    """
    sh = connect_to_sheets()
    ws = sh.worksheet("Teams")
    
    if not updates_list:
        return

    progress_bar = st.progress(0)
    total = len(updates_list)
    
    for i, (row, col, val) in enumerate(updates_list):
        try:
            ws.update_cell(row, col, val)
            progress_bar.progress((i + 1) / total)
            time.sleep(0.5) # Sleep to be nice to Google API
        except Exception:
            time.sleep(2) # Wait longer if error
            try:
                ws.update_cell(row, col, val)
            except:
                pass # Skip if it fails twice to prevent crash
    
    get_all_teams.clear()