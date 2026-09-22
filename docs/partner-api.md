# Shiv Shakti Partner Inventory API

OTA partners (RedBus, AbhiBus) use this API to search trips, read live seat maps, lock seats, confirm bookings, and cancel — all against the **same inventory** as the Shiv Shakti website and agent portal.

## Base URL

```
{API_PUBLIC_URL}/partner/v1
```

Development default: `http://localhost:4000/api/v1/partner/v1`

## Authentication

Send the API key on every request using either header:

```
X-Partner-Key: sk_redbus_...
```

or

```
Authorization: Bearer sk_redbus_...
```

Keys are issued by Shiv Shakti admin (Admin → OTA partners). Keys are stored hashed; if lost, rotate in admin.

## Inventory sync model

| Channel | How inventory stays in sync |
|--------|-----------------------------|
| Partner → Shiv Shakti | Lock + confirm writes `booking_seats` with `OCCUPIED` |
| Shiv Shakti website/agents → Partner | Seat map marks seats `booked` or `locked` on next poll |
| Partner lock expiry | Locks auto-expire (default 10 min); seats return to `available` |

There is no separate OTA allotment — one bus, one seat map, all channels.

## Endpoints

### `GET /whoami`

Verify key and channel code.

### `GET /trips/search`

Query params (same as public search):

| Param | Example |
|-------|---------|
| `fromCity` | Jharsuguda |
| `toCity` | Bangalore |
| `date` | 2026-09-22 |

Returns trip list with `tripId`, segment times, fare, `availableSeats`.

### `GET /trips/:tripId/seats`

Query params:

| Param | Description |
|-------|-------------|
| `fromSequence` | Boarding stop sequence on route |
| `toSequence` | Dropping stop sequence |

Seat `status`: `available` | `locked` | `booked`. Use seat `id` (UUID) when locking.

### `POST /locks`

```json
{
  "tripId": "uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"]
}
```

Response:

```json
{
  "lockToken": "hex",
  "expiresAt": "2026-08-15T10:20:00.000Z",
  "seatIds": ["..."]
}
```

### `POST /bookings/confirm`

Idempotent on `(partnerChannel, partnerReference)`.

```json
{
  "tripId": "uuid",
  "lockToken": "from lock step",
  "partnerReference": "YOUR-UNIQUE-BOOKING-ID",
  "boardingSequence": 1,
  "droppingSequence": 5,
  "contactName": "Passenger Name",
  "contactPhone": "9876543210",
  "contactEmail": "optional@email.com",
  "passengers": [
    { "fullName": "Passenger Name", "age": 30, "gender": "M" }
  ],
  "totalAmountPaid": 850
}
```

Returns Shiv Shakti `bookingReference`, seat labels, ticket QR token, and `idempotent: true` if the reference was already confirmed.

Payment is settled offline between operator and OTA; booking is created as **CONFIRMED** immediately.

### `GET /bookings/:partnerReference`

Status lookup by your reference ID.

### `POST /bookings/:partnerReference/cancel`

```json
{ "reason": "Passenger cancelled on RedBus" }
```

Releases seats. Refund percent follows operator cancellation policy (for settlement reporting); actual refund to passenger is handled by the OTA.

## Inventory webhooks (push sync)

When inventory changes on Shiv Shakti channels **other than your own API calls**, we POST an event to your configured webhook URL (set in Admin → OTA partners).

### Events

| Event | When |
|-------|------|
| `seats.booked` | Website, agent, admin, or another OTA confirms seats |
| `seats.released` | Booking cancelled or rescheduled (old seats freed) |
| `trip.cancelled` | Operator cancels the entire trip for a day |

You will **not** receive webhooks for bookings you created via the Partner API (you already know those). Other partners **will** receive them.

### Request

```
POST {your_webhook_url}
Content-Type: application/json
X-ShivaSakti-Event: seats.booked
X-ShivaSakti-Delivery-Id: {uuid}
X-ShivaSakti-Channel: REDBUS
X-ShivaSakti-Timestamp: 1693651200
X-ShivaSakti-Signature: t=1693651200,v1={hmac_sha256_hex}
```

Body example:

```json
{
  "eventId": "uuid",
  "event": "seats.booked",
  "occurredAt": "2026-09-02T03:53:00.000Z",
  "recipientChannel": "REDBUS",
  "trip": {
    "tripId": "uuid",
    "serviceDate": "2026-08-15",
    "departureAt": "2026-08-15T06:00:00.000Z",
    "routeCode": "JRG-BLR",
    "routeName": "Jharsuguda → Bangalore",
    "status": "SCHEDULED"
  },
  "seats": [{ "busSeatId": "uuid", "label": "A1" }],
  "availableSeats": 38,
  "totalSeats": 40,
  "origin": {
    "bookingSource": "CUSTOMER_ONLINE",
    "bookingReference": "SSABC123"
  }
}
```

### Signature verification

When `PARTNER_WEBHOOK_HMAC_SECRET` is configured on the operator side (shared during onboarding):

```
expected = HMAC-SHA256(secret, "{timestamp}.{raw_json_body}")
Compare to v1= in X-ShivaSakti-Signature
```

Reject requests older than 5 minutes based on `X-ShivaSakti-Timestamp`.

Respond with **2xx** quickly. Retries are not automatic in v1 — use the Partner API seat map to reconcile if a webhook is missed.

Admin can send a **test webhook** from `/admin/partners` after saving a URL.

## Error codes

| HTTP | Meaning |
|------|---------|
| 401 | Missing or invalid API key |
| 404 | Trip or booking not found |
| 409 | Seat already booked or locked by another session |
| 400 | Invalid segment, expired lock, or trip not schedulable |

## Onboarding checklist

1. Admin enables channel and shares API key securely.
2. Partner implements search → seats → lock → confirm in staging.
3. Map cities to Shiv Shakti route stop cities (case-insensitive match).
4. Use unique `partnerReference` per sale; retry confirm safely on network failures.
5. Cancel on your platform when passenger cancels so seats return to inventory.
6. Production cutover: rotate to production key, monitor Admin → Recent OTA partner bookings.

## Dev setup

After `npm run db:seed` in `apps/api`, seed logs one-time API keys for RedBus and AbhiBus. Test:

```bash
curl -H "X-Partner-Key: YOUR_KEY" \
  "http://localhost:4000/api/v1/partner/v1/trips/search?fromCity=Jharsuguda&toCity=Bangalore&date=2026-09-22"
```
