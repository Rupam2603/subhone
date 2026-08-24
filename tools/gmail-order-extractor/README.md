# 📦 Gmail Order Details Extractor & Expense Reporter

An automated Node.js CLI tool that discovers, downloads, and extracts order & receipt details from your Gmail inbox (including HTML emails and PDF invoice attachments), normalizes order data, and generates structured **PDF & Markdown expense reports**.

---

## ✨ Features

- 🔐 **Secure Google OAuth2**: Connects via official `gmail.readonly` scope without sharing email passwords.
- 🔍 **Intelligent Email Discovery**: Searches for order confirmations, receipts, invoices, and shipping notifications with customizable date ranges and merchant filters.
- 🧾 **Multi-Engine Parsing**: Extracts Order IDs, line items, taxes, shipping, totals, tracking numbers (BlueDart, Delhivery, UPS, FedEx, etc.), and payment methods.
- 📑 **PDF Attachment Parsing**: Inspects attached PDF invoices using `pdf-parse` when order details are not in the email body.
- 📊 **Executive Summary & Analytics**: Computes total spend, order count, breakdown by merchant, and monthly spending charts.
- 📑 **Professional PDF & Markdown Reports**: Generates styled PDF reports and Markdown tables for quick sharing and bookkeeping.
- 🧪 **Instant Demo Mode**: Includes built-in demo data generator for verification without needing API credentials.

---

## 🚀 Quick Start

### 1. Installation

From the `tools/gmail-order-extractor` directory:

```bash
npm install
```

### 2. Instant Demo / Test Run

Generate a sample PDF and Markdown report immediately to verify output styling:

```bash
npm run start -- demo
```

Output files will be generated in `./output/`:
- `output/sample_order_report_YYYY-MM-DD.pdf`
- `output/sample_order_report_YYYY-MM-DD.md`

---

## 🔑 Gmail API Setup (One-Time Setup)

To extract live emails from your Gmail inbox:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Gmail-Order-Extractor`).
3. Enable the **Gmail API** under **APIs & Services > Library**.
4. Go to **APIs & Services > OAuth consent screen**:
   - User Type: **External**
   - Add test user: Your Gmail address (e.g., `subhonehealthgroup@gmail.com`)
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
5. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**
   - Application type: **Desktop App**
   - Download the JSON credentials file and save it as `credentials.json` in `tools/gmail-order-extractor/`.

---

## 💻 CLI Commands

### 1. Authenticate with Gmail
```bash
node bin/cli.js auth
```
*(Opens a browser window to approve read-only Gmail access and saves `token.json`)*

### 2. Fetch Order Emails
```bash
# Fetch orders from the last 30 days
node bin/cli.js fetch --days 30

# Fetch orders with custom merchant filter
node bin/cli.js fetch --days 90 --merchants amazon,flipkart,subhone,apple

# Custom date range
node bin/cli.js fetch --after 2026-01-01 --before 2026-08-24
```

### 3. Parse Downloaded Emails
```bash
node bin/cli.js parse
```
*(Parses downloaded emails into canonical JSON stored in `./data/orders.json`)*

### 4. Export Reports
```bash
# Export both PDF and Markdown
node bin/cli.js export --format both

# Export PDF only
node bin/cli.js export --format pdf --output ./reports
```

### 5. All-in-One Pipeline Command
```bash
# Fetch, parse, and export in a single step
node bin/cli.js run --days 30 --format both
```

---

## 📂 Output Data Schema

Parsed orders are normalized in `./data/orders.json`:

```json
{
  "meta": {
    "generated_at": "2026-08-24T17:30:00.000Z",
    "order_count": 14,
    "total_spend": 12850.50,
    "merchants_count": 3,
    "merchant_breakdown": {
      "SubhOne Health": { "count": 5, "spend": 4200 },
      "Amazon": { "count": 7, "spend": 7450.50 }
    }
  },
  "orders": [
    {
      "order_id": "ORD-94821",
      "merchant": "SubhOne Health",
      "date": "2026-08-24T10:30:00.000Z",
      "items": [
        { "name": "Paracetamol 650mg", "qty": 2, "price": 65 }
      ],
      "subtotal": 130,
      "tax": 0,
      "shipping": 0,
      "total": 130,
      "tracking": [
        { "carrier": "BlueDart", "number": "7749210948", "url": "https://www.bluedart.com/tracking?trackNumber=7749210948" }
      ],
      "payment": {
        "method": "UPI",
        "last4": ""
      }
    }
  ]
}
```
