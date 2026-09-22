# Shiva Sakti — Phase progress

Database setup can be done later; application code is written to run once PostgreSQL is migrated and seeded.

| Phase | Status | Notes |
|-------|--------|--------|
| 1 Architecture | Done | |
| 2 Database design | Done | `docs/database/` |
| 3 Project scaffold | Done | |
| 4 Auth + roles | Done | JWT + refresh cookie |
| 5 Admin (partial) | Done | Agents API, list routes/buses; UI basic |
| 6 Bus + seats | Done | Fleet service, 2+2 layout |
| 7 Routes + schedules | Done | Launch route seed |
| 8 Search | Done | `GET /search/trips` + web `/search` |
| 9 Seat locks | Done | DB locks + seat map API |
| 10 Bookings | Done | Lock → draft → ticket row on confirm |
| 11 Agent booking | Done | `agentCash` on create booking |
| 12 Payments | Done | Razorpay order + verify + webhook; dev simulate without keys |
| 13 PDF tickets | Done | PDFKit + QR; `GET /tickets/by-reference/:ref/pdf` |
| 14 Notifications | Done | Resend API or console log in dev |
| 15 Maps | Done | OSM route map on home (free); `GET /maps/routes/:code` |
| 16 Live tracking | Done (demo) | `GET /tracking/trips/:id/position`; `/track/[tripId]` page |
| 17 Cancellation/refunds | Done | Policy-based cancel; Razorpay/dev refund; `/bookings` UI |
| 18 Analytics | Done | Admin `/admin` dashboard; `GET /admin/analytics/*` |
| 19 Security hardening | Done | Helmet, rate limits, prod JWT validation, Swagger off in prod |
| 20 Testing/deploy | Done | `docs/DEPLOY.md`, Dockerfiles, `docker-compose.prod.yml` |
| A Marketing home | Done | Hero, features, stats, footer, hire enquiry |
| B Search polish | Done | Swap cities, today/tomorrow, amenities on results |
| C Public API | Done | `GET /public/*`, testimonials, enquiries |
| D Special features | Done | Senior/child discounts, reschedule UI, loyalty display |
| Agent portal | Done | `/agent` dashboard, cash/online booking, commissions |
| E Trust fixes | Done | Flat seat fares, payment resume, about/policies, reschedule segment |
| F Booking UX | Done | Lock countdown, summary strip, multi-passenger, stop picker |
| G Search depth | Done | Filters, segment stop times, policy on cards |
| H Notifications | Done | Auto SMS/WhatsApp + PDF link on confirm; Twilio or dev storage |
| I Loyalty & coupons | Done | DB ledger, WELCOME10/FLAT50 seed, checkout apply + earn on confirm |
| J Admin ops CRUD | Done | Agents/buses/schedules/fares/coupons API + `/admin/operations` UI |
| J2 Trip seat discounts | Done | Per-day, per-seat price overrides when departure is near (`TripSeatPriceOverride`) |
| K GPS & QR | Done | GPS ingest, live ETAs on track page, agent QR verify at `/agent/scan` |
| L GST & extras | Done | GST invoice PDF, saved travellers, trip ratings, English/Odia i18n |
| Skipped (by request) | — | Cargo tracking, mobile app / PWA |

## When database is ready

```powershell
cd apps\api
npx prisma migrate dev --name init
npm run prisma:seed
```

Then run API + web and test: Home → Search → Seats → Login → Passengers → Payment → Confirmation (PDF download).
