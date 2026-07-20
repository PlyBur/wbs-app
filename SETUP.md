# Whistle Business Suite — Setup Guide

## Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account for deployment (optional)

---

## 1. Install dependencies

```bash
cd wbs-app
npm install
```

---

## 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name and region (closest to South Africa = **Europe West**)
3. Wait for it to provision (~2 min)

---

## 3. Set up the database schema

1. In Supabase dashboard → **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste the entire file into the editor and click **Run**

This creates all tables, RLS policies, indexes, and auto-numbering triggers.

---

## 4. Configure environment variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `RESEND_FROM_EMAIL` | Your verified sender email in Resend |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console → Maps JavaScript API |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local, your domain in production |

---

## 5. Configure Supabase Auth

### Enable Google OAuth (optional but recommended)
1. Supabase → Authentication → Providers → Google
2. Enable it, add Client ID and Secret from [Google Cloud Console](https://console.cloud.google.com)
3. Add redirect URI: `https://YOUR_SUPABASE_URL/auth/v1/callback`

### Email templates
Supabase → Authentication → Email Templates — customise as desired.

---

## 6. Create your first workspace

After running the schema, run this in the Supabase SQL editor to bootstrap your workspace (replace values):

```sql
-- First, sign up through the app to create your auth.users record, then run:
insert into workspaces (owner_id, name, email, default_vat_rate, quote_expiry_days)
select id, 'My Business', 'me@mybusiness.co.za', 15, 30
from auth.users
where email = 'YOUR_EMAIL_HERE'
limit 1;
```

---

## 7. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → sign up → you're in.

---

## 8. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect via the [Vercel dashboard](https://vercel.com/new) → import from GitHub.

Add all environment variables from `.env.local` to Vercel's environment settings.

Update `NEXT_PUBLIC_APP_URL` to your production URL.

---

## Optional integrations

### WhatsApp Business API
1. Set up a Meta Business account and WhatsApp Business API
2. Configure the webhook URL: `https://YOUR_DOMAIN/api/whatsapp`
3. Add `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_API_TOKEN` to your env

### AI features (OpenAI)
Already configured — the `OPENAI_API_KEY` env var enables:
- AI quote draft assistant
- Voice note transcription (via Whisper)

### PDF generation
The `/api/pdf` route uses Puppeteer to render quote/invoice PDFs.
On Vercel, install `@vercel/og` or use a headless browser layer.

---

## Project structure

```
wbs-app/
├── src/
│   ├── app/
│   │   ├── (auth)/login/         ← Login page
│   │   ├── (dashboard)/          ← All protected pages
│   │   ├── quote/[token]/        ← Public quote acceptance
│   │   └── api/                  ← API routes
│   ├── components/
│   │   ├── ui/                   ← Button, Card, Badge, etc.
│   │   └── layout/               ← Sidebar, Header, DashboardLayout
│   ├── lib/
│   │   ├── supabase/             ← Client, server, middleware helpers
│   │   ├── utils.ts              ← formatZAR, calcTravelCost, etc.
│   │   └── supabase/queries.ts   ← Typed data fetchers
│   ├── types/index.ts            ← All TypeScript types
│   └── middleware.ts             ← Auth guard
└── supabase/
    └── migrations/001_initial_schema.sql
```
