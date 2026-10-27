# Starfall Enigma

**Starfall Enigma** is an original gothic-luxury apparel e-commerce demo: a Next.js (React) storefront and an Express admin workspace on one Node.js process, backed by SQLite. It includes a bilingual (English / Bahasa Indonesia) storefront, a secure Indonesian admin workspace, inventory movements, manual sales channels and a cash-basis finance ledger in IDR.

> **Demo notice:** checkout is intentionally a demo. No real payment is processed, no card data is collected, no email is sent, and no shipment is created. The social links are outbound links only; there is no marketplace synchronisation or artificial traffic generation.

The brand, product catalogue, product copy, SVG packshots and visual direction are original Starfall Enigma work. The site does not reproduce any third-party logo, photograph, marketing copy, product name or official catalogue. Editorial photography credits are listed on `/credits`.

---

## Requirements

- Node.js **22.5 or newer** (`node:sqlite` is built in). Node 24 LTS or newer is recommended.
- npm.
- No external database or paid API is required. Next.js and React are the only build tooling.

No environment file is loaded automatically by the Express side. The Next.js side reads `.env.local` / `.env` in the usual Next.js way, so `TURSO_*` values can live there; shell variables still win.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/starfall.sqlite` | SQLite path, resolved from the project root. It overrides `TURSO_DATABASE_URL`, which keeps tests and isolated demos on their own file |
| `TURSO_DATABASE_URL` | `file:data/starfall.sqlite` | libSQL URL used by the Next.js API routes (`file:...` locally, `libsql://...` for Turso) |
| `TURSO_AUTH_TOKEN` | unset | Turso auth token when `TURSO_DATABASE_URL` points at a remote database |
| `COOKIE_SECURE` | unset | Set to `1` when serving over HTTPS so the session cookie is `Secure` |
| `ADMIN_SLUG` | generated | Optional fixed private slug for the admin workspace (lowercase letters, digits, hyphens) |
## Quick start

```bash
npm install
npm run seed:reset
npm run build
npm start
```

Open `http://localhost:3000`.

`npm start` runs `node server.js`, which serves the compiled Next.js storefront and the Express admin from one port. Run `npm run build` again after changing anything under `app/`, `components/` or `lib/`. During development use `npm run dev`, which compiles pages on demand.

Start with a fresh database if `data/starfall.sqlite` does not exist yet:

```bash
npm run seed
```

`seed:reset` deletes the selected database and all of its data, then rebuilds the catalogue. It is destructive and must not be run against a live store.

### Local development and asset caching

Static files are served with `Cache-Control: no-cache` plus an `ETag`. Every page load revalidates: an unchanged file answers `304` with no body, a changed one comes back as `200` straight away. Visitors never need a hard refresh to pick up a new stylesheet.

Stylesheet and script URLs also carry a `?v=` version derived from the newest file in `public/css`, `public/js` and `public/assets/fonts`, so a restart after a change produces a new URL that no browser or proxy can serve from an older cache.

In development (`NODE_ENV` unset) the Next.js storefront runs in dev mode with Fast Refresh. The Express side also watches `public/` and `views/` and pushes changes over Server-Sent Events at `/__dev/reload`:

- CSS edits swap the stylesheet in place, keeping scroll position and page state.
- Template and script edits reload the page automatically.
- `src/` edits restart the process through `npm run dev`; the page reloads once the server is back.

Both the endpoint and the injected `dev-live-reload.js` are disabled when `NODE_ENV=production`. Tests run with live reload off.

### Storefront architecture

The storefront is a Next.js App Router app rendered on the server. `server.js` chooses per request: storefront pages and the storefront APIs go to Next.js, and everything else (the private admin workspace and its API, `/api/setup`, `/css`, `/js`, `/assets`, `/preferences`, `/go/:platform`, `/health`, the sitemap and robots) stays on Express.

