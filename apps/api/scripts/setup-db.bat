@echo off
REM Connect as superuser "postgres" (NOT shivasakti). Enter the password you chose when installing PostgreSQL.
setlocal
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres
set PGDATABASE=postgres

echo.
echo === Shiva Sakti database setup ===
echo You will be asked for the POSTGRES superuser password (install time).
echo Do NOT use username shivasakti here — that user is created by this script.
echo.

psql -U postgres -d postgres -h localhost -p 5432 -f "%~dp0setup-db.sql"
if errorlevel 1 (
  echo.
  echo Setup failed. Common fixes:
  echo   1. Use username postgres at the password prompt (default superuser).
  echo   2. Use the password from PostgreSQL installation, not shivasakti yet.
  echo   3. Or open pgAdmin: Query Tool on database "postgres", paste setup-db.sql, run.
  pause
  exit /b 1
)

echo.
echo Success. Next commands:
echo   cd C:\Users\deyzz\OneDrive\Desktop\ShivaSakti\apps\api
echo   npx prisma migrate dev --name init
echo   npm run prisma:seed
echo.
pause
