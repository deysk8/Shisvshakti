-- Run as postgres if `prisma migrate dev` fails with "permission denied to create database" (shadow DB).
ALTER USER shivasakti CREATEDB;
