from backend_engine import game_logic
import streamlit as st
import pandas as pd
import random
import time
from utils import sheets_helper

def show():
    # --- SIDEBAR CONTROLS ---
    st.sidebar.header("⚙️ Game Settings")
    
    # 1. THE SYNC FIX: Auto-Refresh Toggle
    auto_refresh = st.sidebar.toggle("🔴 LIVE SYNC MODE", value=False)
    if auto_refresh:
        time.sleep(3) # Wait 3 seconds
        st.rerun()    # Force reload data
    
    # 2. View Mode (Admin vs Projector)
    view_mode = st.sidebar.radio("View Mode", ["Control Panel", "Projector (Big Screen)"])

    # --- FETCH FRESH DATA ---
    # This runs every time the app refreshes
    config = sheets_helper.get_game_state()
    df = sheets_helper.get_all_teams()
    
    # Calculate Scores
    if not df.empty:
        df['Score'] = df.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)

    # ==========================================
    # VIEW A: PROJECTOR (For the Big Screen)
    # ==========================================
    if view_mode == "Projector (Big Screen)":
        st.title("🌍 Carbon Crafts Live Market")
        
        # Big Event Banner
        active_event = config.get('active_event', 'None')
        if active_event != 'None':
            st.error(f"🚨 ACTIVE EVENT: {active_event}")
        else:
            st.success("✅ Market Stable")
            
        st.divider()
        
        # Big Leaderboard
        if not df.empty:
            top_3 = df.sort_values('Score', ascending=False).head(3)
            c1, c2, c3 = st.columns(3)
            
            if len(top_3) > 0: c1.metric("🥇 1st Place", top_3.iloc[0]['TeamID'], f"{int(top_3.iloc[0]['Score'])}")
            if len(top_3) > 1: c2.metric("🥈 2nd Place", top_3.iloc[1]['TeamID'], f"{int(top_3.iloc[1]['Score'])}")
            if len(top_3) > 2: c3.metric("🥉 3rd Place", top_3.iloc[2]['TeamID'], f"{int(top_3.iloc[2]['Score'])}")
        
        return # Stop here for projector mode

    # ==========================================
    # VIEW B: CONTROL PANEL (For You)
    # ==========================================
    st.title("🚀 Mission Control")
    
    tab1, tab2, tab3 = st.tabs(["🎮 Game Flow", "📊 Live Data", "⚡ God Mode"])

    # --- TAB 1: RUN THE GAME ---
    with tab1:
        curr_round = int(config.get('current_round', 1))
        active_event = config.get('active_event', 'None')
        
        # Status
        c1, c2 = st.columns(2)
        c1.metric("Current Year", curr_round)
        c2.metric("Active Event", active_event)
        
        st.divider()
        
        # Controls
        col_a, col_b = st.columns(2)
        
        with col_a:
            st.subheader("1. Events")
            ev_list = ["The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough", "The Greenwashing Crackdown"]
            selected_event = st.selectbox("Choose Event", ev_list)
            
            if st.button("🎲 Deploy Event"):
                sheets_helper.update_config("active_event", selected_event)
                st.toast(f"Deployed {selected_event}!")
                st.rerun()
                
            if st.button("🚫 Clear Event"):
                sheets_helper.update_config("active_event", "None")
                st.rerun()

        with col_b:
            st.subheader("2. Round End")
            if st.button("⚡ CALCULATE RESULTS", type="primary"):
                with st.status("Processing..."):
                    count = 0
                    for idx, row in df.iterrows():
                        choice = row.get('InventoryChoice', 'None')
                        if choice and choice != 'None':
                            profit, debt_change, msg = game_logic.calculate_outcome(row, choice, active_event)
                            new_c = int(row['Cash'] + profit)
                            new_d = int(row['CarbonDebt'] + debt_change)
                            sheets_helper.update_team_stat(row['TeamID'], 'cash', new_c)
                            sheets_helper.update_team_stat(row['TeamID'], 'carbon_debt', new_d)
                            count += 1
                    st.success(f"Processed {count} teams!")
                    time.sleep(1)
                    st.rerun()

            if st.button("⏭️ START NEXT YEAR"):
                sheets_helper.start_new_round(curr_round + 1)
                st.rerun()

    # --- TAB 2: LIVE DATA ---
    with tab2:
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.caption(f"Last Updated: {time.strftime('%H:%M:%S')}")

    # --- TAB 3: GOD MODE ---
    with tab3:
        st.warning("Manual Overrides")
        target_team = st.selectbox("Select Team", df['TeamID'].unique()) if not df.empty else None
        
        if target_team:
            curr_data = df[df['TeamID'] == target_team].iloc[0]
            new_cash = st.number_input("Cash", value=int(curr_data['Cash']))
            new_debt = st.number_input("Debt", value=int(curr_data['CarbonDebt']))
            
            if st.button("Save Changes"):
                sheets_helper.update_team_stat(target_team, 'cash', new_cash)
                sheets_helper.update_team_stat(target_team, 'carbon_debt', new_debt)
                st.success("Updated!")
                st.rerun()