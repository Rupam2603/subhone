# Medicine Wholesaler Mobile App - Project Plan

## 1. App Overview

**App Name:** MediWholesale Pro  
**Platform:** Android & iOS (Flutter)  
**Target Users:** Medicine wholesalers, distributors, and pharmacy chains  
**Core Purpose:** Manage wholesale medicine inventory, orders, invoices, and customer relationships

---

## 2. Core Features

### 2.1 Authentication & User Management
- Phone/Email login with OTP
- Role-based access (Admin, Sales Manager, Delivery Partner, Accountant)
- Profile management with business details (GST, Drug License, FSSAI)
- Multi-location support for warehouse managers

### 2.2 Product Catalog Management
- Medicine database with:
  - Product name, generic name, composition
  - Manufacturer, batch number, expiry date
  - HSN codes, GST rates, schedule classification (H/D)
  - MRP, wholesale price, discounts
  - Minimum order quantity (MOQ)
  - Storage conditions (cold chain flag)
- Category hierarchy (Tablets, Capsules, Injections, Syrups, Surgical, etc.)
- barcode/QR scanning for quick product search
- Low stock and near-expiry alerts

### 2.3 Inventory & Warehouse Management
- Multi-warehouse stock tracking
- Batch-wise inventory with FIFO/FEFO logic
- Stock transfer between warehouses
- Damage/expiry stock recording
- Stock adjustment with approval workflow
- Real-time stock visibility across locations

### 2.4 Order Management
- Quick order placement by sales reps
- Recurring order templates for regular customers
- Order approval workflow (for high-value orders)
- Order status tracking (Pending → Approved → Picked → Packed → Dispatched → Delivered)
- Partial shipment support
- Backorder management

### 2.5 Customer Relationship Management (CRM)
- Customer database with:
  - Pharmacy/retailer details, license numbers
  - Credit limit management
  - Payment terms and history
  - Outstanding dues tracking
- Customer-specific pricing tiers
- Visit tracking for field sales reps
- Target vs achievement dashboard

### 2.6 Invoice & Billing
- GST-compliant invoice generation
- e-Way Bill integration (for interstate)
- Invoice sharing via WhatsApp/Email/SMS
- Payment receipt generation
- Credit note/debit note management
- Invoice history with filters

### 2.7 Payment & Accounting
- Multiple payment modes (Cash, Cheque, NEFT/RTGS, UPI)
- Outstanding ledger per customer
- Payment reminders (SMS/WhatsApp)
- Daily cash/bank reconciliation
- Salesman-wise commission tracking
- Expense management (travel, fuel, marketing)

### 2.8 Reporting & Analytics
- Daily sales report
- Product-wise sales analysis
- Customer-wise purchase history
- Inventory valuation report
- Expiry report (batch-wise)
- GST returns data (GSTR-1 ready format)
- Outstanding ageing report
- Salesman performance dashboard
- Profit & Loss analysis

### 2.9 Notifications & Alerts
- Low stock alerts
- Near-expiry alerts (90/60/30 days)
- New order notifications
- Payment due reminders
- Order dispatch updates
- Price change notifications

---

## 3. Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Flutter 3.x | Cross-platform mobile app |
| Language | Dart | Programming language |
| State Management | Riverpod / BLoC | App state management |
| Local Database | SQLite / Hive | Offline-first data storage |
| Backend | Firebase / Supabase / Custom Node.js/Django | Backend services |
| API | REST / GraphQL | Client-server communication |
| Authentication | Firebase Auth / Custom OAuth | User authentication |
| Push Notifications | Firebase Cloud Messaging | Real-time notifications |
| File Storage | Firebase Storage / AWS S3 | Invoice PDFs, images |
| PDF Generation | pdf / flutter_pdf | Invoice generation |
| Barcode Scanning | ML Kit / Camera | Product scanning |
| Maps | Google Maps API | Delivery tracking |
| Charts | FL Chart / Syncfusion | Analytics dashboards |

---

## 4. Project Structure

```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   └── constants/
│       ├── colors.dart
│       ├── strings.dart
│       └── dimensions.dart
├── core/
│   ├── theme/
│   ├── utils/
│   ├── widgets/
│   └── network/
│       ├── api_client.dart
│       ├── interceptors.dart
│       └── connectivity_checker.dart
├── data/
│   ├── models/
│   ├── repositories/
│   ├── datasources/
│   │   ├── local/
│   │   └── remote/
│   └── services/
│       ├── auth_service.dart
│       ├── sync_service.dart
│       └── notification_service.dart
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── inventory/
│   ├── orders/
│   ├── customers/
│   ├── invoices/
│   ├── payments/
│   ├── reports/
│   └── profile/
└── l10n/
```

---

## 5. Development Phases

### Phase 1: Foundation (Weeks 1-3)
- Project setup and architecture design
- Authentication module
- Onboarding flow
- Basic navigation and theme setup
- Network layer with offline support
- Local database schema design

### Phase 2: Core Business Logic (Weeks 4-8)
- Product catalog with CRUD operations
- Barcode/QR scanning
- Customer management
- Order creation and management
- Basic inventory tracking

