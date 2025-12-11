import streamlit as st
from utils import sheets_helper, game_logic
import time

def show(team_id):
    # 1. FETCH DATA (With Cache)
    team = sheets_helper.get_team_data(team_id)
    config = sheets_helper.get_game_state()

    if not team:
        st.error("Team not found.")
        return

    # 2. MOBILE HEADER & STATS
    st.title(f"🏢 {team_id}")
    
    # Metrics
    c1, c2, c3 = st.columns(3)
    c1.metric("💵 Cash", f"${team['Cash']}")
    c2.metric("☁️ Debt", f"{team['CarbonDebt']}")
    score = game_logic.calculate_final_score(team['Cash'], team['CarbonDebt'])
    c3.metric("🏆 Score", f"{int(score)}")

    # Visual Progress Bar
    sus_rating = max(0, min(100, 100 - team['CarbonDebt']))
    st.caption(f"Sustainability Rating: {sus_rating}/100")
    st.progress(sus_rating / 100)
    
    st.divider()

    # 3. GAME PHASE
    current_round = int(config['current_round'])
    last_action = int(team['LastActionRound'])
    
    # Pop-up Notification
    if config['active_event'] != "None":
        st.toast(f"📢 NEWS: {config['active_event']}", icon="🚨")

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