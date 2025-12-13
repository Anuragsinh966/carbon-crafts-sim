import streamlit as st
import pandas as pd
import random
from utils import sheets_helper, game_logic

def show():
    st.title("👨‍💼 Game Master HQ")
    
    config = sheets_helper.get_game_state()
    df_teams = sheets_helper.get_all_teams()
    
    tab1, tab2, tab3, tab4 = st.tabs(["🎮 Game Flow", "💰 Auction", "⚙️ System", "📜 Activity Log"])

    # --- TAB 1: GAME FLOW ---
    with tab1:
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

        st.divider()

        st.subheader("2. Round Management")
        c1, c2 = st.columns(2)
        with c1:
            curr = int(config.get('current_round', 1))
            new_round = st.number_input("Year", value=curr, min_value=1)
            if st.button("Update Year"):
                sheets_helper.update_config("current_round", new_round)
                st.success("Updated!")
        with c2:
            st.write("End of Year:")
            if st.button("⚡ CALCULATE RESULTS"):
                run_calculations(config)

        st.divider()
        st.subheader("3. Leaderboard")
        if st.button("🔄 Refresh"):
            st.rerun()
            
        if not df_teams.empty:
            df_teams['Score'] = df_teams.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
            st.dataframe(df_teams[['TeamID', 'Cash', 'CarbonDebt', 'Score', 'LastActionRound']].sort_values('Score', ascending=False), use_container_width=True)

    # --- TAB 2: AUCTION ---
    with tab2:
        st.header("🛠️ Manual Controls")
        if not df_teams.empty:
            selected = st.selectbox("Select Team", df_teams['TeamID'].unique())
            c1, c2 = st.columns(2)
            cash = c1.number_input("Cash (+/-)", 0, step=100)
            debt = c2.number_input("Debt (+/-)", 0, step=1)
            
            if st.button("Apply"):
                sheets_helper.admin_adjust_team(selected, cash, debt)
                st.success("Updated!")
                st.rerun()
                
            if st.button(f"🔓 Unlock {selected}"):
                sheets_helper.admin_unlock_team(selected)
                st.success("Unlocked!")

    # --- TAB 3: SYSTEM ---
    with tab3:
        st.error("⚠️ Danger Zone")
        if st.button("♻️ RESET GAME"):
            sheets_helper.update_config("current_round", 1)
            sheets_helper.update_config("active_event", "None")
            for t in df_teams['TeamID']:
                sheets_helper.admin_unlock_team(t)
            st.success("Reset Complete.")

    # --- TAB 4: LOGS ---
    with tab4:
        st.header("📜 Logs")
        if st.button("Refresh Log"): st.rerun()
        
        try:
            res = sheets_helper.supabase.table("master_log").select("*").order("timestamp", desc=True).execute()
            st.dataframe(pd.DataFrame(res.data), use_container_width=True)
        except:
            st.write("No logs yet.")

def run_calculations(config):
    with st.status("Processing Database...", expanded=True) as status:
        # 1. Fetch Logs from 'master_log'
        response = sheets_helper.supabase.table("master_log").select("*").execute()
        logs = pd.DataFrame(response.data)
        
        # 2. Filter for current round strategy buys
        curr_round = int(config.get('current_round', 1))
        
        # We need to extract the "choice" from the JSON column "details"
        # This is the critical fix: The database stores {"choice": "Tier C"} inside 'details'
        current_decs = pd.DataFrame()
        
        if not logs.empty:
            # Filter first
            mask = (logs['round'] == curr_round) & (logs['action_type'] == 'strategy_buy')
            filtered_logs = logs[mask].copy()
            
            if not filtered_logs.empty:
                # Helper function to extract choice safely
                def extract_choice(row):
                    details = row.get('details')
                    if isinstance(details, dict):
                        return details.get('choice')
                    # Handle case where Supabase returns JSON string
                    if isinstance(details, str):
                        try:
                            import json
                            return json.loads(details).get('choice')
                        except:
                            return None
                    return None

                filtered_logs['SupplierChoice'] = filtered_logs.apply(extract_choice, axis=1)
                current_decs = filtered_logs

        # 3. Apply Calculations
        df_teams = sheets_helper.get_all_teams()
        updates_count = 0
        
        for idx, row in df_teams.iterrows():
            team_id = row['TeamID']
            
            # Find decision for this team
            if not current_decs.empty:
                # Note: 'team_id' in logs is snake_case because it comes raw from DB
                my_dec = current_decs[current_decs['team_id'] == team_id]
                
                if not my_dec.empty:
                    choice = my_dec.iloc[0]['SupplierChoice']
                    
                    if choice:
                        # Calculate outcome
                        profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config.get('active_event'))
                        
                        # Apply math
                        new_cash = int(row['Cash'] + profit)
                        new_debt = int(row['CarbonDebt'] + debt_change)
                        
                        # Update Database
                        sheets_helper.admin_update_team_score(team_id, new_cash, new_debt)
                        updates_count += 1
        
        status.update(label=f"Complete! Updated {updates_count} teams.", state="complete")
    with st.status("Processing...", expanded=True) as status:
        # Fetch Logs
        res = sheets_helper.supabase.table("master_log").select("*").execute()
        logs = pd.DataFrame(res.data)
        
        # Filter for current round strategy buys
        curr = int(config.get('current_round', 1))
        
        # Extract choices from JSON
        valid_logs = []
        if not logs.empty:
            valid_logs = logs[(logs['round'] == curr) & (logs['action_type'] == 'strategy_buy')]
        
        df_teams = sheets_helper.get_all_teams()
        count = 0
        
        for idx, row in df_teams.iterrows():
            team_id = row['TeamID']
            
            # Find choice for this team
            if not valid_logs.empty:
                my_log = valid_logs[valid_logs['team_id'] == team_id]
                if not my_log.empty:
                    # Extract from JSON details
                    details = my_log.iloc[0]['details']
                    choice = details.get('choice') if isinstance(details, dict) else None
                    
                    if choice:
                        profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config.get('active_event'))
                        new_c = int(row['Cash'] + profit)
                        new_d = int(row['CarbonDebt'] + debt_change)
                        sheets_helper.admin_update_team_score(team_id, new_c, new_d)
                        count += 1
                        
        status.update(label=f"Done! Updated {count} teams.", state="complete")