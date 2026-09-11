// SwiftPick Express - Store Manager Command Portal Controller

let products = [];
let analytics = null;
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
  renderSharedNav('manager');
  initSocket();
  refreshDashboard();
});

function initSocket() {
  socket.on('connect', () => {
    console.log('[Socket] Manager portal connected.');
    socket.emit('join_role_room', 'manager');
    const pill = document.getElementById('ws-status-text');
    if (pill) pill.textContent = 'Socket: Online (Manager Suite)';
    addAuditLog('SYSTEM', 'Manager command suite connected to WebSocket gateway.');
  });

  socket.on('new_pickup_order', (order) => {
    addAuditLog('ORDER_PLACED', `New order ${order.orderCode} placed by ${order.customerName} ($${order.totalAmount}).`);
    refreshMetricsOnly();
  });

  socket.on('order_packed_bin_assigned', (order) => {
    addAuditLog('BIN_ASSIGNED', `Order ${order.orderCode} packed by floor picker and assigned to ${order.holdingBin}.`);
    refreshMetricsOnly();
  });

  socket.on('customer_arrived', (data) => {
    addAuditLog('CUSTOMER_ARRIVED', `Customer ${data.customerName} checked in at store for ${data.orderCode} (${data.holdingBin}).`);
    refreshMetricsOnly();
  });

  socket.on('item_86_out_of_stock', (data) => {
    addAuditLog('ITEM_86', `SKU "${data.title}" status changed: ${data.isAvailable ? 'In-Stock' : 'OUT-OF-STOCK (86)'}.`);
    // Refresh table toggle if on screen
    const prod = products.find(p => p.id === data.productId);
    if (prod) {
      prod.isAvailable = data.isAvailable;
      renderStockTable();
    }
  });

  socket.on('order_status_changed', (order) => {
    addAuditLog('STATUS_CHANGE', `Order ${order.orderCode} transitioned to status: ${order.status.toUpperCase()}.`);
    refreshMetricsOnly();
  });
}

function addAuditLog(eventType, message) {
  const feed = document.getElementById('activity-log-feed');
  if (!feed) return;
  const time = new Date().toLocaleTimeString();

  const colorMap = {
    'ITEM_86': '#ef4444',
    'ORDER_PLACED': '#f59e0b',
    'BIN_ASSIGNED': '#06b6d4',
    'CUSTOMER_ARRIVED': '#ec4899',
    'STATUS_CHANGE': '#10b981',
    'SYSTEM': '#9ca3af'
  };

  const badgeColor = colorMap[eventType] || '#9ca3af';

  const entry = document.createElement('div');
  entry.style.padding = '0.5rem 0.75rem';
  entry.style.background = 'rgba(255,255,255,0.03)';
  entry.style.border = '1px solid rgba(255,255,255,0.05)';
  entry.style.borderRadius = '6px';
  entry.innerHTML = `
    <span style="color: var(--text-dim); margin-right: 0.5rem;">[${time}]</span>
    <span style="background: ${badgeColor}20; color: ${badgeColor}; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; margin-right: 0.5rem; font-size: 0.75rem;">
      ${eventType}
    </span>
    <span style="color: #fff;">${message}</span>
  `;

  feed.prepend(entry);
}

async function refreshDashboard() {
  await Promise.all([loadProducts(), loadAnalytics()]);
}

