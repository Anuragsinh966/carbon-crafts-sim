import streamlit as st
import pandas as pd
from utils import sheets_helper, game_logic

def show():
    st.title("👨‍💼 Game Master HQ")
    
    # 1. CONTROLS
    config = sheets_helper.get_game_state()
    
    with st.expander("⚙️ Game Controls", expanded=True):
        c1, c2 = st.columns(2)
        
        # Set Round
        with c1:
            new_round = st.number_input("Current Year", value=int(config['current_round']), min_value=1, max_value=3)
            if st.button("Update Year"):
                sheets_helper.update_config("current_round", new_round)
                st.success(f"Moved to Year {new_round}")

        # Set Event
        with c2:
            events = ["None", "The Carbon Tax", "The Viral Expose", "The Economic Recession", "The Tech Breakthrough"]
            # Find current index safely
            curr_idx = 0
            if config['active_event'] in events:
                curr_idx = events.index(config['active_event'])
                
            selected_event = st.selectbox("Trigger Event", events, index=curr_idx)
            if st.button("DEPLOY EVENT"):
                sheets_helper.update_config("active_event", selected_event)
                st.success(f"Deployed: {selected_event}")

    # 2. LEADERBOARD
    if st.button("Refresh Board"):
        st.rerun()

    df = sheets_helper.get_all_teams()
    # Add Score Column
    df['Score'] = df.apply(lambda x: game_logic.calculate_score(x['Cash'], x['CarbonDebt']), axis=1)
    
    st.dataframe(df[['TeamID', 'Cash', 'CarbonDebt', 'Score', 'LastActionRound']].sort_values('Score', ascending=False))

    # 3. CALCULATE RESULTS
    st.divider()
    st.write("⚠️ **End of Year Processing** (Click once per round)")
    
    if st.button("CALCULATE RESULTS"):
        with st.spinner("Crunching numbers..."):
            # Fetch all decisions
            sh = sheets_helper.connect_to_sheets()
            ws_dec = sh.worksheet("Decisions")
            decisions = pd.DataFrame(ws_dec.get_all_records())
            
            # Filter for current round
            current_decs = decisions[decisions['Round'] == config['current_round']]
            
            logs = []
            
            for idx, row in df.iterrows():
                team_id = row['TeamID']
                # Find their decision
                my_dec = current_decs[current_decs['TeamID'] == team_id]
                
                if not my_dec.empty:
                    choice = my_dec.iloc[0]['SupplierChoice']
                    profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config['active_event'])
                    
                    new_cash = row['Cash'] + profit
                    new_debt = row['CarbonDebt'] + debt_change
                    
                    # Update DB
                    sheets_helper.update_team_stats(team_id, new_cash, new_debt)
                    logs.append(f"{team_id}: {msg}")
            
            st.success("Calculation Complete!")
            st.json(logs)