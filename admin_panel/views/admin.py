import streamlit as st
import pandas as pd
import random
from utils import sheets_helper, game_logic

def show():
    st.header("🎛️ Game Control Panel")
    
    # Load Fresh Data
    config = sheets_helper.get_game_state()
    df_teams = sheets_helper.get_all_teams()
    
    # Tabs for organization
    tab1, tab2 = st.tabs(["🎮 Round Management", "📊 Live Leaderboard"])

    # --- TAB 1: RUN THE GAME ---
    with tab1:
        # 1. Status Bar
        current_r = int(config.get('current_round', 1))
        st.info(f"📅 **YEAR {current_r}** | 🌪️ Active Event: **{config.get('active_event', 'None')}**")
        
        col1, col2 = st.columns(2)
        
        # 2. Event Controls
        with col1:
            st.subheader("1. Trigger Event")
            if st.button("🎲 Draw Random Event", use_container_width=True):
                evs = ["The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough", "The Greenwashing Crackdown"]
                sheets_helper.update_config("active_event", random.choice(evs))
                st.rerun()
                
        # 3. Calculation Controls
        with col2:
            st.subheader("2. End Year")
            if st.button("⚡ CALCULATE RESULTS", type="primary", use_container_width=True):
                process_round_results(df_teams, config)
                st.success("Calculations Complete!")
                st.rerun()

            if st.button("⏭️ START NEXT YEAR", use_container_width=True):
                sheets_helper.start_new_round(current_r + 1)
                st.rerun()

    # --- TAB 2: VIEW DATA ---
    with tab2:
        if not df_teams.empty:
            # Show live calculation of score
            df_teams['Score'] = df_teams.apply(lambda x: game_logic.calculate_final_score(x['Cash'], x['CarbonDebt']), axis=1)
            
            # Show clean table
            st.dataframe(
                df_teams[['TeamID', 'Cash', 'CarbonDebt', 'InventoryChoice', 'Score']], 
                use_container_width=True,
                hide_index=True
            )

# --- LOGIC FUNCTION ---
def process_round_results(df, config):
    """
    Loops through every team. 
    If they bought something (InventoryChoice is not None), calculate impact.
    """
    active_event = config.get('active_event', 'None')
    count = 0
    
    progress_text = "Processing teams..."
    my_bar = st.progress(0, text=progress_text)
    
    total_teams = len(df)
    
    for idx, row in df.iterrows():
        team_id = row['TeamID']
        choice = row.get('InventoryChoice', 'None')
        
        # Logic: Only process if they made a choice and haven't been processed yet 
        # (You can add a 'processed' flag to DB if you want strict safety, but this works for simple flows)
        if choice and choice != 'None':
            # Use the Brain (game_logic.py)
            profit, debt_change, msg = game_logic.calculate_outcome(row, choice, active_event)
            
            new_cash = int(row['Cash'] + profit)
            new_debt = int(row['CarbonDebt'] + debt_change)
            
            # Save to DB
            sheets_helper.admin_update_team_score(team_id, new_cash, new_debt)
            count += 1
            
        # Update Progress Bar
        my_bar.progress((idx + 1) / total_teams, text=f"Processing {team_id}...")
            
    my_bar.empty()
    st.toast(f"Updated {count} teams successfully!", icon="✅")