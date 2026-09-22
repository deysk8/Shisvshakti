# Indexes, Constraints & Uniques

## Unique constraints (business keys)

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| users | email | One account per email |
| users | phone | Optional login/recovery |
| agents | user_id | One agent profile per user |
| agents | employee_code | HR reference |
| buses | registration_number | Legal vehicle id |
| bus_seats | (bus_id, seat_label) | No duplicate labels on a bus |
| routes | code | Admin shorthand |
| route_stops | (route_id, sequence) | Ordered path |
| route_stops | (route_id, stop_id) | Stop appears once per route |
| trips | (schedule_id, service_date) | One trip instance per day |
| fare_rules | (route_id, from_sequence, to_sequence) | One price per segment |
| bookings | booking_reference | Customer support |
| bookings | idempotency_key | Safe retries |
| payments | booking_id | Single primary payment (v1) |
| payments | razorpay_order_id | Gateway correlation |
| payments | razorpay_payment_id | Gateway correlation |
| tickets | booking_id | One ticket per booking |
| tickets | ticket_number, qr_token | Scan & lookup |
| agent_commissions | booking_id | One commission record |
| webhook_events | event_id | Webhook idempotency |
| seat_locks | lock_token | Client reference |

---

## Check constraints

```sql
ALTER TABLE agents
  ADD CONSTRAINT chk_agent_commission_cap
  CHECK (commission_rate_percent >= 0 AND commission_rate_percent <= 4);

ALTER TABLE fare_rules
  ADD CONSTRAINT chk_fare_sequence
  CHECK (to_sequence > from_sequence);

ALTER TABLE cancellation_policies
  ADD CONSTRAINT chk_refund_percent
  CHECK (refund_percent >= 0 AND refund_percent <= 100);

ALTER TABLE booking_seats
  ADD CONSTRAINT chk_fare_nonneg
  CHECK (fare_amount >= 0);

ALTER TABLE bookings
  ADD CONSTRAINT chk_total_nonneg
  CHECK (total_amount >= 0);
```

**Agent commission at booking time:** application must set  
`agent_commissions.commission_rate_percent = LE(agent.commission_rate_percent, company_settings.default_commission_cap_percent)`.

---

## Partial unique indexes (prevent double booking)

These are the **most important** constraints in the system.

### 1. Confirmed seat occupancy (one seat, one trip)

```sql
CREATE UNIQUE INDEX uq_booking_seats_trip_seat_confirmed
ON booking_seats (trip_id, bus_seat_id)
WHERE EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.id = booking_seats.booking_id
    AND b.status IN ('CONFIRMED', 'COMPLETED')
);
```

**Prisma note:** Prisma does not express partial indexes with subqueries cleanly; implement via raw SQL migration or partial index on booking status if we denormalize `booking_status` onto `booking_seats` for indexing:

**Recommended denormalization for indexing:**

| booking_seats | Column `occupancy_status` | Set to `OCCUPIED` on confirm |

```sql
CREATE UNIQUE INDEX uq_booking_seats_trip_seat_occupied
ON booking_seats (trip_id, bus_seat_id)
WHERE occupancy_status = 'OCCUPIED';
```

Use enum `seat_occupancy` = `HELD`, `OCCUPIED`, `RELEASED`.

### 2. Active seat lock (one active lock per seat per trip)

```sql
CREATE UNIQUE INDEX uq_seat_locks_active
ON seat_locks (trip_id, bus_seat_id)
WHERE status = 'ACTIVE';
```

Redis still holds TTL locks; this index catches races if two API workers insert locks.

### 3. Active payment pending (optional)

Prevent two Razorpay orders for same booking:

```sql
-- payments.booking_id already UNIQUE
```

---

## Performance indexes (search & dashboards)

```sql
-- Customer search: trips by date + route endpoints
CREATE INDEX idx_trips_service_date ON trips (service_date);
CREATE INDEX idx_trips_route_date ON trips (route_id, service_date);
CREATE INDEX idx_trips_status ON trips (status) WHERE status = 'SCHEDULED';

-- Schedules
CREATE INDEX idx_schedules_route ON schedules (route_id) WHERE is_active = true;

-- Bookings
CREATE INDEX idx_bookings_trip ON bookings (trip_id);
CREATE INDEX idx_bookings_customer ON bookings (customer_user_id, created_at DESC);
CREATE INDEX idx_bookings_agent ON bookings (agent_id, created_at DESC);
CREATE INDEX idx_bookings_source ON bookings (booking_source);
CREATE INDEX idx_bookings_status ON bookings (status);

-- Payments admin
CREATE INDEX idx_payments_status ON payments (status, created_at DESC);

-- Notifications queue
CREATE INDEX idx_notifications_pending
ON notifications (status, created_at)
WHERE status = 'PENDING';

-- Tracking
CREATE INDEX idx_tracking_trip_time ON tracking_points (trip_id, recorded_at DESC);
CREATE INDEX idx_tracking_bus_time ON tracking_points (bus_id, recorded_at DESC);

-- Audit
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

-- Route stops join
CREATE INDEX idx_route_stops_route_seq ON route_stops (route_id, sequence);

-- Fare lookup
CREATE INDEX idx_fare_rules_route ON fare_rules (route_id, from_sequence, to_sequence)
WHERE is_active = true;
```

---

## Foreign key delete rules

| Child | Parent | ON DELETE |
|-------|--------|-----------|
| bus_seats | buses | RESTRICT (cannot delete bus with history) |
| bookings | trips | RESTRICT |
| booking_seats | bookings | CASCADE |
| booking_passengers | bookings | CASCADE |
| payments | bookings | RESTRICT |
| tickets | bookings | RESTRICT |
| route_stops | routes | CASCADE (admin rebuild route) |
| trips | schedules | RESTRICT |

Use **soft delete** (`is_active`) for buses, routes, agents instead of hard delete when bookings exist.

---

## Row-level locking pattern (confirm booking)

Within a single transaction:

1. `SELECT * FROM trips WHERE id = $1 FOR UPDATE`
2. Verify `seat_locks` ACTIVE and `expires_at > now()` for all seats (or agent cash path creates locks inline)
3. `UPDATE seat_locks SET status = 'CONVERTED'`
4. `INSERT booking_seats ... occupancy_status = 'OCCUPIED'`
5. `UPDATE bookings SET status = 'CONFIRMED'`
6. On unique violation → rollback, return `SEAT_UNAVAILABLE`

---

## Redis keys (complement to DB)

| Key pattern | TTL | Value |
|-------------|-----|--------|
| `seatlock:{tripId}:{seatId}` | 600s | lock_token |
| `booking:session:{lockToken}` | 600s | JSON seat list |
| `ratelimit:login:{ip}` | 60s | counter |

On confirm: delete Redis keys after DB commit.

On TTL expiry: worker sets `seat_locks.status = 'EXPIRED'` if still ACTIVE.

---

## Fields requiring uniqueness summary

- All **gateway IDs** (order, payment, refund, webhook event)
- **booking_reference**, **ticket_number**, **qr_token**
- **vehicle registration**, **route code**, **agent employee_code**
- **(trip_id, bus_seat_id)** for occupied seats and active locks

This set prevents duplicate money capture and duplicate seat sale under concurrency.
