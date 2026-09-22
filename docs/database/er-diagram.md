# Entity Relationship Diagram

## Core ER (Mermaid)

```mermaid
erDiagram
    USERS ||--o| AGENTS : "profile"
    USERS ||--o{ BOOKINGS : "customer"
    AGENTS ||--o{ BOOKINGS : "creates"
    AGENTS ||--o{ AGENT_COMMISSIONS : "earns"

    BUS_TYPES ||--o{ BUSES : "classifies"
    BUSES ||--o{ BUS_SEATS : "contains"
    BUSES ||--o{ SCHEDULES : "assigned"
    BUSES ||--o{ TRACKING_POINTS : "reports"

    ROUTES ||--o{ ROUTE_STOPS : "ordered_stops"
    STOPS ||--o{ ROUTE_STOPS : "referenced"
    ROUTES ||--o{ SCHEDULES : "operates"
    ROUTES ||--o{ FARE_RULES : "priced"

    SCHEDULES ||--o{ TRIPS : "instances"
    TRIPS ||--o{ BOOKINGS : "for_date"
    TRIPS ||--o{ SEAT_LOCKS : "holds"
    TRIPS ||--o{ TRACKING_POINTS : "optional"

    BOOKINGS ||--o{ BOOKING_PASSENGERS : "travelers"
    BOOKINGS ||--o{ BOOKING_SEATS : "reserves"
    BUS_SEATS ||--o{ BOOKING_SEATS : "occupied"
    BUS_SEATS ||--o{ SEAT_LOCKS : "held"

    BOOKINGS ||--o| PAYMENTS : "paid_by"
    BOOKINGS ||--o{ REFUNDS : "may_refund"
    BOOKINGS ||--o| TICKETS : "issued"
    BOOKINGS ||--o{ NOTIFICATIONS : "triggers"
    BOOKINGS ||--o| AGENT_COMMISSIONS : "optional"

    CANCELLATION_POLICIES ||--o{ REFUNDS : "applied_rule"
    USERS ||--o{ AUDIT_LOGS : "actor"
    USERS ||--o{ NOTIFICATIONS : "recipient"

    USERS {
        uuid id PK
        string email UK
        string phone UK
        enum role
        string password_hash
    }

    AGENTS {
        uuid id PK
        uuid user_id FK UK
        decimal salary_monthly
        decimal commission_rate_percent
        boolean is_active
    }

    BUSES {
        uuid id PK
        string registration_number UK
        uuid bus_type_id FK
        enum status
    }

    BUS_SEATS {
        uuid id PK
        uuid bus_id FK
        string seat_label
        json layout_meta
    }

    ROUTES {
        uuid id PK
        string code UK
        uuid origin_stop_id FK
        uuid destination_stop_id FK
    }

    STOPS {
        uuid id PK
        string name
        decimal latitude
        decimal longitude
    }

    ROUTE_STOPS {
        uuid id PK
        uuid route_id FK
        uuid stop_id FK
        int sequence
    }

    SCHEDULES {
        uuid id PK
        uuid route_id FK
        uuid bus_id FK
        time departure_time
    }

    TRIPS {
        uuid id PK
        uuid schedule_id FK
        date service_date UK_with_schedule
        enum status
    }

    FARE_RULES {
        uuid id PK
        uuid route_id FK
        int from_sequence
        int to_sequence
        decimal amount
    }

    BOOKINGS {
        uuid id PK
        string booking_reference UK
        uuid trip_id FK
        enum booking_source
        enum status
        decimal total_amount
    }

    BOOKING_SEATS {
        uuid id PK
        uuid booking_id FK
        uuid trip_id FK
        uuid bus_seat_id FK
    }

    SEAT_LOCKS {
        uuid id PK
        uuid trip_id FK
        uuid bus_seat_id FK
        timestamptz expires_at
        enum status
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK
        string razorpay_order_id UK
        enum status
    }

    TICKETS {
        uuid id PK
        uuid booking_id FK UK
        string ticket_number UK
        string qr_token UK
    }
```

## Relationship notes

| From | To | Cardinality | Meaning |
|------|-----|-------------|---------|
| User | Agent | 0..1 | Every agent is a user; customers/admins are users without agent row |
| Bus | BusSeat | 1..N | Layout generated from bus type config, seats are stable per bus |
| Route | RouteStop | 1..N | Ordered path; sequence defines boarding/dropping order |
| Schedule | Trip | 1..N | One recurring schedule produces one trip per calendar day |
| Trip | Booking | 1..N | All bookings for that bus run on that date |
| Booking | BookingSeat | 1..N | Usually 1..1 for seater; N for group bookings later |
| BookingSeat | BusSeat | N..1 | Physical seat on the bus assigned to the trip’s bus |
| Booking | Payment | 1..0..1 | Cash/agent confirmed bookings may have no Razorpay payment row |
| Booking | Ticket | 1..1 | Created only when booking reaches CONFIRMED |
| Agent | AgentCommission | 1..N | One row per confirmed agent-attributed booking (≤ 4% of eligible fare) |

## Route vs trip time model

- **RouteStop** stores **offsets** from trip departure (minutes) and cumulative distance — same route works for every schedule.
- **Schedule** stores clock **departure_time** (and optional arrival at destination as computed or stored).
- **Trip** = `schedule_id` + `service_date` → concrete departure datetime = `service_date + schedule.departure_time` (timezone: `Asia/Kolkata` in app layer).

## Boarding / dropping on bookings

Each booking stores:

- `boarding_route_stop_id` — which stop passenger boards  
- `dropping_route_stop_id` — which stop passenger alights  

Fare is resolved from **FareRule** matching route + `(from_sequence, to_sequence)` at booking time and stored on `bookings.total_amount` and `booking_seats.fare_amount`.
