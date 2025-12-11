import streamlit as st
from utils import sheets_helper, game_logic

def show(team_id):
    # 1. FETCH DATA
    team = sheets_helper.get_team_data(team_id)
    config = sheets_helper.get_game_state()

    if not team:
        st.error("Team not found in database.")
        return

    # 2. SIDEBAR STATS
    st.sidebar.title(f"🏢 {team_id}")
    st.sidebar.metric("💵 Cash", f"${team['Cash']}")
    st.sidebar.metric("☁️ Carbon Debt", f"{team['CarbonDebt']}")
    
    current_score = game_logic.calculate_score(team['Cash'], team['CarbonDebt'])
    st.sidebar.metric("🏆 Eco-Score", f"{int(current_score)}")
    
    if st.sidebar.button("🔄 Refresh"):
        st.rerun()

    # 3. MAIN DASHBOARD
    st.header(f"📅 Year {config['current_round']}")

    # Check if they already played this round
    if int(team['LastActionRound']) >= int(config['current_round']):
        # --- WAITING SCREEN ---
        st.info("✅ Strategy Submitted. Waiting for market results...")
        
        if config['active_event'] != "None":
            st.warning(f"📢 BREAKING NEWS: {config['active_event']}")
            st.write("Check your sidebar to see how this affected your cash.")
    
    else:
        # --- DECISION SCREEN ---
        st.write("Select your Supply Chain Strategy for this year:")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.error("🏭 Tier C (Dirty)")
            st.write("**Cost:** $500 | **Risk:** High")
            if st.button("Select Tier C", use_container_width=True):
                sheets_helper.submit_decision(team_id, config['current_round'], "Tier C (Dirty)")
                st.success("Submitted!")
                st.rerun()

        with col2:
            st.warning("🏢 Tier B (Standard)")
            st.write("**Cost:** $800 | **Risk:** Med")
            if st.button("Select Tier B", use_container_width=True):
                sheets_helper.submit_decision(team_id, config['current_round'], "Tier B (Standard)")
                st.success("Submitted!")
                st.rerun()

        with col3:
            st.success("♻️ Tier A (Ethical)")
            st.write("**Cost:** $1200 | **Risk:** Low")
            if st.button("Select Tier A", use_container_width=True):
                sheets_helper.submit_decision(team_id, config['current_round'], "Tier A (Ethical)")
                st.success("Submitted!")
                st.rerun()