const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'db_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory master state
const state = {
  users: [],
  products: [],
  orders: [],
  dailyCounters: {}, // Key: `${branchId}_${date}` -> seq
  reservations: [],  // [{ id, productId, qty, customerId, expiresAt }]
  slotQuotas: {}     // Key: `${branchId}_${date}_${slot}` -> { booked, max }
};

// Persistent flush helper
let isSaving = false;
let needsSaveAgain = false;

function persist() {
  if (isSaving) {
    needsSaveAgain = true;
    return;
  }
  isSaving = true;
  try {
    const payload = JSON.stringify(state, null, 2);
    fs.writeFileSync(DATA_FILE, payload, 'utf8');
  } catch (err) {
    console.error('[DB] Failed to persist data to disk:', err.message);
  } finally {
    isSaving = false;
    if (needsSaveAgain) {
      needsSaveAgain = false;
      persist();
    }
  }
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      const loaded = JSON.parse(content);
      state.users = loaded.users || [];
      state.products = loaded.products || [];
      state.orders = loaded.orders || [];
      state.dailyCounters = loaded.dailyCounters || {};
      state.reservations = loaded.reservations || [];
      state.slotQuotas = loaded.slotQuotas || {};
      console.log(`[DB] Loaded state: ${state.products.length} products, ${state.orders.length} orders, ${state.users.length} users.`);
    } catch (e) {
      console.warn('[DB] Could not parse existing store file, starting clean:', e.message);
    }
  }
}

