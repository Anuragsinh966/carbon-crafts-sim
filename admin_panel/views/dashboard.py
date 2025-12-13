import streamlit as st
from utils import sheets_helper, game_logic

def show():
    st.title("🌍 Global Market Dashboard")
    st.caption("Live Data Feed (Supabase)")

    if st.button("🔄 Refresh Board"):
        st.rerun()

    # Load Data
    df = sheets_helper.get_all_teams()
    config = sheets_helper.get_game_state()

    # --- NEW: VISUAL EVENT CARD SYSTEM ---
    active_event = config.get('active_event', 'None')
    
    if active_event != "None":
        # Create a nice visual container
        with st.container():
            col1, col2 = st.columns([1, 4])
            
            with col1:
                # Icon Mapping: Shows a giant emoji based on the event
                icons = {
                    "The Carbon Tax": "⚖️",
                    "The Viral Expose": "📸", 
                    "The Economic Recession": "📉",
                    "The Tech Breakthrough": "🔬",
                    "The Greenwashing Crackdown": "🕵️‍♂️"
                }
                # Default to a megaphone if event not found
                icon = icons.get(active_event, "📢")
                
                # Render giant icon using HTML
                st.markdown(f"<h1 style='text-align: center; font-size: 80px;'>{icon}</h1>", unsafe_allow_html=True)
            
            with col2:
                st.error(f"### ACTIVE SCENARIO: {active_event}")
                
                # Flavor Text: The story behind the event
                flavor_text = {
                    "The Carbon Tax": "The government has imposed fines on pollution! High Debt teams will pay dearly.",
                    "The Viral Expose": "Investigative journalists found dirt in the supply chain! Tier C revenue is crashing.",
                    "The Economic Recession": "Global markets are down. Luxury (Tier A/B) goods are harder to sell.",
                    "The Tech Breakthrough": "New innovation makes Green Tech cheaper! Tier A costs less this year.",
                    "The Greenwashing Crackdown": "Auditors are here! If you have high debt, expect massive fines."
                }
                
                description = flavor_text.get(active_event, "Check your participant dashboard for impact details.")
                st.write(f"**Market Impact:** {description}")
                
    else:
        st.success("✅ Market Conditions: Stable (No Active Events)")
    
    st.divider()

    # --- LEADERBOARD ---
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