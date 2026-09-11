# ⚡ SwiftPick Express - Real-Time Click & Collect Retail System

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.7-blue.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-ISC-purple.svg)](LICENSE)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

> An enterprise-grade, high-throughput Click & Collect retail fulfillment platform engineered for real-time operations, atomic stock consistency, and sub-30-second customer handovers.

---

## 🏗️ System Architecture & Real-Time Pipeline

```
  ┌────────────────────────────────────────────────────────┐
  │                 CUSTOMER WEB APP                       │
  │  - 15-Min Slot Selection    - Atomic Cart Locks (5-min) │
  │  - Dynamic QR & PIN Pass    - 'I Have Arrived' Alert   │
  └──────────────────────────┬─────────────────────────────┘
                             │ WebSocket / REST API
                             ▼
  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐
  │ FLOOR PICKER KDS │  │  CENTRAL EXPRES    │  │ EXPRESS COUNTER  │
  │ (Staff Tablet)   │◄─┤  BACKEND ENGINE    ├─►│ DISPLAY          │
  │ - Aisle Route    │  │  - Atomic Locks    │  │ - QR Check-in    │
  │ - 1-Tap Packing  │  │  - RBAC & SocketIO │  │ - Bin Locator    │
  └──────────────────┘  └─────────┬──────────┘  └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ DATABASE ENGINE  │
                        │ - Daily Counters │
                        │ - Role Access    │
                        └──────────────────┘
```

---

## 🚀 Free 1-Click Cloud Deployment

### Option 1: Deploy on Render (Recommended & 100% Free)
1. Fork or push this repository to your GitHub account (`krishnablji/swiftpick`).
2. Log into [Render.com](https://render.com/).
3. Click **New +** ➔ **Web Service**.
4. Connect the `swiftpick` repository.
5. Render will automatically detect the settings from `render.yaml`:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Click **Create Web Service**. Your live app with full WebSocket support will be ready in under 2 minutes!

### Option 2: Deploy on Railway
1. Go to [Railway.app](https://railway.app/).
2. Click **New Project** ➔ **Deploy from GitHub repo**.
3. Select `swiftpick`.
4. Railway automatically detects `package.json` and provisions your server.

---

## 💻 Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/krishnablji/swiftpick.git
cd swiftpick

# 2. Install dependencies
npm install

# 3. Seed initial demo catalog and accounts (optional, auto-runs on empty DB)
npm run seed

# 4. Start server
npm start
```

Open `http://localhost:3000` in your browser.

---

## 📱 4 High-Density Operational Screens

| Operational Role | Route Path | Core Capabilities |
| :--- | :--- | :--- |
| **🛒 Customer Storefront** | `/index.html` or `/customer` | Store & 15-min slot selector, aisle catalog, 5-min atomic reservation lock, substitution notes, dynamic HTML5 QR pickup pass & 4-digit PIN, arrival check-in. |
| **📋 Store Picker Tablet KDS** | `/picker.html` or `/picker` | High-density KDS sorted strictly in single-pass walking order (**Aisle 1 $\to$ Aisle 5**), 1-tap item checkboxes, physical bin/locker assignment (`Locker B-04`). |
| **⚡ Express Counter Cashier** | `/counter.html` or `/counter` | Camera QR scanner (`html5-qrcode`) or manual 4-digit PIN lookup, instant bin locator, visual arrival alert banner, sub-30s handover button. |
| **📊 Store Manager Operations** | `/manager.html` or `/manager` | One-click **Item 86** emergency stock override toggles, hourly slot quotas, average picking speed KPI, live socket event audit log. |

> **Evaluator Fast-Switch Bar**: A floating switcher bar is built into every page allowing you to test all 4 roles simultaneously across split browser windows!

---

## 🧪 Technical Features & Verification

### 1. Atomic Inventory Locks (Prevents Overbooking)
- When a customer adds items to their cart, a 5-minute temporary reservation hold is atomically placed on the stock.
- Prevents walk-in store visitors or simultaneous app users from double-booking flash-sale or low-stock items.
- Run the concurrency verification test:
  ```bash
  npm run test:concurrency
  ```
  ```text
  🧪 Starting Atomic Inventory Lock & Concurrency Verification...
  Result User Alpha: 200 LOCKED SUCCESS
  Result User Beta:  409 Insufficient stock. Only 0 available.
  ✅ PASS: Exactly 1 customer acquired the 5-minute atomic lock. Overbooking prevented!
  ```

### 2. Sequential Express Order Numbers (`S01-#001`)
- Employs an atomic daily counter scheme `{ branchId, date: "YYYY-MM-DD", seq: Number }` to generate collision-free daily sequential pickup codes (`S01-#001`, `S01-#002`...).

### 3. Socket.io Inter-System Event Pipeline
- `new_pickup_order`: Customer payment ➔ Picker Tablet sounds alert and inserts pick ticket.
- `order_packed_bin_assigned`: Picker finishes packing ➔ Express Counter displays ready order in holding locker.
- `customer_arrived`: Customer taps "I Have Arrived" ➔ Flashes urgent visual banner on counter display.
- `item_86_out_of_stock`: Staff taps "Out of Stock" ➔ Instantly disables `+` buttons on all active customer apps in real-time.

---

## 🔑 Demo Credentials

| Role | Email | Password | Persona |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@swiftpick.com` | `pass123` | Alex Johnson |
| **Store Picker** | `picker@swiftpick.com` | `pass123` | Sam Rivera (Floor Lead) |
| **Cashier** | `cashier@swiftpick.com` | `pass123` | Elena Rostova |
| **Store Manager** | `manager@swiftpick.com` | `pass123` | David Chen (Store GM) |

---

## 📄 License
ISC License. Built for production-ready retail performance.