async function refreshMetricsOnly() {
  try {
    const res = await fetch('/api/manager/analytics');
    const data = await res.json();
    if (data.success) {
      analytics = data;
      renderKpis(data.metrics);
    }
  } catch (e) {}
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      products = data.products;
      renderStockTable();
    }
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch('/api/manager/analytics');
    const data = await res.json();
    if (data.success) {
      analytics = data;
      renderKpis(data.metrics);
      renderSlotsGrid(data.slotCapacities);
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function renderKpis(m) {
  if (!m) return;
  document.getElementById('metric-pick-speed').textContent = m.avgPickSpeedMin || '4.1';
  document.getElementById('metric-settled-count').textContent = m.totalCollected + m.totalReady;
  document.getElementById('metric-active-count').textContent = m.totalPlaced + m.totalPicking;
  document.getElementById('metric-net-revenue').textContent = m.netRevenue.toFixed(2);
  document.getElementById('metric-active-locks').textContent = m.activeLocksCount;
}

// PANEL 1: ITEM 86 OVERRIDE TABLE
function renderStockTable(filter = '') {
  const tbody = document.getElementById('stock-table-tbody');
  if (!tbody) return;

  const filtered = filter
    ? products.filter(p => p.title.toLowerCase().includes(filter.toLowerCase()) || p.aisleLocation.toLowerCase().includes(filter.toLowerCase()))
    : products;

  tbody.innerHTML = filtered.map(prod => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${prod.imageUrl}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">
          <div>
            <strong style="color: #fff;">${prod.title}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${prod.id}</div>
          </div>
        </div>
      </td>
      <td><span class="kds-aisle-pill">${prod.aisleLocation}</span></td>
      <td><span style="color: var(--text-muted); font-size: 0.85rem;">${prod.category}</span></td>
      <td style="font-family: var(--font-mono); font-weight: 700;">$${prod.price.toFixed(2)}</td>
      <td>
        <span style="font-family: var(--font-mono); color: ${prod.availableStock > 0 ? 'var(--primary)' : 'var(--danger)'}; font-weight: 700;">
          ${prod.availableStock}
        </span>
        ${prod.reservedStock > 0 ? `<span style="font-size: 0.75rem; color: var(--warning);"> (${prod.reservedStock} held)</span>` : ''}
      </td>
      <td>
        <input type="number" min="0" value="${prod.stockQuantity}"
          style="width: 60px; padding: 0.2rem 0.4rem;" class="custom-select"
          onchange="updateStockCount('${prod.id}', this.value)"
        >
      </td>
      <td>
        <label class="switch" title="Toggle Item 86 (Out of Stock)">
          <input type="checkbox" ${prod.isAvailable ? 'checked' : ''} onchange="toggleItem86('${prod.id}', this.checked)">
          <span class="slider"></span>
        </label>
        <span style="margin-left: 0.5rem; font-size: 0.78rem; font-weight: 700; color: ${prod.isAvailable ? 'var(--primary)' : 'var(--danger)'}">
          ${prod.isAvailable ? 'In Stock' : '86’d (OUT)'}
        </span>
      </td>
    </tr>
  `).join('');
}

function filterStockTable(val) {
  renderStockTable(val);
}

async function toggleItem86(productId, isAvailable) {
  try {
    const res = await fetch(`/api/products/${productId}/toggle-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable })
    });
    const data = await res.json();
    if (data.success) {
      const prod = products.find(p => p.id === productId);
      if (prod) prod.isAvailable = isAvailable;
      renderStockTable();
    }
  } catch (err) {
    alert(`Failed to toggle SKU: ${err.message}`);
  }
}

async function updateStockCount(productId, count) {
  try {
    const res = await fetch(`/api/products/${productId}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockQuantity: Number(count) })
    });
    const data = await res.json();
    if (data.success) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        prod.stockQuantity = Number(count);
        prod.availableStock = data.product.availableStock;
      }
      renderStockTable();
    }
  } catch (err) {
    alert(`Failed to update stock: ${err.message}`);
  }
}

// PANEL 2: SLOT QUOTA MANAGEMENT
function renderSlotsGrid(slotCapacities) {
  const container = document.getElementById('slots-grid');
  if (!container || !slotCapacities) return;

  container.innerHTML = slotCapacities.map(slot => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
      <div style="font-weight: 800; font-size: 1rem; color: #fff; margin-bottom: 0.5rem;">
        🕒 ${slot.slot}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        <span>Booked Orders:</span>
        <strong style="color: var(--primary);">${slot.booked}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        <span>Remaining Slots:</span>
        <strong style="color: ${slot.available > 0 ? '#34d399' : 'var(--danger)'};">${slot.available}</strong>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
        <label style="font-size: 0.78rem; color: var(--text-dim); font-weight: 700;">Max Capacity:</label>
        <input type="number" min="1" max="50" value="${slot.max}"
          style="width: 70px; padding: 0.25rem 0.5rem; text-align: center;" class="custom-select"
          onchange="updateSlotLimit('${slot.slot}', this.value)"
        >
      </div>
    </div>
  `).join('');
}

async function updateSlotLimit(slot, max) {
  try {
    const res = await fetch('/api/manager/slots/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, max: Number(max) })
    });
    const data = await res.json();
    if (data.success) {
      addAuditLog('SYSTEM', `Updated quota for ${slot} to ${max} orders.`);
      loadAnalytics();
    }
  } catch (err) {
    alert(`Failed to update quota: ${err.message}`);
  }
}

// TAB SWITCHER
function switchManagerTab(tab, btn) {
  document.getElementById('panel-override').style.display = tab === 'override' ? 'block' : 'none';
  document.getElementById('panel-slots').style.display = tab === 'slots' ? 'block' : 'none';
  document.getElementById('panel-feed').style.display = tab === 'feed' ? 'block' : 'none';

  ['override', 'slots', 'feed'].forEach(t => {
    const b = document.getElementById(`tab-btn-${t}`);
    if (b) b.className = 'btn btn-secondary';
  });
  if (btn) btn.className = 'btn btn-primary';
}
