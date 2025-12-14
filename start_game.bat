@echo off
echo ==========================================
echo    STARTING CARBON CRAFTS GAME ENGINE
echo ==========================================

echo 1. Starting Python Brain...
start "Python Engine" cmd /k "cd backend_engine && python -m uvicorn main:app --reload"

echo 2. Starting Admin Control Panel...
start "Admin Panel" cmd /k "cd admin_app && npm run dev"

echo 3. Starting Student App (Local Backup)...
start "Student App" cmd /k "cd student_app && npm run dev"

echo 4. Starting Ngrok Internet Bridge...
start "Ngrok Tunnel" cmd /k "npx ngrok http 8000"

echo ==========================================
echo    ALL SYSTEMS GO! DO NOT CLOSE WINDOWS
echo ==========================================
pause