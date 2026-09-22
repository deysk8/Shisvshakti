# PostgreSQL Schema Specification

All primary keys: `UUID` (`gen_random_uuid()`). Timestamps: `created_at`, `updated_at` on mutable tables. Money: `NUMERIC(12,2)`. Currency default `INR`.

---

## Enums

```sql
-- roles
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN');

-- fleet
CREATE TYPE bus_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');
CREATE TYPE seat_type AS ENUM ('SEATER', 'SLEEPER', 'SEMISLEEPER', 'LEGREST');
CREATE TYPE layout_kind AS ENUM ('LAYOUT_2_2', 'LAYOUT_2_1', 'SLEEPER', 'SEATER_SLEEPER_MIX');

-- operations
CREATE TYPE trip_status AS ENUM ('SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
CREATE TYPE day_of_week AS ENUM ('MON','TUE','WED','THU','FRI','SAT','SUN');

-- booking
CREATE TYPE booking_source AS ENUM (
  'CUSTOMER_ONLINE',
  'AGENT_ONLINE',
  'AGENT_CASH',
  'ADMIN'
);
CREATE TYPE booking_status AS ENUM (
  'DRAFT',
  'SEATS_LOCKED',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW'
);
CREATE TYPE lock_status AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONVERTED');

-- payments
CREATE TYPE payment_method AS ENUM ('RAZORPAY', 'CASH', 'UPI_MANUAL', 'OTHER');
CREATE TYPE payment_status AS ENUM (
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

-- refunds
CREATE TYPE refund_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_APPLICABLE');

-- notifications
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

-- tracking
CREATE TYPE tracking_source AS ENUM ('GPS_DEVICE', 'DEMO');

-- audit
CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'CANCEL_BOOKING', 'REFUND', 'POLICY_CHANGE');
```

---

## Company & settings

### `company_settings` (single row for Shiva Sakti; extensible later)

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| legal_name | TEXT NOT NULL | `'Shiva Sakti'` |
| display_name | TEXT | Marketing name |
| logo_url | TEXT | PDF / emails |
| support_email | TEXT | |
| support_phone | TEXT | |
| timezone | TEXT NOT NULL | `'Asia/Kolkata'` |
| default_commission_cap_percent | NUMERIC(5,2) NOT NULL | `4.00` |
| seat_lock_ttl_seconds | INT NOT NULL | e.g. `600` |
| payment_pending_ttl_seconds | INT NOT NULL | e.g. `900` |
| created_at / updated_at | TIMESTAMPTZ | |

---

## Identity

### `users`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| email | CITEXT UNIQUE NOT NULL | Login |
| phone | VARCHAR(15) UNIQUE | E.164 preferred |
| password_hash | TEXT NOT NULL | Argon2/bcrypt |
| full_name | TEXT NOT NULL | |
| role | user_role NOT NULL | RBAC |
| email_verified_at | TIMESTAMPTZ | |
| is_active | BOOLEAN DEFAULT true | |
| last_login_at | TIMESTAMPTZ | |

### `agents`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| user_id | UUID UNIQUE FK → users | Must be role AGENT |
| employee_code | VARCHAR(32) UNIQUE | |
| salary_monthly | NUMERIC(12,2) NOT NULL | Fixed salary |
| commission_rate_percent | NUMERIC(5,2) NOT NULL | **CHECK 0 ≤ x ≤ 4** |
| is_active | BOOLEAN DEFAULT true | Admin toggle |
| joined_at | DATE | |

Salary is **not** stored on each booking; commission is (see `agent_commissions`).

### `refresh_tokens` (optional session table)

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| user_id | UUID FK | |
| token_hash | TEXT UNIQUE | |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | |

---

## Fleet

### `bus_types`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| name | TEXT NOT NULL | e.g. "AC Seater 2+2" |
| layout_kind | layout_kind NOT NULL | |
| total_seats | INT NOT NULL | Denormalized count |
| layout_config | JSONB NOT NULL | Rows, decks, gaps — drives code generation |
| amenities | JSONB | WiFi, USB, etc. |
| description | TEXT | |

