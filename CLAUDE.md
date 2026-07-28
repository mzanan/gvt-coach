# CLAUDE.md

Coaching booking platform for GVT (Matias + Gabriel coach profiles). Vault tracking: `personal-brain/01-Projects/18-gvt-coach/`.

## Stack

Next 16 (App Router) + React 19 + Tailwind v4 (no `tailwind.config`, tokens in `src/app/globals.css` `@theme`) + shadcn/radix primitives in `src/app/components/ui-kit/`. Turso/libSQL via a hand-written query layer (no ORM, no Drizzle) in `src/lib/db/`. Auth.js (`next-auth` v5 beta) with Google OAuth, gated to `ADMIN_EMAILS` for the admin panel. Payments: Stripe (default, inline `price_data` per checkout, no persistent Stripe Products) or Polar, selectable per coach; `disabled` also exists as a no-op provider.

## Commands

- `npm run dev` (fixed port 3120), `npm run build`, `npm run lint`
- No test suite, no db:generate/migrate scripts - schema changes go through `COLUMN_MIGRATIONS`-style idempotent `ALTER TABLE` in `src/lib/db/`, applied on connection.

## Structure

- `src/app/` routes: booking home, `/admin` (Google OAuth gate), `/payment/{success,cancel}`, `api/{checkout,booking,bookings,webhooks,admin,auth,zoom,email,orders,config}`
- `src/app/components/features/<feature>/` (booking, payment, admin) - colocated `use<Feature>.ts` hooks + subcomponents; `src/app/components/ui-kit/` shadcn-style primitives (Button, Card, Input, Accordion, etc.); `src/app/components/core/` cross-app shell (Header, Footer, AppConfigProvider, ThemeProvider)
- `src/services/` external integrations: `payments/{stripe,polar,disabled}` (common interface via `payments/index.ts`), `mailer.ts`, `email-templates/`, `bookingFulfillment.ts` (webhook -> booking + email + meeting), `userService.ts`
- `src/lib/db/` typed query helpers per table (`bookings.ts`, `coaches.ts`, `payments.ts`, `settings.ts`) + `client.ts` (libSQL connection + migrations)
- `src/lib/zoom.ts`, `src/lib/adminAuth.ts`, `src/lib/utils/`
- `src/config/coaches.ts` (coach registry: pricing, timezone, payment/meeting provider), `src/config/site.ts`

## Payments

Stripe Checkout Sessions build `price_data` inline from the coach's DB-stored price, no Stripe Product objects to manage. Webhook (`api/webhooks/stripe`) confirms payment -> `bookingFulfillment.ts` creates the booking, sends confirmation emails, and (once configured) creates the meeting link. Polar follows the same shape via its own webhook route. Provider is chosen per coach (`src/config/coaches.ts`) with a global default in `NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER`.

## Known gaps (see vault tasks.md for detail)

- Coach photo is a URL field only (no upload yet, Vercel Blob decided but not wired).
- Meeting provider: only Zoom scaffolding exists (`src/lib/zoom.ts`, `api/zoom/meeting`) but is unused - Google Meet was chosen instead, not implemented.
- Mailer needs Gmail SMTP credentials (old Mailgun account is gone).
- Polar has no CLI for local sandbox testing; Stripe CLI covers local dev.

## Conventions

Personal engineering standards apply (reuse/SRP/DRY/tokens/server-first, zero code comments, branch per change, adversarial+regression review before merge): see `personal/CLAUDE.md` and `personal-brain/02-Areas/Engineering-standards.md`. Secrets in `.env.local`, tracked in Infisical (`personal-brain/02-Areas/Secrets-management.md`); never commit values.
