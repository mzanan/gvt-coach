# GVT Coach Booking Platform

A [Next.js](https://nextjs.org/) booking platform for GVT coaching sessions. Users pick a coach, view calendar availability, choose a time slot, enter their email, and complete the booking through Stripe or Polar checkout.

## Core Technologies

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router), React 19
- **Database:** [Turso](https://turso.tech/) (libSQL), no ORM - typed query helpers in `src/lib/db/`
- **Auth:** [Auth.js](https://authjs.dev/) (`next-auth` v5) with Google OAuth, admin panel gated by email allowlist
- **Styling:** Tailwind CSS v4 + shadcn/ui-style primitives (`src/app/components/ui-kit/`)
- **Payments:** [Stripe](https://stripe.com/) (default) or [Polar](https://polar.sh/), selectable per coach
- **Date/Time:** [Luxon](https://moment.github.io/luxon/)
- **Language:** TypeScript

## Getting Started

### Prerequisites

- Node.js LTS + npm
- A Turso database (or a local libSQL file for dev)
- A Google OAuth client (for admin login)
- A Stripe account (test mode is enough for local dev; Stripe CLI recommended for webhook forwarding)

### Setup

1. Clone and install:
   ```bash
   git clone <repository-url>
   cd gvt-coach
   npm install
   ```

2. Create `.env.local`:
   ```dotenv
   DATABASE_URL=                          # libSQL/Turso connection string (or file:local.db for dev)
   AUTH_SECRET=                           # next-auth secret
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=
   ADMIN_EMAILS=                          # comma-separated allowlist for /admin

   NEXT_PUBLIC_APP_URL=http://localhost:3120
   NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER= # stripe | polar | disabled

   GVT_COACH_STRIPE_SECRET_KEY=
   GVT_COACH_STRIPE_WEBHOOK_SECRET=
   GVT_COACH_POLAR_WEBHOOK_SECRET=        # only if using Polar
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```
   Fixed at [http://localhost:3120](http://localhost:3120).

4. Forward Stripe webhooks locally with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3120/api/webhooks/stripe
   ```

## Project Structure

- `src/app/` - App Router routes: booking home, `/admin`, `/payment/{success,cancel}`, `api/*`
- `src/app/components/features/<feature>/` - booking, payment, admin UI + colocated hooks
- `src/app/components/ui-kit/` - reusable primitives (Button, Card, Input, Accordion, ...)
- `src/services/` - payment providers, mailer, email templates, booking fulfillment
- `src/lib/db/` - libSQL client + typed query helpers per table
- `src/config/coaches.ts` - coach registry (pricing, timezone, provider per coach)

## Deployment

Deployed on [Vercel](https://vercel.com/), auto-deploy on merge to `main`. Set the same environment variables in the Vercel project settings, pointing `DATABASE_URL` at the Turso production database.