**`layout_config` example (conceptual):**

```json
{
  "decks": [
    {
      "name": "lower",
      "rows": [
        { "row": 1, "seats": [
          { "label": "A1", "type": "SEATER", "col": 1 },
          { "label": "A2", "type": "SEATER", "col": 2 }
        ]}
      ]
    }
  ]
}
```

### `buses`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| registration_number | VARCHAR(32) UNIQUE NOT NULL | |
| name | TEXT | Display name |
| operator_name | TEXT DEFAULT 'Shiva Sakti' | |
| bus_type_id | UUID FK → bus_types | |
| status | bus_status | |
| images | JSONB | URLs in object storage |
| amenities_override | JSONB | Optional override |

### `bus_seats`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| bus_id | UUID FK → buses | |
| seat_label | VARCHAR(16) NOT NULL | A1, L1U, etc. |
| deck | VARCHAR(16) | lower/upper |
| row_index | INT | |
| col_index | INT | |
| seat_type | seat_type | |
| is_active | BOOLEAN DEFAULT true | Disable damaged seats |

**Unique:** `(bus_id, seat_label)`

---

## Network (routes & stops)

### `stops`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| name | TEXT NOT NULL | "Jharsuguda Junction" |
| city | TEXT | |
| state | TEXT | |
| latitude | NUMERIC(10,7) | Map |
| longitude | NUMERIC(10,7) | |
| address | TEXT | |
| is_active | BOOLEAN DEFAULT true | |

### `routes`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| code | VARCHAR(32) UNIQUE | JRG-BLR |
| name | TEXT NOT NULL | |
| origin_stop_id | UUID FK → stops | Denormalized convenience |
| destination_stop_id | UUID FK → stops | |
| total_distance_km | NUMERIC(10,2) | |
| estimated_duration_minutes | INT | |
| is_active | BOOLEAN DEFAULT true | |

### `route_stops`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| route_id | UUID FK → routes | |
| stop_id | UUID FK → stops | |
| sequence | INT NOT NULL | 1..N |
| arrival_offset_min | INT | Minutes from trip departure; 0 at origin |
| departure_offset_min | INT | Minutes from trip departure |
| distance_from_origin_km | NUMERIC(10,2) | |

**Unique:** `(route_id, sequence)`, `(route_id, stop_id)`

---

## Schedules & trips

### `schedules`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| route_id | UUID FK → routes | |
| bus_id | UUID FK → buses | Assigned bus |
| departure_time | TIME NOT NULL | Local India time |
| arrival_time | TIME | Optional at destination |
| effective_from | DATE | |
| effective_to | DATE | NULL = open-ended |
| base_fare | NUMERIC(12,2) | Full route reference fare |
| is_active | BOOLEAN DEFAULT true | |

### `schedule_operating_days`

| Column | Type | Notes |
|--------|------|--------|
| schedule_id | UUID FK | |
| day_of_week | day_of_week | |

**PK:** `(schedule_id, day_of_week)`

### `trips`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| schedule_id | UUID FK → schedules | |
| service_date | DATE NOT NULL | |
| bus_id | UUID FK → buses | Snapshot if bus swapped |
| route_id | UUID FK → routes | Denormalized for queries |
| departure_at | TIMESTAMPTZ NOT NULL | Computed at creation |
| arrival_at | TIMESTAMPTZ | |
| status | trip_status | |
| available_seats_cache | INT | Optional cache; source of truth = seats |

**Unique:** `(schedule_id, service_date)`

---

## Pricing

### `fare_rules`

Segment pricing between stop sequences on a route.

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| route_id | UUID FK → routes | |
| from_sequence | INT NOT NULL | |
| to_sequence | INT NOT NULL | Must be > from |
| amount | NUMERIC(12,2) NOT NULL | |
| is_active | BOOLEAN DEFAULT true | |

