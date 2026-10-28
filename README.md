# IMS — Inventory Management System

Inventory and warehouse management for a Cambodian trading business. It tracks products across warehouses, purchase and sales orders, transfers, barcode lookup, Khmer invoices, and USD/KHR pricing.

## Run it

```bash
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000

Demo sign-in:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@sovann.kh | admin123 |
| Warehouse | warehouse@sovann.kh | warehouse123 |
| Sales | sales@sovann.kh | sales123 |
| Staff | staff@sovann.kh | staff123 |

The system name, invoice exchange rate (default 4,000 KHR per USD), language, and date format are stored in the browser.

## Database

The app uses Lakebase Postgres on Neon through Prisma. `DATABASE_URL` is the pooled connection used by the app. `DATABASE_URL_UNPOOLED` is the direct connection Prisma uses for schema changes.

```bash
npm run db:setup
```

`neon init` and `neon deploy` write those variables into `.env`. Do not commit that file.

Sign-in uses Neon Auth (Managed Better Auth). `NEON_AUTH_BASE_URL` is the branch Auth URL, and `NEON_AUTH_COOKIE_SECRET` signs the session cookie. Roles and warehouses still live on the app user, matched by email.
