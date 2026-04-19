# ArtistHub 🌸
> Zero-Storage Digital Portfolio & Booking System

A luxury, mobile-first portfolio and booking app for beauty artists.
Built with **Next.js · Tailwind CSS · Supabase · jsPDF**.

---

## Project Structure

```
artisthub/
├── lib/
│   ├── supabaseClient.js   ← DB helpers + Supabase client
│   ├── generatePDF.js      ← jsPDF pamphlet generator
│   └── whatsapp.js         ← WhatsApp deep-link builder
├── pages/
│   ├── _app.jsx
│   ├── login.jsx           ← Auth page
│   ├── dashboard/
│   │   └── index.jsx       ← Artist dashboard (protected)
│   └── portfolio/
│       └── [username].jsx  ← Public portfolio + booking page
├── styles/
│   └── globals.css
├── schema.sql              ← Supabase DB schema
├── tailwind.config.js
└── package.json
```

---

## 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Open **SQL Editor** and paste the entire contents of `schema.sql` → **Run**
3. Go to **Authentication → Providers** → make sure **Email** is enabled
4. Copy your **Project URL** and **anon public** key from **Project Settings → API**

---

## 2 — Local Setup

```bash
# Clone / create your Next.js project
npx create-next-app@14 artisthub --no-typescript --no-app --no-src-dir
cd artisthub

# Copy all files from this package into the project

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

```bash
npm run dev
# → http://localhost:3000
```

---

## 3 — postcss.config.js

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

---

## 4 — How It Works

### Zero-Storage Images
No file uploads at all. Users paste **external image URLs** (from Instagram,
Google Drive, Pinterest, etc.) into the dashboard. The app renders them directly
with `<img src={url}>` — no S3, no storage bucket needed.

### Public Portfolio
`/portfolio/[username]` — shareable link the artist sends to clients.

### Booking Flow
1. Client selects a service → picks an available date on the calendar
2. Fills in name + WhatsApp number → submits
3. App saves booking to Supabase
4. Automatically opens a `wa.me` link that pre-fills the full booking summary
   to the artist's WhatsApp number

### PDF Pamphlet
Click **Download Portfolio PDF** on the public page. jsPDF renders:
- Artist avatar, name, tagline, bio
- Services & pricing table
- Portfolio photo grid (up to 6 images)
- Social links footer
- UPI QR code on page 2 (if provided)

### Availability Calendar (Dashboard)
The artist taps any future date to toggle it **Busy / Available**.
Busy dates are blocked on the client-side booking calendar.

---

## 5 — Deployment (Vercel)

```bash
npm install -g vercel
vercel
# Add env vars in Vercel Dashboard → Settings → Environment Variables
```

---

## 6 — Colour Palette

| Token      | Hex       | Usage                       |
|------------|-----------|-----------------------------|
| Champagne  | `#D4B996` | Accents, CTAs, highlights   |
| Charcoal   | `#262626` | Background, dark surfaces   |
| Cream      | `#FCF9F4` | PDF background, light areas |

---

## 7 — Fonts

| Font                  | Weight       | Usage         |
|-----------------------|--------------|---------------|
| Cormorant Garamond    | 400, 600     | Headings      |
| DM Sans               | 300–700      | Body text     |

---

*Built with ❤️ for ArtistHub*
