// SwiftPick Express - Customer Front-End Controller

let products = [];
let cart = {}; // { [productId]: { qty, note } }
let activeOrder = null;
let lockInterval = null;
let currentCategory = 'all';
let qrcodeInstance = null;

const socket = io();

// Render Top Multi-Role Switcher Bar
document.addEventListener('DOMContentLoaded', () => {
  renderSharedNav('customer');
  initSocketListeners();
  loadProducts();
  checkExistingTicket();
});

// --- SOCKET.IO EVENT PIPELINE ---
function initSocketListeners() {
  socket.on('connect', () => {
    console.log('[Socket] Connected to server as customer.');
    const pill = document.getElementById('ws-status-text');
    if (pill) pill.textContent = 'Socket: Online';
  });

  socket.on('disconnect', () => {
    const pill = document.getElementById('ws-status-text');
    if (pill) pill.textContent = 'Socket: Reconnecting...';
  });

  // Real-Time Item 86 Override (Out of Stock / Restocked)
  socket.on('item_86_out_of_stock', (data) => {
    console.log('[Socket] Item 86 updated:', data);
    const prod = products.find(p => p.id === data.productId);
    if (prod) {
      prod.isAvailable = data.isAvailable;
      prod.stockQuantity = data.stockQuantity;
      prod.availableStock = data.availableStock;
      renderProducts();

      // If customer has this item in cart and it became unavailable, notify them
      if (!data.isAvailable && cart[data.productId]) {
        alert(`Notice: Item "${data.title}" was just marked out-of-stock by store staff.`);
      }
    }
  });

  // Real-Time Inventory Stock Updates (e.g. locks taken/released)
  socket.on('inventory_lock_updated', (data) => {
    const prod = products.find(p => p.id === data.productId);
    if (prod) {
      prod.availableStock = data.availableStock;
      updateStockBadgeOnCard(prod.id, data.availableStock);
    }
  });

  // Real-Time Status changes on customer active order
  socket.on('order_status_changed', (order) => {
    if (activeOrder && activeOrder.orderCode === order.orderCode) {
      console.log('[Socket] Active order status changed:', order.status);
      activeOrder = order;
      updateTicketUI(order);
      playChime('success');
    }
  });

  socket.on('order_packed_bin_assigned', (order) => {
    if (activeOrder && activeOrder.orderCode === order.orderCode) {
      console.log('[Socket] Order packed into bin:', order.holdingBin);
      activeOrder = order;
      updateTicketUI(order);
      playChime('success');
    }
  });
}