- Pages are server components that read SQLite directly through `lib/site.ts` and the existing service modules; no internal HTTP hop.
- Storefront APIs (`/api/products`, `/api/promo`, `/api/cart/resolve`, `/api/newsletter`, `/api/wishlist`, `/api/orders`, `/api/auth/*`, `/api/account/*`) are Next.js route handlers on top of libSQL (`lib/db.ts`, `lib/catalog-service.ts`, `lib/order-service.ts`, `lib/auth.ts`). They share the same session table and CSRF token as the Express admin, so a sign-in works across both.
- `DB_PATH` keeps tests and isolated demos on their own SQLite file; without it the API layer follows `TURSO_DATABASE_URL` and can talk to a remote Turso database.
- `public/js/app.js` and the per-page scripts still run in the browser. They load after hydration because they write bag and wishlist state the server cannot know, which would otherwise look like a hydration mismatch.
- The bag and wishlist keep their existing `localStorage` keys, and mutations call the Next.js `/api/*` endpoints with the same CSRF token.
- Unknown storefront URLs render the React 404 page through the Express fallback chain, while unknown `/api/*` paths still return JSON 404 from Express.

### Private admin URL

The admin workspace is **not** served from `/admin`. On first start the app generates a random slug such as `ops-f091ba41dc60`, stores it in the settings table and prints the real URL in the terminal:

```text
Admin URL is private. /admin and /setup always answer 404.
Admin: http://localhost:3000/ops-f091ba41dc60
```

- `/admin`, `/admin/login`, `/setup`, `/api/admin/*` and `/api/setup` always answer `404`.
- Only the slug opens the workspace; every internal admin link and API call stays inside it.
- The admin link is hidden from the storefront footer until an administrator is signed in.
- The slug is written to `data/admin-slug.txt` next to the database, so it survives restarts **and** `npm run seed:reset`. Delete that file to rotate it.
- Set `ADMIN_SLUG` to pin the slug from the environment instead. Public route names are rejected.
- `data/admin-slug.txt` is git-ignored, so a public repository never exposes the live slug.

### First admin setup

The seed deliberately creates **no administrator account**. On first run:

1. Start the server and copy the private admin URL printed in the terminal.
2. Open `<private-url>/setup`.
3. Create the first owner account (minimum 10-character password).
4. The setup route locks permanently once an owner exists. Later visits redirect to the login page inside the same slug.
5. Admin routes are always served in Indonesian and finance is always recorded in IDR.

There is no password-reset or email-verification flow in this demo. In development, `npm run seed:reset` wipes the entire database, including the owner and all orders, and allows setup again. The admin slug is stored outside the database, so the admin URL does not change.

## Storefront

- Home, collection and category shopping, filters, search and sorting.
- Product detail pages with variant selection, stock state and bilingual copy.
- Guest wishlist and cart stored in the browser.
- Customer registration, login, profile, addresses, wishlist sync and order history.
- Guest checkout is allowed. Logged-in customers can reuse saved addresses.
- Demo checkout supports the seeded promo code `STARFALL10` (10% off).
- Journal, about, store locations, client care, legal, credits and a styled 404 page.
- English / Indonesian language switch and USD / IDR currency switch.
- Social links are configured in admin and tracked only when a visitor actually clicks an outbound link.

The base product price is stored in USD cents. Orders store both the USD and IDR totals plus the exchange rate used at checkout. The IDR display uses the configured exchange rate with exact conversion rather than a rounded advertising rate.

## Admin

Admin pages live under the private slug reported at startup (for example `/ops-f091ba41dc60`) and use Indonesian labels throughout. `/admin` is never routed.

| Area | Main functions |
| --- | --- |
| Dashboard | Revenue, expenses, net profit, orders, units, low-stock and 14-day charts |
| Orders | Website orders, status updates, cancellation, manual sales |
| Inventory | Per-variant stock, receipts, adjustments, low-stock filters and an audit trail |
| Finance | Cash-basis income/expense ledger, filters, CSV export, net profit |
| Social | Instagram, TikTok and Shopee URLs, active state and real click statistics |
| Customers | Customer accounts, order count, spend, last order and newsletter opt-ins |
| Settings | Store identity, exchange rate, promo, low-stock threshold, admin password |

