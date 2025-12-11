import streamlit as st
import pandas as pd
import random
from utils import sheets_helper, game_logic

def show():
    st.title("👨‍💼 Game Master HQ")
    
    # Fetch Data Once
    config = sheets_helper.get_game_state()
    df_teams = sheets_helper.get_all_teams()
    
    # --- UPDATE: Added "📜 Activity Log" to the tabs list ---
    tab1, tab2, tab3, tab4 = st.tabs(["🎮 Game Flow", "💰 Auction & God Mode", "⚙️ System", "📜 Activity Log"])

    # --- TAB 1: RUNNING THE GAME ---
    with tab1:
        st.subheader("1. Global Scenario Control")
        c1, c2 = st.columns([3, 1])
        with c1:
            st.info(f"📢 Active Event: **{config.get('active_event', 'None')}**")
        with c2:
            if st.button("🎲 Random Event"):
                evs = ["The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough", "The Greenwashing Crackdown"]
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
            new_round = st.number_input("Current Year", value=curr, min_value=1)
            if st.button("Update Year"):
                sheets_helper.update_config("current_round", new_round)
                st.success("Updated!")
        with c2:
            st.write("End of Year Processing")
            if st.button("⚡ CALCULATE RESULTS"):
                run_calculations(config)
        
        st.divider()
        
        st.subheader("3. Live Leaderboard")
        if st.button("🔄 Refresh Board"):
            st.rerun()
            
        if not df_teams.empty:
            df_teams['Score'] = df_teams.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
            st.dataframe(df_teams[['TeamID', 'Cash', 'CarbonDebt', 'Score', 'LastActionRound']].sort_values('Score', ascending=False), use_container_width=True)

    # --- TAB 2: MANUAL CONTROLS ---
    with tab2:
        st.header("🛠️ Manual Interventions")
        
        if df_teams.empty:
            st.warning("No teams found.")
        else:
            selected_team = st.selectbox("Select Team to Edit", df_teams['TeamID'].unique())
            
            st.subheader("A. Auction / Fine Manager")
            c1, c2 = st.columns(2)
            cash_adj = c1.number_input("Cash Adjustment (+/-)", value=0, step=100)
            debt_adj = c2.number_input("Debt Adjustment (+/-)", value=0, step=1)
            
            if st.button("Apply Adjustment"):
                if sheets_helper.admin_adjust_team(selected_team, cash_adj, debt_adj):
                    st.success(f"Updated {selected_team} successfully!")
                    st.rerun()

            st.divider()
            
            st.subheader("B. Unlock Stuck Team")
            if st.button(f"🔓 Unlock {selected_team}"):
                sheets_helper.admin_unlock_team(selected_team)
                st.success(f"{selected_team} unlocked!")

    # --- TAB 3: SYSTEM RESET ---
    with tab3:
        st.header("⚠️ Danger Zone")
        if st.button("♻️ RESET ALL TEAMS TO YEAR 1"):
            st.session_state['confirm_reset'] = True
            
        if st.session_state.get('confirm_reset'):
            st.warning("Are you sure? This deletes all progress.")
            if st.button("YES, NUKE EVERYTHING"):
                sheets_helper.update_config("current_round", 1)
                sheets_helper.update_config("active_event", "None")
                # Reset all teams
                for t in df_teams['TeamID']:
                    sheets_helper.admin_unlock_team(t)
                st.success("Game Reset Complete!")
                st.session_state['confirm_reset'] = False

    # --- TAB 4: ACTIVITY LOG (NEW FEATURE) ---
    with tab4:
        st.header("📜 Activity Log")
        st.caption("Real-time history of all student decisions.")
        
        if st.button("🔄 Refresh Log"):
            st.rerun()
            
        try:
            # Fetch raw decisions table from Supabase
            response = sheets_helper.supabase.table("Decisions").select("*").order("Timestamp", desc=True).execute()
            df_log = pd.DataFrame(response.data)
            
            if not df_log.empty:
                st.dataframe(
                    df_log[['Timestamp', 'TeamID', 'Round', 'SupplierChoice']], 
                    use_container_width=True
                )
            else:
                st.info("No decisions recorded yet.")
        except Exception as e:
            st.error(f"Could not load logs: {e}")

def run_calculations(config):
    with st.status("Processing Database...", expanded=True) as status:
        response = sheets_helper.supabase.table("Decisions").select("*").execute()
        decisions = pd.DataFrame(response.data)
        df_teams = sheets_helper.get_all_teams()
        
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
                
                sheets_helper.admin_update_team_score(team_id, new_cash, new_debt)
                updates_count += 1
        
        status.update(label=f"Complete! Updated {updates_count} teams.", state="complete")