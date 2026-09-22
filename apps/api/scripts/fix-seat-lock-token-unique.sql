-- Allow multiple seat rows to share one lock token (one lock session, many seats).
ALTER TABLE seat_locks DROP CONSTRAINT IF EXISTS seat_locks_lock_token_key;
CREATE INDEX IF NOT EXISTS seat_locks_lock_token_status_idx ON seat_locks (lock_token, status);