### Stock and order rules

- A demo checkout creates a paid order and decrements stock inside an immediate SQLite transaction.
- Stock validation happens on the server. The last unit cannot be sold twice, including concurrent requests.
- Sold-out variants and insufficient quantities are rejected with a `409`.
- Cancelling an order restores the stock, retains gross income, and posts an equal **reversal expense**. Net profit returns to its pre-order value.
- A cancelled order cannot be cancelled a second time. Repeating the action is rejected without changing stock or finance.
- Manual Instagram, TikTok, Shopee and offline sales decrement stock and create income in the correct channel category.
- Stock receipts can optionally record a purchase expense. Every stock mutation writes an inventory movement and an audit entry.
- Negative stock is rejected.

### Finance note

The ledger is a **cash-basis summary for the demo**, not formal accounting. It records demo income, manual sales, reversals, optional stock-purchase expenses and manual ledger entries. It does not calculate tax, cost of goods sold, depreciation or statutory reports.

## Catalogue and assets

- Exactly **72 apparel products**, eight in each of nine categories:
  - outerwear, tailoring, knitwear, dresses, tops, trousers
  - skirts, denim, loungewear
- **360 product variants**: five sizes per product. Clothing uses XS-XL; trousers and denim use waist sizes 28-36.
- Every product has at least one in-stock variant in a fresh seed, so no product is entirely un-purchasable.
- **144 original SVG packshots** (two per product), generated locally with distinct clothing silhouettes.
- **9 credited local editorial photographs** from Pexels, with original source links on `/credits`.
- Local font files: Cinzel, Cormorant Garamond and Jost. No runtime Google Fonts or CDN requests.

The seed does not randomise stock. It is deterministic so tests can rely on stable catalogue counts and final-unit scenarios.

## Testing

```bash
npm test
```

The suite uses Node's built-in test runner and creates isolated temporary databases. It never writes to `data/starfall.sqlite`. Each run first builds the storefront into `.next-test` and boots the real `server.js` (Next.js + Express), so the page assertions cover the code that ships and tests can run while `npm run dev` is using `.next`.

Coverage includes:

- exact catalogue counts, complete bilingual product data and at least one purchasable variant per product;
- 144 unique packshot files, 9 credited editorial photos and local fonts;
- first-run setup lockout, owner creation, wrong-password rejection, login/logout and session rotation;
- secure session cookies, hashed session tokens and no password-hash exposure in APIs, templates or `req.user`;
- CSP/security headers, bilingual pages, search, sitemap, robots and 404 behaviour;
- customer registration, wishlist sync, profile, addresses and order history;
- server-side oversell rejection, final-unit race, stock audit trail, cancellation restore and exact finance reversal;
- duplicate-cancel idempotence and invalid stock rejection;
- manual sales for Instagram, TikTok, Shopee and offline, including income categories;
- social link configuration and real click tracking;
- settings validation, CSV export and SQLite backup download.

Every test run creates its own temporary database and never depends on the local `data/` state. To run a separate disposable admin demo without touching another database, use a dedicated DB path:

```powershell
# PowerShell
$env:DB_PATH = 'data/demo.sqlite'
$env:PORT = '3100'
node scripts/seed.js --reset
node src/server.js
```

```bash
# macOS / Linux / Git Bash
DB_PATH=data/demo.sqlite PORT=3100 node scripts/seed.js --reset
DB_PATH=data/demo.sqlite PORT=3100 node src/server.js
```

Open the private admin URL that the server prints, then `<private-url>/setup` to create an owner in that disposable database. Do not point a demo database at real customer data.

## Project structure