// Atomic Locks & Operations
const db = {
  state,
  load,
  persist,

  // --- USERS ---
  findUserByEmail: (email) => state.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findUserById: (id) => state.users.find(u => u.id === id),
  createUser: (userData) => {
    state.users.push(userData);
    persist();
    return userData;
  },

  // --- PRODUCTS & INVENTORY ---
  getAllProducts: () => {
    const now = Date.now();
    // Clean expired reservations inline
    state.reservations = state.reservations.filter(r => r.expiresAt > now);

    // Compute active reservation quantities per product
    const reservedMap = {};
    for (const res of state.reservations) {
      reservedMap[res.productId] = (reservedMap[res.productId] || 0) + res.qty;
    }

    return state.products.map(p => {
      const reserved = reservedMap[p.id] || 0;
      const availableStock = Math.max(0, p.stockQuantity - reserved);
      return {
        ...p,
        reservedStock: reserved,
        availableStock,
        isActuallyAvailable: p.isAvailable && availableStock > 0
      };
    });
  },

  getProductById: (id) => {
    const now = Date.now();
    const p = state.products.find(item => item.id === id);
    if (!p) return null;
    const reserved = state.reservations
      .filter(r => r.productId === id && r.expiresAt > now)
      .reduce((sum, r) => sum + r.qty, 0);
    const availableStock = Math.max(0, p.stockQuantity - reserved);
    return {
      ...p,
      reservedStock: reserved,
      availableStock,
      isActuallyAvailable: p.isAvailable && availableStock > 0
    };
  },

  setProductAvailability: (id, isAvailable) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod) return null;
    prod.isAvailable = Boolean(isAvailable);
    persist();
    return prod;
  },

  updateProductStock: (id, newStockQuantity) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod) return null;
    prod.stockQuantity = Math.max(0, Number(newStockQuantity));
    persist();
    return prod;
  },

  // --- ATOMIC INVENTORY LOCKS (5-MIN RESERVATION) ---
  /**
   * Atomically acquires a 5-minute lock on requested items for a customer.
   * Prevents race conditions / overbooking when multiple shoppers add the last items.
   */
  atomicReserveItems: (customerId, items) => {
    const now = Date.now();
    // 1. Purge expired locks first
    state.reservations = state.reservations.filter(r => r.expiresAt > now);

    // 2. Compute current reserved map
    const reservedMap = {};
    for (const res of state.reservations) {
      if (res.customerId !== customerId) { // don't double-count caller's own current locks
        reservedMap[res.productId] = (reservedMap[res.productId] || 0) + res.qty;
      }
    }

    // 3. Verify all requested items have sufficient available stock
    for (const item of items) {
      const prod = state.products.find(p => p.id === item.productId);
      if (!prod) {
        return { success: false, error: `Product not found: ${item.productId}` };
      }
      if (!prod.isAvailable) {
        return { success: false, error: `Item "${prod.title}" has been marked out-of-stock (Item 86).` };
      }
      const otherReserved = reservedMap[item.productId] || 0;
      const realAvailable = prod.stockQuantity - otherReserved;
      if (item.qty > realAvailable) {
        return {
          success: false,
          error: `Insufficient stock for "${prod.title}". Only ${Math.max(0, realAvailable)} available (currently held by other shoppers).`,
          productId: prod.id,
          availableStock: Math.max(0, realAvailable)
        };
      }
    }

    // 4. Atomically replace or upsert customer's reservation holds
    // Remove caller's previous reservations
    state.reservations = state.reservations.filter(r => r.customerId !== customerId);

    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = now + ttlMs;

    const newLocks = items.map(item => ({
      id: 'lock_' + Math.random().toString(36).substring(2, 9),
      productId: item.productId,
      qty: item.qty,
      customerId,
      expiresAt
    }));

    state.reservations.push(...newLocks);
    persist();

    return {
      success: true,
      expiresAt,
      ttlSeconds: 300,
      reservations: newLocks
    };
  },

  releaseCustomerReservations: (customerId) => {
    const beforeCount = state.reservations.length;
    state.reservations = state.reservations.filter(r => r.customerId !== customerId);
    if (state.reservations.length !== beforeCount) {
      persist();
    }
  },

  cleanExpiredLocks: () => {
    const now = Date.now();
    const active = state.reservations.filter(r => r.expiresAt > now);
    const expiredCount = state.reservations.length - active.length;
    if (expiredCount > 0) {
      state.reservations = active;
      persist();
    }
    return expiredCount;
  },

  // --- SEQUENTIAL EXPRESS ORDER CODES (T01-#001 or S01-#001) ---
  /**
   * Atomic sequential numbering scheme ({ branchId, date, seq })
   * Generates codes like S01-#001, S01-#002, etc.
   */
  getNextOrderCode: (branchId = 'S01') => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const key = `${branchId}_${dateStr}`;

    const currentSeq = (state.dailyCounters[key] || 0) + 1;
    state.dailyCounters[key] = currentSeq;
    persist();

    const paddedSeq = String(currentSeq).padStart(3, '0');
    return `${branchId}-#${paddedSeq}`;
  },

  // --- ORDERS ---
  createOrder: (orderData) => {
    state.orders.unshift(orderData); // newest first
    persist();
    return orderData;
  },

  getAllOrders: () => state.orders,

  getOrderById: (id) => state.orders.find(o => o.id === id || o.orderCode === id),

  updateOrder: (id, updates) => {
    const order = state.orders.find(o => o.id === id || o.orderCode === id);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date().toISOString() });
    persist();
    return order;
  },

  // Slot Quotas (15-min collection windows)
  getSlotAvailability: (branchId, dateStr, slot) => {
    const key = `${branchId}_${dateStr}_${slot}`;
    const entry = state.slotQuotas[key] || { booked: 0, max: 12 };
    return {
      slot,
      booked: entry.booked,
      max: entry.max,
      available: Math.max(0, entry.max - entry.booked)
    };
  },

  incrementSlotBooking: (branchId, dateStr, slot) => {
    const key = `${branchId}_${dateStr}_${slot}`;
    if (!state.slotQuotas[key]) {
      state.slotQuotas[key] = { booked: 0, max: 12 };
    }
    state.slotQuotas[key].booked += 1;
    persist();
    return state.slotQuotas[key];
  }
};

// Initialize load
db.load();

module.exports = db;
