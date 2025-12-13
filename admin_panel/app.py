import streamlit as st

st.set_page_config(page_title="Carbon Crafts", layout="wide")

# --- SAFE IMPORTS ---
try:
    from views import participant, admin
except ImportError as e:
    st.error(f"🚨 Missing File Error: {e}")
    st.stop()

# Try importing dashboard, but don't crash if it's missing
try:
    from views import dashboard
    HAS_DASHBOARD = True
except ImportError:
    HAS_DASHBOARD = False

# --- SESSION STATE ---
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
if 'role' not in st.session_state:
    st.session_state['role'] = None

# --- LOGIN SCREEN ---
def login_screen():
    st.title("🌍 Carbon Crafts Sim")
    
    # NOTE: Public Dashboard button REMOVED for security.
    
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        role = st.radio("Role", ["Participant", "Game Master"])
        username = st.text_input("Team ID")
        password = st.text_input("Password", type="password")
        
        if st.button("Login"):
            if role == "Game Master" and password == "admin123":
                st.session_state['logged_in'] = True
                st.session_state['role'] = "admin"
                st.rerun()
            elif role == "Participant" and password == "play2025":
                st.session_state['logged_in'] = True
                st.session_state['role'] = "participant"
                st.session_state['team_id'] = username
                st.rerun()

# --- MAIN ROUTER ---
def main():
    # 1. Dashboard View (Only accessible if triggered by Admin)
    if st.session_state.get('view_dashboard') and HAS_DASHBOARD:
        # Button to return to Admin HQ
        if st.sidebar.button("⬅️ Close Projector View"):
            st.session_state['view_dashboard'] = False
            st.rerun()
        dashboard.show()
        return

    # 2. Login Check
    if not st.session_state['logged_in']:
        login_screen()
    
    # 3. Logged In Routing
    else:
        # Global Logout for everyone
        if st.sidebar.button("Logout"):
            st.session_state['logged_in'] = False
            st.session_state['view_dashboard'] = False
            st.rerun()
            
        if st.session_state['role'] == "admin":
            # --- ADMIN ONLY FEATURES ---
            st.sidebar.divider()
            st.sidebar.header("📺 Projector Controls")
            if HAS_DASHBOARD:
                if st.sidebar.button("📊 Launch Live Dashboard"):
                    st.session_state['view_dashboard'] = True
                    st.rerun()
            
            admin.show()
        else:
            # Participant View
            team_id = st.session_state.get('team_id', 'Unknown')
            participant.show(team_id)

if __name__ == "__main__":
    main()