```text
.
├─ server.js               Custom server: Next.js storefront + Express admin on one port
├─ app/                    Next.js App Router pages and API route handlers
├─ components/             React storefront components (header, footer, overlays, cards)
├─ lib/                    Next.js helpers: site context, libSQL data layer, API services
├─ proxy.ts                Per-request CSP nonce for Next.js pages
├─ next.config.ts          Next.js configuration
├─ src/
│  ├─ server.js            Express app, security headers, preferences, social redirects
│  ├─ db.js                SQLite connection, schema and settings helpers
│  ├─ schema.sql           Tables, indexes and constraints
│  ├─ auth.js              Sessions, CSRF, password verification, route guards
│  ├─ catalog.js           Original 72-product apparel catalogue and variant data
│  ├─ catalog-service.js   Search, filtering, product cards and cart resolution
│  ├─ order-service.js     Website orders, manual sales and cancellation
│  ├─ context.js           Locale, currency, navigation and social context
│  ├─ i18n.js              English/Indonesian dictionary and money/date formatting
│  ├─ content.js           Journal, editorial credits and static copy
│  └─ routes/              Public, account, auth and admin routes
├─ views/                  Express admin templates
├─ public/
│  ├─ css/                 Storefront and admin styles
│  ├─ js/                  Vanilla JS enhancements and admin clients
│  └─ assets/              SVG packshots, editorial images, fonts and brand marks
├─ scripts/
│  ├─ seed.js              Deterministic catalogue and stock seed
│  ├─ migrate.mjs          libSQL/Turso schema and settings migration
│  └─ generate-assets.js   Original SVG packshot generator
├─ tests/                  Node test suites and isolated test helpers
├─ data/                   Local SQLite database and temporary backups
└─ README.md
```

## Security notes

- Passwords are hashed with scrypt and a random salt; plaintext passwords are never stored.
- Session tokens are random, stored as SHA-256 hashes in SQLite, and sent in an `HttpOnly`, `SameSite=Lax` cookie. Use `COOKIE_SECURE=1` behind HTTPS.
- Authentication and setup endpoints are rate-limited. The limiter is in-memory in this demo and resets when the process restarts.
- All state-changing requests require a per-session CSRF token; tokens are compared in constant time.
- Admin pages live behind a randomly generated private slug stored in the database; `/admin`, `/setup` and the bare `/api/admin/*` paths answer `404` for everyone.
- Admin templates escape dynamic output by default; React escapes storefront output. Admin inputs are validated and cleaned on the server.
- CSP uses a per-request nonce and prohibits third-party scripts, fonts and images.
- Security headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict referrer policy, a restrictive permissions policy and `Cross-Origin-Opener-Policy: same-origin`.
- `req.user` and admin view locals contain only safe account fields; password hashes are not attached to requests or render contexts.
- SQL uses prepared statements and parameter binding throughout.
- The database backup endpoint creates a temporary snapshot, downloads it, then removes it. Treat any downloaded copy as sensitive because it contains customer records.

For a real deployment, use HTTPS, set `COOKIE_SECURE=1`, protect `data/` and backups from public access, run behind a maintained reverse proxy, add durable rate limiting and monitoring, and replace the demo email and payment assumptions with reviewed providers.

## Demo limitations

- No real payment, card processing, shipping calculation, tax calculation or fulfilment integration.
- No transactional email, email verification, password reset or newsletter delivery. The newsletter form is a local opt-in record only.
- No marketplace API sync or bot traffic. Social click counts represent real outbound clicks recorded by this app.
- One seeded percentage promo code.
- Cash-basis finance summary only; not accounting, tax or payroll software.
- Session cleanup runs at application start; an external scheduler is expected for long-running production deployments.
- Editorial photographs are sourced from Pexels and remain subject to the Pexels licence. Local copies and source credits are included in the project.

## Asset licences and credits

- Original SVG packshots, brand marks and editorial vector artwork: Starfall Enigma project assets.
- Editorial photography: Pexels, with individual photographer/source credits listed on `/credits`.
- Fonts: Cinzel, Cormorant Garamond and Jost, locally hosted under the SIL Open Font License. Licence text is included in `public/assets/fonts/OFL.txt`.

Do not replace the demo content with third-party brand assets or copyrighted catalogue material without permission.
