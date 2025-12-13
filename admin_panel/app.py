import streamlit as st

st.set_page_config(page_title="Carbon Crafts Admin", layout="wide")

# --- IMPORTS ---
try:
    from views import admin, dashboard
except ImportError as e:
    st.error(f"🚨 Missing File Error: {e}")
    st.stop()

# --- SESSION STATE ---
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
if 'view_mode' not in st.session_state:
    st.session_state['view_mode'] = 'admin' # 'admin' or 'projector'

# --- LOGIN SCREEN ---
def login_screen():
    st.title("🔒 Command Center Access")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        password = st.text_input("Admin Password", type="password")
        if st.button("Enter HQ"):
            if password == "admin123": # You can change this password
                st.session_state['logged_in'] = True
                st.rerun()
            else:
                st.error("Access Denied")

# --- MAIN CONTROLLER ---
def main():
    # 1. Login Check
    if not st.session_state['logged_in']:
        login_screen()
        return

    # 2. Projector Mode (Public Dashboard)
    if st.session_state['view_mode'] == 'projector':
        st.sidebar.button("⬅️ Back to Controls", on_click=lambda: st.session_state.update({'view_mode': 'admin'}))
        dashboard.show()
        return

    # 3. Admin Mode (Control Panel)
    st.sidebar.title("👨‍💼 Game Master")
    
    if st.sidebar.button("📺 Launch Projector View"):
        st.session_state['view_mode'] = 'projector'
        st.rerun()
        
    st.sidebar.divider()
    if st.sidebar.button("Logout"):
        st.session_state['logged_in'] = False
        st.rerun()

    # Load the Admin View
    admin.show()

if __name__ == "__main__":
    main()