def run_calculations(config):
    with st.status("Processing Market Data...", expanded=True) as status:
        # Get all data
        df_teams = sheets_helper.get_all_teams()
        
        # Fetch decisions table manually to filter
        response = sheets_helper.supabase.table("Decisions").select("*").execute()
        decisions = pd.DataFrame(response.data)
        
        current_decs = decisions[decisions['Round'] == int(config['current_round'])]
        
        progress_bar = st.progress(0)
        total_teams = len(df_teams)
        
        for idx, row in df_teams.iterrows():
            team_id = row['TeamID']
            my_dec = current_decs[current_decs['TeamID'] == team_id]
            
            if not my_dec.empty:
                choice = my_dec.iloc[0]['SupplierChoice']
                profit, debt_change, msg = game_logic.calculate_outcome(row, choice, config['active_event'])
                
                new_cash = int(row['Cash'] + profit)
                new_debt = int(row['CarbonDebt'] + debt_change)
                
                # UPDATE SUPABASE BY ID
                sheets_helper.admin_update_team_score(team_id, new_cash, new_debt)
                
            progress_bar.progress((idx + 1) / total_teams)
            
        status.update(label="Calculation Complete!", state="complete")
        st.success("Database Updated Successfully!")