**Unique:** `(route_id, from_sequence, to_sequence)`

---

## Bookings

### `bookings`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_reference | VARCHAR(20) UNIQUE NOT NULL | Human-readable SSR… |
| trip_id | UUID FK → trips | |
| customer_user_id | UUID FK → users NULL | Walk-in via agent may be null |
| agent_id | UUID FK → agents NULL | |
| booking_source | booking_source NOT NULL | |
| status | booking_status NOT NULL | State machine |
| boarding_route_stop_id | UUID FK → route_stops | |
| dropping_route_stop_id | UUID FK → route_stops | |
| contact_name | TEXT | |
| contact_phone | VARCHAR(15) | |
| contact_email | CITEXT | Notifications |
| subtotal_amount | NUMERIC(12,2) | |
| discount_amount | NUMERIC(12,2) DEFAULT 0 | |
| total_amount | NUMERIC(12,2) | Snapshotted |
| currency | CHAR(3) DEFAULT 'INR' | |
| payment_method | payment_method | Set at confirm |
| cancelled_at | TIMESTAMPTZ | |
| cancellation_reason | TEXT | |
| refund_status | refund_status | Aggregate display |
| idempotency_key | VARCHAR(64) UNIQUE | Client retry safety |

### `booking_passengers`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_id | UUID FK | |
| full_name | TEXT NOT NULL | |
| age | INT | |
| gender | VARCHAR(16) | |
| phone | VARCHAR(15) | |
| is_primary | BOOLEAN | Ticket name |

### `booking_seats`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_id | UUID FK → bookings | |
| trip_id | UUID FK → trips | Same as booking.trip_id |
| bus_seat_id | UUID FK → bus_seats | |
| seat_label | VARCHAR(16) | Snapshot |
| fare_amount | NUMERIC(12,2) | |

**Critical:** confirmed occupancy enforced via partial unique index (see indexes doc).

### `seat_locks` (DB audit + optional sync with Redis)

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| trip_id | UUID FK | |
| bus_seat_id | UUID FK | |
| booking_id | UUID FK NULL | Set when lock tied to booking draft |
| locked_by_user_id | UUID FK → users | |
| lock_token | VARCHAR(64) UNIQUE | Client holds this |
| status | lock_status | |
| expires_at | TIMESTAMPTZ NOT NULL | |
| released_at | TIMESTAMPTZ | |

---

## Payments & refunds

### `payments`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_id | UUID FK UNIQUE | One primary payment per booking (v1) |
| razorpay_order_id | VARCHAR(64) UNIQUE | |
| razorpay_payment_id | VARCHAR(64) UNIQUE | |
| amount | NUMERIC(12,2) | |
| currency | CHAR(3) | |
| method | payment_method | |
| status | payment_status | |
| failure_reason | TEXT | |
| verified_at | TIMESTAMPTZ | Server verification |
| raw_gateway_payload | JSONB | Audit |

### `refunds`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_id | UUID FK | |
| payment_id | UUID FK NULL | NULL for cash |
| cancellation_policy_id | UUID FK | Rule applied |
| requested_amount | NUMERIC(12,2) | |
| approved_amount | NUMERIC(12,2) | |
| status | refund_status | |
| razorpay_refund_id | VARCHAR(64) UNIQUE | |
| processed_at | TIMESTAMPTZ | |

### `cancellation_policies`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| name | TEXT | |
| min_hours_before_departure | INT NOT NULL | Inclusive lower bound |
| max_hours_before_departure | INT | NULL = infinity |
| refund_percent | NUMERIC(5,2) NOT NULL | 0–100 |
| priority | INT NOT NULL | Higher wins when overlapping |
| is_active | BOOLEAN | |

**Seed example (admin-editable, not hardcoded in code):**

| name | min_h | max_h | refund % |
|------|-------|-------|----------|
| Early | 24 | NULL | 80 |
| Standard | 12 | 24 | 50 |
| Late | 0 | 12 | 0 |

---

## Tickets & verification

