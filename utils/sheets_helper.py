import streamlit as st
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
import time

# --- CONNECT TO GOOGLE SHEETS ---
def connect_to_sheets():
    """Connects to Google Sheets using secrets.toml credentials."""
    try:
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        # Load credentials from .streamlit/secrets.toml
        creds_dict = dict(st.secrets["gcp_service_account"])
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)
        sheet_name = st.secrets["sheets"]["sheet_name"]
        return client.open(sheet_name)
    except Exception as e:
        st.error(f"❌ Database Connection Error: {e}")
        st.stop()

# --- READ DATA ---
def get_all_teams():
    """Returns the 'Teams' tab as a DataFrame."""
    sh = connect_to_sheets()
    ws = sh.worksheet("Teams")
    data = ws.get_all_records()
    return pd.DataFrame(data)

@st.cache_data(ttl=10)
def get_game_state():
    """Returns the 'Config' tab settings (Round & Event)."""
    sh = connect_to_sheets()
    ws = sh.worksheet("Config")
    data = ws.get_all_records()
    # Convert list of dicts to simple dict: {'current_round': 1, ...}
    return {row['Key']: row['Value'] for row in data}

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
    """Logs a team's decision and locks them for the round."""
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
    """Updates a global setting (Admin only)."""
    sh = connect_to_sheets()
    ws = sh.worksheet("Config")
    cell = ws.find(key)
    if cell:
        # Column 2 is the Value column
        ws.update_cell(cell.row, 2, value)
        get_game_state.clear() # Clear cache
    except Exception as e:
        st.error(f"Config Update Failed: {e}")

def update_team_stats(team_id, new_cash, new_debt):
    """Updates cash and debt after calculation."""
    sh = connect_to_sheets()
    ws = sh.worksheet("Teams")
    cell = ws.find(team_id)
    if cell:
        # Col 3 = Cash, Col 4 = CarbonDebt
        ws.update_cell(cell.row, 3, int(new_cash))
        ws.update_cell(cell.row, 4, int(new_debt))