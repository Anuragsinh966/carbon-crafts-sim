import streamlit as st
from utils import sheets_helper, game_logic

def show():
    st.title("🌍 Global Market Dashboard")
    
    if st.button("🔄 Refresh Board"):
        sheets_helper.get_all_teams.clear()
        st.rerun()

    # Load Data
    df = sheets_helper.get_all_teams()
    config = sheets_helper.get_game_state()

    # Banner
    if config['active_event'] != "None":
        st.error(f"🚨 SCENARIO ACTIVE: {config['active_event']}")
    else:
        st.success("✅ Market Conditions: Stable")

    if not df.empty:
        df['Eco-Score'] = df.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
        
        # Display Top 3
        top = df.sort_values('Eco-Score', ascending=False).head(3)
        c1, c2, c3 = st.columns(3)
        if len(top) > 0: c1.metric("🥇 1st", top.iloc[0]['TeamID'], f"{int(top.iloc[0]['Eco-Score'])}")
        if len(top) > 1: c2.metric("🥈 2nd", top.iloc[1]['TeamID'], f"{int(top.iloc[1]['Eco-Score'])}")
        if len(top) > 2: c3.metric("🥉 3rd", top.iloc[2]['TeamID'], f"{int(top.iloc[2]['Eco-Score'])}")

        st.dataframe(df[['TeamID', 'Cash', 'CarbonDebt', 'Eco-Score']].sort_values('Eco-Score', ascending=False), use_container_width=True)