import streamlit as st
from utils import sheets_helper, game_logic

def show():
    st.title("🌍 Global Market Dashboard")
    st.caption("Live Data Feed (Supabase)")

    # FIX: We removed sheets_helper.get_all_teams.clear() because Supabase is real-time.
    # We just need to rerun the app to fetch new data.
    if st.button("🔄 Refresh Board"):
        st.rerun()

    # Load Data
    df = sheets_helper.get_all_teams()
    config = sheets_helper.get_game_state()

    # Big Event Banner
    active_event = config.get('active_event', 'None')
    if active_event != "None":
        st.error(f"🚨 ACTIVE SCENARIO: {active_event}")
    else:
        st.info("✅ Market Conditions: Stable")

    # Leaderboard Logic
    if not df.empty:
        # Calculate Scores
        df['Eco-Score'] = df.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
        
        # Display Top 3 Winners
        top_teams = df.sort_values('Eco-Score', ascending=False).head(3)
        
        c1, c2, c3 = st.columns(3)
        if len(top_teams) >= 1:
            c1.metric("🥇 1st Place", top_teams.iloc[0]['TeamID'], f"{int(top_teams.iloc[0]['Eco-Score'])}")
        if len(top_teams) >= 2:
            c2.metric("🥈 2nd Place", top_teams.iloc[1]['TeamID'], f"{int(top_teams.iloc[1]['Eco-Score'])}")
        if len(top_teams) >= 3:
            c3.metric("🥉 3rd Place", top_teams.iloc[2]['TeamID'], f"{int(top_teams.iloc[2]['Eco-Score'])}")

        st.divider()
        
        # Full Table
        st.dataframe(
            df[['TeamID', 'Cash', 'CarbonDebt', 'Eco-Score', 'LastActionRound']].sort_values('Eco-Score', ascending=False),
            use_container_width=True,
            hide_index=True
        )