# --- GAME CONSTANTS ---
SUPPLIERS = {
    "Tier A (Ethical)": {"cost": 1200, "debt": -1, "base_rev": 1000},
    "Tier B (Standard)": {"cost": 800, "debt": 1, "base_rev": 1000},
    "Tier C (Dirty)": {"cost": 500, "debt": 3, "base_rev": 1000}
}

def calculate_score(cash, debt):
    """The Golden Formula: (Cash * 0.6) + ((100 - Debt) * 10)"""
    # Ensure realistic numbers for display
    sustainability_score = (100 - debt) * 10
    financial_score = cash * 0.6
    return financial_score + sustainability_score

def calculate_outcome(team_data, choice, event):
    """Calculates revenue and fines based on the Global Event."""
    supplier = SUPPLIERS.get(choice)
    if not supplier:
        return 0, 0, "Invalid Choice"

    cost = supplier['cost']
    revenue = supplier['base_rev']
    debt_change = supplier['debt']
    log_msg = "Normal Market Conditions"

    # --- EVENT LOGIC ---
    if event == "The Carbon Tax":
        # Fine: $100 per debt token
        fine = team_data['CarbonDebt'] * 100
        cost += fine
        log_msg = f"TAXED: Paid ${fine} in fines."

    elif event == "The Viral Expose":
        if "Tier C" in choice:
            revenue = revenue * 0.5  # 50% Revenue Loss
            log_msg = "VIRAL SCANDAL: Sales crashed by 50%."
        elif "Tier A" in choice:
            revenue = revenue * 2.0  # Double Revenue
            log_msg = "VIRAL FAME: Sales doubled!"

    elif event == "The Economic Recession":
        if "Tier A" in choice or "Tier B" in choice:
            revenue = revenue * 0.5
            log_msg = "RECESSION: Luxury goods (Tier A/B) not selling."
        # Tier C sells normally

    elif event == "The Tech Breakthrough":
        if "Tier A" in choice:
            cost -= 300
            log_msg = "TECH BONUS: Tier A cost reduced by $300."

    # Calculate Net
    net_profit = revenue - cost
    return net_profit, debt_change, log_msg