import streamlit as st
from views import participant, admin

# Page Config
st.set_page_config(page_title="Carbon Crafts", layout="wide")

# Init Session
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
    st.session_state['role'] = None
    st.session_state['team_id'] = None

# --- LOGIN SCREEN ---
def login_screen():
    st.title("🌍 Carbon Crafts: The Executive Dilemma")
    st.write("Welcome to the Simulation.")
    
    col1, col2 = st.columns(2)
    with col1:
        role = st.radio("Select Role", ["Participant", "Game Master"])
        username = st.text_input("Team ID / Username")
        password = st.text_input("Password", type="password")
        
        if st.button("Login"):
            # ADMIN LOGIN
            if role == "Game Master" and password == "admin123":
                st.session_state['logged_in'] = True
                st.session_state['role'] = "admin"
                st.rerun()
            
            # PARTICIPANT LOGIN
            elif role == "Participant":
                # Simple password check for all students
                if password == "play2025":
                    st.session_state['logged_in'] = True
                    st.session_state['role'] = "participant"
                    st.session_state['team_id'] = username
                    st.rerun()
                else:
                    st.error("Incorrect Password")

# --- MAIN ROUTER ---
def main():
    if not st.session_state['logged_in']:
        login_screen()
    else:
        # Show Logout
        with st.sidebar:
            if st.button("Logout"):
                st.session_state['logged_in'] = False
                st.rerun()

        # Route to View
        if st.session_state['role'] == "admin":
            admin.show()
        else:
            participant.show(st.session_state['team_id'])

if __name__ == "__main__":
    main()