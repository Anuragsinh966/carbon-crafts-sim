import pandas as pd

# --- GAME CONSTANTS ---
SUPPLIERS = {
    "Tier A (Ethical)": {"cost": 1200, "debt": -1, "base_rev": 1000},
    "Tier B (Standard)": {"cost": 800, "debt": 1, "base_rev": 1000},
    "Tier C (Dirty)": {"cost": 500, "debt": 3, "base_rev": 1000}
}

def safe_int(value):
    """Helper: Tries to convert value to int, returns 0 if it fails."""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0

def calculate_final_score(cash, debt):
    """
    The Golden Formula: (Cash * 0.6) + ((100 - Debt) * 10)
    """
    # FIX: Force inputs to be integers
    c = safe_int(cash)
    d = safe_int(debt)

    effective_debt = min(d, 100) # Cap debt
    sustainability_score = (100 - effective_debt) * 10
    financial_score = c * 0.6
    return financial_score + sustainability_score

def calculate_outcome(team_data, choice, event):
    """Returns: (net_profit, debt_change, log_msg)"""
    supplier = SUPPLIERS.get(choice)
    if not supplier:
        return 0, 0, "Invalid Choice"

    # FIX: Force inputs to be integers from team_data
    current_debt = safe_int(team_data.get('CarbonDebt', 0))
    
    cost = supplier['cost']
    revenue = supplier['base_rev']
    debt_change = supplier['debt']
    logs = []

    # --- SPECIFIC SCENARIO LOGIC ---
    
    # 1. Carbon Tax
    if event == "The Carbon Tax":
        fine = current_debt * 100
        cost += fine
        if fine > 0:
            logs.append(f"TAX: Paid ${fine} fine.")
        else:
            logs.append("TAX: No debt? You get a $200 Rebate!")
            revenue += 200

    # 2. Viral Expose
    elif event == "The Viral Expose":
        if "Tier C" in choice:
            revenue = revenue * 0.5
            logs.append("SCANDAL: Tier C boycotted. Revenue halved.")
        elif "Tier A" in choice:
            revenue = revenue * 2.0
            logs.append("VIRAL FAME: Tier A demand skyrocketed!")

    # 3. Economic Recession
    elif event == "The Economic Recession":
        if "Tier A" in choice or "Tier B" in choice:
            revenue = revenue * 0.5
            logs.append("RECESSION: Luxury goods aren't selling.")
        else:
            logs.append("RECESSION: Cheap goods (Tier C) selling normally.")

    # 4. Tech Breakthrough
    elif event == "The Tech Breakthrough":
        if "Tier A" in choice:
            cost -= 300
            debt_change -= 1 
            logs.append("TECH: Tier A is cheaper and cleaner.")

    # Base Log
    if not logs:
        logs.append(f"Market Stable. {choice}.")

    net_profit = revenue - cost
    return net_profit, debt_change, " | ".join(logs)