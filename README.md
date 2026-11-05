# Smart Kirana

Smart Kirana is a store management and point-of-sale app for neighborhood grocery shops. It helps shop owners manage products and stock, bill customers, track sales and profit, and follow up on outstanding credit.

## Features

- **Dashboard:** View today's and monthly sales and profit, stock value, low- and out-of-stock counts, customer balances, and charts for recent sales and top-selling products.
- **Products and stock:** Add, edit, search, and organize products by category. Store barcodes, purchase and selling prices, and current and minimum stock levels.
- **Point of sale:** Find products by name or barcode, build a bill, select a customer, apply a discount, and record payment by UPI, cash, card, or credit. The bill shows estimated profit and checks available stock.
- **UPI payments:** Save merchant details and a UPI ID, preview its QR code, and show a payment QR during checkout.
- **Customer credit:** Maintain customer details, credit limits, and pending balances. Open a prefilled WhatsApp reminder for a customer with an outstanding balance.
- **Account access:** Sign in or create an account, reset a forgotten password, and manage shop and merchant details.

## Technology

- React 19 and TypeScript
- TanStack Start and TanStack Router
- Tailwind CSS and shadcn/ui components
- TanStack Query for client-side data fetching and caching
- Lovable Cloud for authentication and the PostgreSQL database
- Recharts for dashboard charts

## Run locally

You'll need [Bun](https://bun.sh/) and the project's Lovable Cloud environment configuration.

```bash
bun install
bun run dev
```

The development server prints the local address when it starts. Keep environment values private; do not commit `.env` or share publishable configuration as if it were a secret key.

## Available scripts

```bash
bun run dev      # Start the development server
bun run build    # Create a production build
bun run preview  # Preview the production build
bun run lint     # Run ESLint
```

## Notes

- WhatsApp reminders open a prepared message for the shopkeeper to review and send; the app does not send messages automatically.
- UPI QR codes are generated from the merchant's saved UPI ID.
- The dashboard and checkout require a signed-in account and configured Cloud data.