import streamlit as st
from utils import sheets_helper, game_logic
import time

def show(team_id):
    # 1. FETCH DATA
    team = sheets_helper.get_team_data(team_id)
    config = sheets_helper.get_game_state()

    # --- DEBUGGING FIX START ---
    if not team:
        st.error(f"❌ Error: The team ID '{team_id}' was not found in the database.")
        
        # Show what IS in the database to help debug
        st.warning("👇 Here are the valid Team IDs currently in your database:")
        all_teams_df = sheets_helper.get_all_teams()
        if not all_teams_df.empty:
            # Show the list of valid IDs as simple tags
            valid_ids = all_teams_df['TeamID'].tolist()
            st.code(valid_ids)
            st.info("💡 Tip: Copy one of these exact names, log out, and try again.")
        else:
            st.error("⚠️ The database appears to be empty! Go to Supabase and add rows to the 'Teams' table.")
            
        if st.sidebar.button("⬅️ Logout to Fix"):
            st.session_state['logged_in'] = False
            st.rerun()
        return
    # --- DEBUGGING FIX END ---

    # 2. MOBILE HEADER & STATS
    st.title(f"🏢 {team_id}")
    
    # Metrics
    c1, c2, c3 = st.columns(3)
    c1.metric("💵 Cash", f"${team.get('Cash', 0)}")
    c2.metric("☁️ Debt", f"{team.get('CarbonDebt', 0)}")
    
    score = game_logic.calculate_final_score(team.get('Cash', 0), team.get('CarbonDebt', 0))
    c3.metric("🏆 Score", f"{int(score)}")

    # Visual Progress Bar
    current_debt = team.get('CarbonDebt', 0)
    sus_rating = max(0, min(100, 100 - current_debt))
    st.caption(f"Sustainability Rating: {sus_rating}/100")
    st.progress(sus_rating / 100)
    
    st.divider()

    # 3. GAME PHASE
    current_round = int(config.get('current_round', 1))
    last_action = int(team.get('LastActionRound', 0))
    
    # Pop-up Notification
    active_event = config.get('active_event', 'None')
    if active_event != "None":
        st.toast(f"📢 NEWS: {active_event}", icon="🚨")

    st.header(f"📅 Year {current_round}")

    if last_action >= current_round:
        # WAITING SCREEN
        st.success("✅ Decisions Locked In.")
        st.info("Waiting for market results...")
        if st.button("🔄 Refresh Status", use_container_width=True):
            st.rerun()
            
    else:
        # ACTION SCREEN (Big Buttons)
        st.write("Select Strategy:")
        c1, c2, c3 = st.columns(3)
        
        with c1:
            st.error("Tier C")
            st.caption("$500 | +3 Debt")
            if st.button("BUY DIRTY", use_container_width=True):
                sheets_helper.submit_decision(team_id, current_round, "Tier C (Dirty)")
                st.toast("Submitted!", icon="✅")
                time.sleep(1)
                st.rerun()

        with c2:
            st.warning("Tier B")
            st.caption("$800 | +1 Debt")
            if st.button("BUY STD", use_container_width=True):
                sheets_helper.submit_decision(team_id, current_round, "Tier B (Standard)")
                st.toast("Submitted!", icon="✅")
                time.sleep(1)
                st.rerun()

        with c3:
            st.success("Tier A")
            st.caption("$1200 | -1 Debt")
            if st.button("BUY ECO", use_container_width=True):
                sheets_helper.submit_decision(team_id, current_round, "Tier A (Ethical)")
                st.toast("Submitted!", icon="✅")
                time.sleep(1)
                st.rerun()