// --- PRODUCTS & CATALOG ---
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      products = data.products;
      renderProducts();
    }
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function filterCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('#category-filter-bar button').forEach(b => {
    b.className = 'btn btn-secondary';
  });
  if (btn) btn.className = 'btn btn-primary';
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('product-grid');
  if (!container) return;

  const filtered = currentCategory === 'all'
    ? products
    : products.filter(p => p.category.toLowerCase().includes(currentCategory.toLowerCase()));

  container.innerHTML = filtered.map(prod => {
    const qty = cart[prod.id]?.qty || 0;
    const isOut = !prod.isAvailable || prod.availableStock <= 0;
    const isLow = prod.isAvailable && prod.availableStock > 0 && prod.availableStock <= 3;

    let stockBadge = `<span class="stock-tag in-stock" id="badge-${prod.id}">In Stock (${prod.availableStock})</span>`;
    if (!prod.isAvailable) {
      stockBadge = `<span class="stock-tag out-stock" id="badge-${prod.id}">Out of Stock (86)</span>`;
    } else if (prod.availableStock <= 0) {
      stockBadge = `<span class="stock-tag out-stock" id="badge-${prod.id}">Sold Out</span>`;
    } else if (isLow) {
      stockBadge = `<span class="stock-tag low-stock" id="badge-${prod.id}">Only ${prod.availableStock} Left</span>`;
    }

    return `
      <article class="product-card" id="card-${prod.id}">
        <div class="product-img-wrap">
          <img src="${prod.imageUrl}" alt="${prod.title}" class="product-img" loading="lazy">
          <span class="aisle-tag">${prod.aisleLocation}</span>
          ${stockBadge}
        </div>
        <div class="product-info">
          <div class="product-category">${prod.category}</div>
          <h3 class="product-title">${prod.title}</h3>
          <p class="product-desc">${prod.description || ''}</p>
          <div class="product-bottom-row">
            <div class="product-price">$${prod.price.toFixed(2)}</div>
            <div class="qty-stepper">
              <button class="qty-btn" onclick="changeQty('${prod.id}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
              <div class="qty-display" id="qty-val-${prod.id}">${qty}</div>
              <button class="qty-btn" id="btn-plus-${prod.id}" onclick="changeQty('${prod.id}', 1)" ${isOut || qty >= prod.availableStock ? 'disabled' : ''}>+</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function updateStockBadgeOnCard(productId, availableStock) {
  const badge = document.getElementById(`badge-${productId}`);
  const plusBtn = document.getElementById(`btn-plus-${productId}`);
  const prod = products.find(p => p.id === productId);
  if (!badge || !prod) return;

  if (!prod.isAvailable || availableStock <= 0) {
    badge.className = 'stock-tag out-stock';
    badge.textContent = !prod.isAvailable ? 'Out of Stock (86)' : 'Sold Out';
    if (plusBtn) plusBtn.disabled = true;
  } else if (availableStock <= 3) {
    badge.className = 'stock-tag low-stock';
    badge.textContent = `Only ${availableStock} Left`;
    const curQty = cart[productId]?.qty || 0;
    if (plusBtn) plusBtn.disabled = curQty >= availableStock;
  } else {
    badge.className = 'stock-tag in-stock';
    badge.textContent = `In Stock (${availableStock})`;
    const curQty = cart[productId]?.qty || 0;
    if (plusBtn) plusBtn.disabled = curQty >= availableStock;
  }
}

// --- CART & ATOMIC 5-MINUTE INVENTORY LOCKS ---
async function changeQty(productId, delta) {
  const current = cart[productId]?.qty || 0;
  const newQty = Math.max(0, current + delta);

  if (newQty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = {
      qty: newQty,
      note: cart[productId]?.note || ''
    };
  }

  // Update card display
  const qtyEl = document.getElementById(`qty-val-${productId}`);
  if (qtyEl) qtyEl.textContent = newQty;

  updateCartDock();

  // Atomically acquire or adjust the 5-minute inventory lock
  await syncAtomicCartLock();
  renderProducts();
}

async function syncAtomicCartLock() {
  const items = Object.keys(cart).map(pid => ({
    productId: pid,
    qty: cart[pid].qty
  }));

  if (items.length === 0) {
    // Clear lock
    clearInterval(lockInterval);
    document.getElementById('lock-banner').style.display = 'none';
    try {
      await fetch('/api/cart/release', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    } catch (e) {}
    return;
  }

  try {
    const res = await fetch('/api/cart/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();

    if (!data.success) {
      alert(`⚠️ Inventory Hold Warning: ${data.error}`);
      // Revert offending item
      if (data.productId && cart[data.productId]) {
        if (data.availableStock > 0) {
          cart[data.productId].qty = data.availableStock;
        } else {
          delete cart[data.productId];
        }
        updateCartDock();
        renderProducts();
      }
      return;
    }

    // Lock acquired: Start 5-minute countdown display
    startLockTimer(data.expiresAt);

  } catch (err) {
    console.error('Lock sync failed:', err);
  }
}

function startLockTimer(expiresAt) {
  clearInterval(lockInterval);
  const banner = document.getElementById('lock-banner');
  const timerText = document.getElementById('lock-countdown');
  banner.style.display = 'flex';

  function tick() {
    const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const mins = String(Math.floor(diff / 60)).padStart(2, '0');
    const secs = String(diff % 60).padStart(2, '0');
    timerText.textContent = `${mins}:${secs}`;

    if (diff <= 0) {
      clearInterval(lockInterval);
      banner.style.display = 'none';
      alert('Your 5-minute inventory reservation has expired. Items were released to the store floor.');
      cart = {};
      updateCartDock();
      renderProducts();
    }
  }

  tick();
  lockInterval = setInterval(tick, 1000);
}

function updateCartDock() {
  const dock = document.getElementById('cart-dock');
  const countEl = document.getElementById('dock-item-count');
  const totalEl = document.getElementById('dock-total-price');

  let totalCount = 0;
  let totalPrice = 0;

  Object.keys(cart).forEach(pid => {
    const prod = products.find(p => p.id === pid);
    if (prod) {
      totalCount += cart[pid].qty;
      totalPrice += prod.price * cart[pid].qty;
    }
  });

  if (totalCount > 0) {
    dock.style.display = 'flex';
    countEl.textContent = totalCount;
    totalEl.textContent = totalPrice.toFixed(2);
  } else {
    dock.style.display = 'none';
  }
}

// --- CART MODAL & SUBSTITUTION NOTES ---
function openCartModal() {
  const modal = document.getElementById('cart-modal');
  const container = document.getElementById('cart-items-container');
  let subtotal = 0;

  container.innerHTML = Object.keys(cart).map(pid => {
    const prod = products.find(p => p.id === pid);
    if (!prod) return '';
    const item = cart[pid];
    const lineTotal = prod.price * item.qty;
    subtotal += lineTotal;

    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div>
            <strong>${prod.title}</strong>
            <div style="font-size: 0.75rem; color: var(--accent); font-family: var(--font-mono);">${prod.aisleLocation}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800;">$${lineTotal.toFixed(2)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${item.qty} x $${prod.price.toFixed(2)}</div>
          </div>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
            📝 Substitution / Picker Note:
          </label>
          <input type="text"
            placeholder="e.g., 'Select green bananas only' or 'Firm avocado'"
            value="${item.note || ''}"
            onchange="updateItemNote('${pid}', this.value)"
            class="custom-select"
            style="width: 100%; font-size: 0.85rem; padding: 0.4rem 0.75rem;">
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cart-grand-total').textContent = `$${subtotal.toFixed(2)}`;
  modal.classList.add('active');
}

function updateItemNote(productId, note) {
  if (cart[productId]) {
    cart[productId].note = note;
  }
}

function closeCartModal() {
  document.getElementById('cart-modal').classList.remove('active');
}

// --- CHECKOUT & SIMULATED PAYMENT ---
function openCheckoutModal() {
  closeCartModal();
  const total = document.getElementById('dock-total-price').textContent;
  document.getElementById('pay-amount-display').textContent = total;
  document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('active');
}

async function executePayment() {
  const btn = document.getElementById('btn-pay-now');
  btn.disabled = true;
  btn.textContent = 'Processing Payment...';

  const slot = document.getElementById('slot-select').value;
  const branchId = document.getElementById('branch-select').value;
  const customerName = document.getElementById('cust-name-input').value;
  const customerPhone = document.getElementById('cust-phone-input').value;

  const items = Object.keys(cart).map(pid => ({
    productId: pid,
    qty: cart[pid].qty,
    note: cart[pid].note || ''
  }));

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        pickupSlot: slot,
        branchId,
        customerName,
        customerPhone,
        paymentMethod: 'card_mock'
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert(`Order Failed: ${data.error}`);
      btn.disabled = false;
      btn.textContent = 'Retry Payment';
      return;
    }

    // Success! Save order and show pickup pass
    activeOrder = data.order;
    localStorage.setItem('swiftpick_active_order', JSON.stringify(activeOrder));

    // Clear cart and locks
    cart = {};
    clearInterval(lockInterval);
    document.getElementById('lock-banner').style.display = 'none';
    updateCartDock();
    renderProducts();

    // Subscribe to real-time order updates
    socket.emit('subscribe_order', activeOrder.orderCode);

    closeCheckoutModal();
    playChime('success');
    openTicketModal();

  } catch (err) {
    alert(`Payment Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pay & Generate Pass';
  }
}

