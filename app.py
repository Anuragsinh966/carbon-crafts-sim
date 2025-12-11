import streamlit as st

st.set_page_config(page_title="Carbon Crafts", layout="wide")

# --- DEBUGGING: Check for Secrets ---
if "supabase" not in st.secrets:
    st.error("🚨 CRITICAL ERROR: Supabase Secrets are missing!")
    st.info("Go to Streamlit Cloud -> Settings -> Secrets and add your [supabase] keys.")
    st.stop()

# --- SAFE IMPORTS ---
# This prevents the "White Screen" if a file is missing
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
    
    # Dashboard Button (Only if file exists)
    if HAS_DASHBOARD:
        if st.button("📊 View Live Projector Dashboard", use_container_width=True):
            st.session_state['view_dashboard'] = True
            st.rerun()

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
    # 1. Dashboard View
    if st.session_state.get('view_dashboard') and HAS_DASHBOARD:
        if st.sidebar.button("⬅️ Back to Login"):
            st.session_state['view_dashboard'] = False
            st.rerun()
        dashboard.show()
        return

    # 2. Login Check
    if not st.session_state['logged_in']:
        login_screen()
    
    # 3. Logged In Routing
    else:
        if st.sidebar.button("Logout"):
            st.session_state['logged_in'] = False
            st.rerun()
            
        if st.session_state['role'] == "admin":
            admin.show()
        else:
            # Safety check for Team ID
            team_id = st.session_state.get('team_id', 'Unknown')
            participant.show(team_id)

if __name__ == "__main__":
    main()