import streamlit as st
import pandas as pd
import random
from utils import sheets_helper, game_logic

def show():
    st.title("👨‍💼 Game Master HQ")
    
    # 1. CONTROLS
    config = sheets_helper.get_game_state()
    
    # --- 1. EVENT CONTROL ---
    st.subheader("1. Global Events")
    c1, c2 = st.columns([3, 1])
    with c1:
        st.info(f"Active: **{config['active_event']}**")
    with c2:
        if st.button("🎲 Random Event"):
            evs = ["The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough"]
            new_ev = random.choice(evs)
            sheets_helper.update_config("active_event", new_ev)
            st.rerun()
            
    if st.button("🔴 Clear Event"):
        sheets_helper.update_config("active_event", "None")
        st.rerun()

    # --- 2. ROUND CONTROL ---
    st.subheader("2. Round Management")
    c1, c2 = st.columns(2)
    with c1:
        new_round = st.number_input("Year", value=int(config['current_round']), min_value=1)
        if st.button("Update Year"):
            sheets_helper.update_config("current_round", new_round)
            st.success("Updated!")
    with c2:
        st.write("End of Year:")
        if st.button("⚡ CALCULATE RESULTS"):
            run_calculations(config)

    # --- 3. LEADERBOARD ---
    st.subheader("3. Live Data")
    if st.button("🔄 Refresh"):
        sheets_helper.get_all_teams.clear()
        st.rerun()

    df = sheets_helper.get_all_teams()
    # Add Score Column
    df['Score'] = df.apply(lambda x: game_logic.calculate_score(x['Cash'], x['CarbonDebt']), axis=1)
    
    st.dataframe(df[['TeamID', 'Cash', 'CarbonDebt', 'Score', 'LastActionRound']].sort_values('Score', ascending=False))

def run_calculations(config):
    with st.status("Processing..."):
        sh = sheets_helper.connect_to_sheets()
        decisions = pd.DataFrame(sh.worksheet("Decisions").get_all_records())
        df_teams = sheets_helper.get_all_teams()
        
        current_decs = decisions[decisions['Round'] == config['current_round']]
        updates = []
        
        for idx, row in df_teams.iterrows():
            team_id = row['TeamID']
            my_dec = current_decs[current_decs['TeamID'] == team_id]
            
            if not my_dec.empty:
                choice = my_dec.iloc[0]['SupplierChoice']
                profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config['active_event'])
                
                # Append update (Row, Col, Value) - Sheet rows start at 2
                sheet_row = idx + 2
                updates.append((sheet_row, 3, int(row['Cash'] + profit)))
                updates.append((sheet_row, 4, int(row['CarbonDebt'] + debt_change)))
        
        sheets_helper.batch_update_stats(updates)
        st.success("Done!")