### `tickets`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| booking_id | UUID UNIQUE FK | |
| ticket_number | VARCHAR(32) UNIQUE | |
| qr_token | VARCHAR(64) UNIQUE | Opaque; signed at verify |
| pdf_storage_key | TEXT | S3/R2 path |
| issued_at | TIMESTAMPTZ | |
| verified_count | INT DEFAULT 0 | Scan audit |

### `ticket_scan_logs` (future staff app)

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| ticket_id | UUID FK | |
| scanned_by_user_id | UUID FK | |
| scanned_at | TIMESTAMPTZ | |
| result | TEXT | VALID / INVALID |

---

## Agents & commissions

### `agent_commissions`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| agent_id | UUID FK | |
| booking_id | UUID UNIQUE FK | One commission row per booking |
| commission_rate_percent | NUMERIC(5,2) | Snapshot ≤ 4 |
| booking_fare_basis | NUMERIC(12,2) | Eligible amount |
| commission_amount | NUMERIC(12,2) | Computed |
| status | TEXT | ACCRUED, PAID — extend enum later |
| accrued_at | TIMESTAMPTZ | |

Commission computed only for `booking_source IN ('AGENT_ONLINE','AGENT_CASH')` unless admin overrides.

---

## Notifications

### `notifications`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| user_id | UUID FK NULL | |
| booking_id | UUID FK NULL | |
| channel | notification_channel | v1: EMAIL |
| template_key | VARCHAR(64) | BOOKING_CONFIRMED, etc. |
| recipient | TEXT | Email address snapshot |
| payload | JSONB | Template variables |
| status | notification_status | |
| sent_at | TIMESTAMPTZ | |
| error_message | TEXT | |

---

## Tracking

### `tracking_points`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| bus_id | UUID FK | |
| trip_id | UUID FK NULL | When on active trip |
| latitude | NUMERIC(10,7) | |
| longitude | NUMERIC(10,7) | |
| speed_kmh | NUMERIC(6,2) | |
| heading | NUMERIC(5,2) | |
| recorded_at | TIMESTAMPTZ NOT NULL | Device time |
| received_at | TIMESTAMPTZ DEFAULT now() | Server ingest |
| source | tracking_source NOT NULL | DEMO only non-prod |

### `bus_tracking_state` (latest position cache)

| Column | Type | Notes |
|--------|------|--------|
| bus_id | UUID PK FK | |
| trip_id | UUID FK | |
| latitude / longitude | NUMERIC | |
| last_recorded_at | TIMESTAMPTZ | |
| source | tracking_source | |

---

## Webhooks & audit

### `webhook_events`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| provider | TEXT | razorpay |
| event_id | VARCHAR(128) UNIQUE | Idempotency |
| event_type | TEXT | |
| payload | JSONB | |
| processed_at | TIMESTAMPTZ | |

### `audit_logs`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID PK | |
| actor_user_id | UUID FK | |
| action | audit_action | |
| entity_type | TEXT | |
| entity_id | UUID | |
| metadata | JSONB | |
| ip_address | INET | |
| created_at | TIMESTAMPTZ | |

---

## Booking status state machine

```text
DRAFT → SEATS_LOCKED → PENDING_PAYMENT → CONFIRMED
   ↘                      ↘ FAILED/TTL → SEATS_RELEASED (status CANCELLED or back to search)
CONFIRMED → CANCELLED (refund flow)
CONFIRMED → COMPLETED (post-trip)
```

Agent **CASH**: `SEATS_LOCKED → CONFIRMED` in one transaction (skip Razorpay).

Online: `SEATS_LOCKED → PENDING_PAYMENT → CONFIRMED` after verify.

---

## Analytics-friendly views (Phase 18)

Materialized or regular views later:

- `v_daily_bookings`, `v_route_popularity`, `v_agent_performance`, `v_online_vs_offline`

Base tables above already store dimensions: `booking_source`, `payment_method`, `trip.service_date`, `route_id`.
