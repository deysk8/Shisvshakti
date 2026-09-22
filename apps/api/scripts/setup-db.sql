-- Run as superuser POSTGRES (in pgAdmin: connect to server, open Query Tool on database "postgres").
-- Ignore errors if role/database already exist.

CREATE USER shivasakti WITH PASSWORD 'shivasakti_dev_change_me';
ALTER USER shivasakti CREATEDB;
CREATE DATABASE shivasakti OWNER shivasakti;
GRANT ALL PRIVILEGES ON DATABASE shivasakti TO shivasakti;

-- After `npx prisma migrate dev`, run partial-uniques.sql on database shivasakti (optional but recommended).
