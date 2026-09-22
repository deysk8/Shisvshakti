-- Run after `prisma migrate dev` (partial uniques are not expressible in all Prisma versions).
-- Prevents double booking and duplicate active locks.

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_seats_trip_seat_occupied
ON booking_seats (trip_id, bus_seat_id)
WHERE occupancy_status = 'OCCUPIED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_locks_active
ON seat_locks (trip_id, bus_seat_id)
WHERE status = 'ACTIVE';

ALTER TABLE agents
  ADD CONSTRAINT IF NOT EXISTS chk_agent_commission_cap
  CHECK (commission_rate_percent >= 0 AND commission_rate_percent <= 4);
