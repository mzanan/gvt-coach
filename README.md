# GVT Coach Booking Platform

This is a [Next.js](https://nextjs.org/) application serving as a booking platform for GVT coaching sessions. It allows users to select a coach, view availability on a calendar, choose a time slot, and complete the booking process through integrated payment providers.

## Core Technologies

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Database & Auth:** [Supabase](https://supabase.io/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [Shadcn/ui](https://ui.shadcn.com/)
*   **Payment Providers:** [Lemon Squeezy](https://www.lemonsqueezy.com/) & [Polar](https://polar.sh/)
*   **Video Conferencing:** [Zoom](https://zoom.us/) (for meeting creation)
*   **Email:** [Mailgun](https://www.mailgun.com/) (via Nodemailer)
*   **Date/Time:** [Luxon](https://moment.github.io/luxon/)
*   **Language:** TypeScript

## Getting Started

### Prerequisites

*   Node.js (LTS version recommended)
*   npm, yarn, or pnpm
*   Supabase account (for database and auth)
*   Accounts with payment providers (Lemon Squeezy, Polar), Zoom, and Mailgun for full functionality.
*   [Supabase CLI](https://supabase.com/docs/guides/cli) (Optional, but recommended for managing local development and migrations)

### Environment Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd gvt-coach
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

3.  **Set up Environment Variables:**
    *   Create a `.env.local` file in the root of the project.
    *   Copy the necessary environment variables from `.env.example` (if one exists) or add the following variables, replacing the placeholder values with your actual credentials and IDs:

        ```dotenv
        # Supabase
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

        # Zoom
        GVT_COACH_ZOOM_ACCOUNT_ID=YOUR_ZOOM_ACCOUNT_ID
        GVT_COACH_ZOOM_CLIENT_ID=YOUR_ZOOM_CLIENT_ID
        GVT_COACH_ZOOM_CLIENT_SECRET=YOUR_ZOOM_CLIENT_SECRET
        # GVT_COACH_ZOOM_SECRET_TOKEN= # Optional/Legacy?
        # GVT_COACH_ZOOM_VERIFICATION_TOKEN= # Optional/Legacy?

        # Mailgun (or your SMTP provider)
        GVT_COACH_MAILGUN_SMTP_HOST=YOUR_SMTP_HOST
        GVT_COACH_MAILGUN_SMTP_PORT=YOUR_SMTP_PORT
        GVT_COACH_MAILGUN_SMTP_USER=YOUR_SMTP_USER
        GVT_COACH_MAILGUN_SMTP_PASS=YOUR_SMTP_PASS
        GVT_COACH_FROM_EMAIL=YOUR_SENDER_EMAIL
        GVT_COACH_FROM_NAME="YOUR SENDER NAME"

        # Lemon Squeezy
        GVT_COACH_LEMONSQUEEZY_API_KEY=YOUR_LEMONSQUEEZY_API_KEY
        GVT_COACH_LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_LEMONSQUEEZY_WEBHOOK_SECRET
        NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_STORE_ID=YOUR_LEMONSQUEEZY_STORE_ID
        GVT_COACH_LEMONSQUEEZY_API_URL=https://api.lemonsqueezy.com/v1
        # Coach-Specific Variant IDs (Get these from your Lemon Squeezy dashboard)
        NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_MATIAS_PRODUCT_ID=YOUR_MATIAS_LS_VARIANT_ID
        NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_GABRIEL_PRODUCT_ID=YOUR_GABRIEL_LS_VARIANT_ID

        # Polar API Configuration
        GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN=YOUR_POLAR_SANDBOX_TOKEN
        GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN=YOUR_POLAR_PRODUCTION_TOKEN
        GVT_COACH_POLAR_WEBHOOK_SECRET=YOUR_POLAR_WEBHOOK_SECRET
        GVT_COACH_POLAR_SANDBOX_API_URL=https://sandbox-api.polar.sh/v1
        GVT_COACH_POLAR_PRODUCTION_API_URL=https://api.polar.sh/v1
        # Coach-Specific Product IDs (Get these from your Polar dashboard)
        NEXT_PUBLIC_GVT_COACH_POLAR_MATIAS_PRODUCT_ID=YOUR_MATIAS_POLAR_PRODUCT_ID
        NEXT_PUBLIC_GVT_COACH_POLAR_GABRIEL_PRODUCT_ID=YOUR_GABRIEL_POLAR_PRODUCT_ID

        # Project Configuration
        NEXT_PUBLIC_APP_URL=http://localhost:3000 # Adjust if needed
        NEXT_PUBLIC_ENV=development # or production
        NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER=lemonsqueezy # Default provider: polar || lemonsqueezy
        GVT_COACH_API_SECRET_KEY="generate_a_strong_secret_key" # Used for securing internal API routes/webhooks
        ```

4.  **Set up Supabase:**
    *   Ensure your Supabase project is created and the database schema matches the requirements.
    *   The database migrations are located in the `supabase/migrations` directory.
    *   If using the Supabase CLI and running locally:
        *   Link your project: `supabase link --project-ref YOUR_PROJECT_ID`
        *   Start Supabase services: `supabase start`
        *   Apply migrations: `supabase db reset` (for a clean start) or `supabase migration up` (to apply pending migrations).
    *   If deploying or using a hosted Supabase instance, ensure the schema defined in the migrations is applied to your database.

### Running the Development Server

Execute one of the following commands:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the specified port) in your browser to see the application.

## Project Structure Overview

*   `src/app/`: Contains the application routes defined using the Next.js App Router.
*   `src/components/`: Reusable UI components, categorized into `ui-kit` (generic, based on Shadcn/ui) and `features` (specific application features like booking, payment).
*   `src/lib/`: Utility functions, Supabase client configuration, helper functions.
*   `src/services/`: Logic for interacting with external services (Payments, Mailer, Zoom) and email templates.
*   `src/types/`: TypeScript type definitions and enums.
*   `src/config/`: Application configuration, like coach details (`coaches.ts`).
*   `supabase/`: Supabase-specific files, including database migrations and edge functions.

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Ensure all necessary environment variables are configured in your Vercel project settings.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
