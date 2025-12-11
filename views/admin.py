import streamlit as st
import pandas as pd
import random
from utils import sheets_helper, game_logic

def show():
    st.title("👨‍💼 Game Master HQ (Supabase)")
    
    config = sheets_helper.get_game_state()
    
    # --- 1. EVENTS ---
    st.subheader("1. Global Events")
    c1, c2 = st.columns([3, 1])
    with c1:
        st.info(f"Active: **{config.get('active_event', 'None')}**")
    with c2:
        if st.button("🎲 Random Event"):
            evs = ["The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough"]
            sheets_helper.update_config("active_event", random.choice(evs))
            st.rerun()
            
    if st.button("🔴 Clear Event"):
        sheets_helper.update_config("active_event", "None")
        st.rerun()

    # --- 2. ROUNDS ---
    st.subheader("2. Round Management")
    c1, c2 = st.columns(2)
    with c1:
        # Ensure current_round is integer
        curr = int(config.get('current_round', 1))
        new_round = st.number_input("Year", value=curr, min_value=1)
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
        st.rerun()
        
    df = sheets_helper.get_all_teams()
    if not df.empty:
        # Calculate Score using 'calculate_final_score'
        df['Score'] = df.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
        st.dataframe(df[['TeamID', 'Cash', 'CarbonDebt', 'Score', 'LastActionRound']].sort_values('Score', ascending=False))

def run_calculations(config):
    with st.status("Processing Database...", expanded=True) as status:
        # 1. Fetch Decisions Manually
        response = sheets_helper.supabase.table("Decisions").select("*").execute()
        decisions = pd.DataFrame(response.data)
        
        # 2. Fetch Teams
        df_teams = sheets_helper.get_all_teams()
        
        # Filter for current round
        curr_round = int(config.get('current_round', 1))
        current_decs = decisions[decisions['Round'] == curr_round]
        
        updates_count = 0
        
        for idx, row in df_teams.iterrows():
            team_id = row['TeamID']
            my_dec = current_decs[current_decs['TeamID'] == team_id]
            
            if not my_dec.empty:
                choice = my_dec.iloc[0]['SupplierChoice']
                profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config.get('active_event'))
                
                new_cash = int(row['Cash'] + profit)
                new_debt = int(row['CarbonDebt'] + debt_change)
                
                # Update Supabase
                sheets_helper.admin_update_team_score(team_id, new_cash, new_debt)
                updates_count += 1
        
        status.update(label=f"Complete! Updated {updates_count} teams.", state="complete")