### Phase 3: Transaction Flow (Weeks 9-12)
- Invoice generation (GST compliant)
- Payment recording
- Stock management
- Order fulfillment workflow
- Receipt and challan generation

### Phase 4: Advanced Features (Weeks 13-16)
- CRM and credit management
- Multi-warehouse support
- Advanced reporting
- Analytics dashboards
- Notification system

### Phase 5: Integration & Polish (Weeks 17-20)
- Third-party integrations (SMS gateway, payment gateway, e-Way Bill)
- Push notifications
- Offline sync optimization
- Performance optimization
- Security hardening

### Phase 6: Testing & Launch (Weeks 21-24)
- Unit tests (70%+ coverage)
- Integration tests
- User acceptance testing
- Beta testing with real wholesalers
- Play Store / App Store deployment

---

## 6. Database Design (Simplified)

### Core Tables
- **users** - App users with roles
- **customers** - Pharmacy/retailer details
- **products** - Medicine catalog
- **product_batches** - Batch-wise tracking
- **inventory** - Stock per warehouse
- **orders** - Order headers
- **order_items** - Order line items
- **invoices** - Invoice records
- **payments** - Payment transactions
- **stock_movements** - Audit trail
- **notifications** - In-app notifications

---

## 7. API Design (Key Endpoints)

```
POST   /auth/login
POST   /auth/otp/verify
GET    /products?search=&category=&page=
POST   /products/scan
GET    /customers
POST   /orders
GET    /orders/{id}
POST   /invoices/generate
GET    /invoices/{id}/pdf
GET    /reports/daily-sales
GET    /reports/expiry-alerts
POST   /payments/record
GET    /inventory/stock-levels
POST   /stock/transfer
```

---

## 8. UI/UX Design Principles

- **Offline-first:** App works without internet, syncs when connected
- **High contrast:** For warehouse lighting conditions
- **Large touch targets:** For field use with gloves
- **Dark mode:** For night-time warehouse operations
- **Quick actions:** Floating action buttons for common tasks
- **Search-first navigation:** Instant product/customer search
- **Minimal typing:** Barcode scanning, dropdowns, recent selections
- **Status indicators:** Color-coded order/inventory status

---

## 9. Security Considerations

- End-to-end encryption for sensitive data
- Secure token storage (flutter_secure_storage)
- Role-based UI rendering (prevent unauthorized actions)
- API request signing
- Biometric authentication option
- Device fingerprinting
- Sensitive data masking in logs
- Regular security audits

---

## 10. Testing Strategy

| Type | Tools | Coverage |
|------|-------|----------|
| Unit Tests | flutter_test, mockito | 70%+ |
| Widget Tests | flutter_test | Core screens |
| Integration Tests | integration_test | Critical flows |
| Manual Testing | Firebase Test Lab | Device matrix |

**Critical Test Cases:**
- Offline order creation and sync
- Invoice GST calculation accuracy
- Inventory deduction on order confirmation
- Multi-warehouse stock transfer
- Payment reconciliation

---

## 11. Deployment Strategy

### 11.1 Environments
- **Development:** Internal testing
- **Staging:** Pre-production with real data subset
- **Production:** Live environment

### 11.2 CI/CD
- GitHub Actions / GitLab CI
- Automated tests on PR
- Build and distribute to Firebase App Distribution
- Play Store Internal Testing track
- App Store TestFlight

### 11.3 Rollout Plan
1. Internal team beta (Week 20)
2. 5-10 pilot customers (Week 22)
3. Soft launch to 50 users (Week 23)
4. Full production launch (Week 24)

---

## 12. Compliance & Legal

- **Drug License:** App stores drug license details per customer
- **GST Compliance:** Invoice formats as per GST law
- **e-Way Bill:** Integration for interstate transport
- **Data Privacy:** GDPR/Indian data protection compliance
- **Audit Trail:** Complete transaction history for tax audits

---

## 13. Team & Resources

### Required Team
- Flutter Developer (2)
- Backend Developer (1-2)
- UI/UX Designer (1)
- QA Engineer (1)
- Project Manager (1)

### Third-Party Services
- SMS Gateway (Msg91/Twilio)
- Payment Gateway (Razorpay/Paytm)
- Maps/Navigation (Google Maps)
- Push Notifications (FCM)
- Analytics (Firebase Analytics)

---

## 14. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Offline sync conflicts | Last-write-wins with server reconciliation |
| GST rate changes | Admin-configurable tax rates |
| Large product catalog | Pagination + local caching |
| Network failures in rural areas | Robust retry + queue mechanism |
| Device compatibility | Minimum API level 21 (Android), iOS 12+ |

---

## 15. Success Metrics

- Order placement time < 30 seconds
- Invoice generation < 5 seconds
- Offline data sync success rate > 99%
- App crash rate < 0.1%
- User onboarding completion > 90%
- Daily active users (DAU) > 60%

---

## Next Steps

1. Set up Flutter project with recommended architecture
2. Configure development environment
3. Design database schema
4. Create UI wireframes for core screens
5. Build authentication module
6. Implement product catalog module