// --- DIGITAL QR PICKUP TICKET & VERIFICATION ---
function openTicketModal() {
  if (!activeOrder) return;
  const modal = document.getElementById('ticket-modal');
  updateTicketUI(activeOrder);
  modal.classList.add('active');
}

function closeTicketModal() {
  document.getElementById('ticket-modal').classList.remove('active');
}

function updateTicketUI(order) {
  document.getElementById('ticket-order-code').textContent = order.orderCode;
  document.getElementById('ticket-pin-val').textContent = order.pin || '4821';

  // Active top button
  const topBtn = document.getElementById('btn-view-ticket');
  topBtn.style.display = 'inline-flex';
  document.getElementById('active-ticket-code').textContent = order.orderCode;

  // Render or update QR Code Canvas
  const qrContainer = document.getElementById('ticket-qrcode');
  qrContainer.innerHTML = '';
  // Encodes JSON payload for camera scanner
  const qrPayload = JSON.stringify({
    orderCode: order.orderCode,
    pin: order.pin,
    customerName: order.customerName,
    branchId: order.branchId
  });

  if (window.QRCode) {
    qrcodeInstance = new QRCode(qrContainer, {
      text: qrPayload,
      width: 170,
      height: 170,
      colorDark: '#0b0f19',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // Update Holding Bin Badge
  const binContainer = document.getElementById('ticket-bin-container');
  const binBadge = document.getElementById('ticket-bin-badge');
  if (order.holdingBin) {
    binContainer.style.display = 'block';
    binBadge.textContent = order.holdingBin;
  } else {
    binContainer.style.display = 'none';
  }

  // Update Status Stepper
  const steps = ['placed', 'picking', 'ready', 'collected'];
  const currentIndex = steps.indexOf(order.status);

  steps.forEach((step, idx) => {
    const el = document.getElementById(`step-${step}`);
    if (el) {
      el.className = 'step-item';
      if (idx < currentIndex) el.classList.add('done');
      else if (idx === currentIndex) el.classList.add('active');
    }
  });

  // Arrived Button state
  const arrivedBtn = document.getElementById('btn-arrived');
  const arrivedNotice = document.getElementById('arrived-notice');
  if (order.customerArrived) {
    arrivedBtn.disabled = true;
    arrivedBtn.textContent = '✓ Arrival Confirmed (Counter Alerted)';
    arrivedNotice.style.display = 'block';
  } else {
    arrivedBtn.disabled = false;
    arrivedBtn.textContent = '📍 I Have Arrived at Store (Alert Counter)';
    arrivedNotice.style.display = 'none';
  }
}

async function triggerCustomerArrival() {
  if (!activeOrder) return;
  const btn = document.getElementById('btn-arrived');
  btn.disabled = true;
  btn.textContent = 'Alerting counter...';

  try {
    const res = await fetch(`/api/orders/${activeOrder.id}/arrived`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      activeOrder = data.order;
      updateTicketUI(activeOrder);
    }
  } catch (err) {
    console.error('Failed to alert arrival:', err);
    btn.disabled = false;
  }
}

function checkExistingTicket() {
  const saved = localStorage.getItem('swiftpick_active_order');
  if (saved) {
    try {
      activeOrder = JSON.parse(saved);
      if (activeOrder && activeOrder.status !== 'collected') {
        const topBtn = document.getElementById('btn-view-ticket');
        topBtn.style.display = 'inline-flex';
        document.getElementById('active-ticket-code').textContent = activeOrder.orderCode;
        socket.emit('subscribe_order', activeOrder.orderCode);
      }
    } catch (e) {}
  }
}
