// SwiftPick Express - Store Picker KDS Tablet Controller

let orders = [];
let currentFilter = 'active'; // 'active', 'ready', 'all'
let packingOrderId = null;

const socket = io();

document.addEventListener('DOMContentLoaded', () => {
  renderSharedNav('picker');
  initSocket();
  loadPickerOrders();
});

function initSocket() {
  socket.on('connect', () => {
    console.log('[Socket] Picker KDS connected.');
    socket.emit('join_role_room', 'picker');
    const pill = document.getElementById('ws-status-text');
    if (pill) pill.textContent = 'Socket: Online (Picker Room)';
  });

  // Real-Time New Order Arrival
  socket.on('new_pickup_order', (newOrder) => {
    console.log('[Socket] New pickup order received:', newOrder.orderCode);
    playChime('alert');
    // Prepend if not exists
    if (!orders.some(o => o.id === newOrder.id)) {
      orders.unshift(newOrder);
      renderKdsBoard();
    }
  });

  // Status updates from other devices/roles
  socket.on('order_status_changed', (updated) => {
    const idx = orders.findIndex(o => o.id === updated.id);
    if (idx !== -1) {
      orders[idx] = updated;
      renderKdsBoard();
    }
  });

  socket.on('order_packed_bin_assigned', (updated) => {
    const idx = orders.findIndex(o => o.id === updated.id);
    if (idx !== -1) {
      orders[idx] = updated;
      renderKdsBoard();
    }
  });
}

async function loadPickerOrders() {
  try {
    const res = await fetch('/api/orders?branchId=S01');
    const data = await res.json();
    if (data.success) {
      orders = data.orders;
      renderKdsBoard();
    }
  } catch (err) {
    console.error('Failed to load orders for picker:', err);
  }
}

function filterKds(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.app-container > div button').forEach(b => {
    b.className = 'btn btn-secondary';
  });
  if (btn) btn.className = 'btn btn-primary';
  renderKdsBoard();
}

// Aisle Location Sorting Comparator
function compareAisleLocation(a, b) {
  const locA = a.aisleLocation || 'Aisle 99';
  const locB = b.aisleLocation || 'Aisle 99';
  return locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
}

function renderKdsBoard() {
  const container = document.getElementById('kds-board');
  const countEl = document.getElementById('active-queue-count');
  if (!container) return;

  const activeOrders = orders.filter(o => o.status === 'placed' || o.status === 'picking');
  if (countEl) countEl.textContent = activeOrders.length;

  let displayOrders = orders;
  if (currentFilter === 'active') {
    displayOrders = activeOrders;
  } else if (currentFilter === 'ready') {
    displayOrders = orders.filter(o => o.status === 'ready');
  }

  if (displayOrders.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
        <h3>No orders in this queue.</h3>
        <p>All floor pick checklists have been completed!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayOrders.map(order => {
    // Sort items within order by Aisle walking path: Aisle 1 -> Aisle 2 -> Aisle 3...
    const sortedItems = [...order.items].sort(compareAisleLocation);
    const pickedCount = sortedItems.filter(i => i.isPicked).length;
    const totalCount = sortedItems.length;
    const allPicked = pickedCount === totalCount && totalCount > 0;
    const progressPct = totalCount > 0 ? Math.round((pickedCount / totalCount) * 100) : 0;

    let statusBadge = `<span style="background: rgba(245,158,11,0.2); color: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">NEW PLACED</span>`;
    if (order.status === 'picking') {
      statusBadge = `<span style="background: rgba(6,182,212,0.2); color: #22d3ee; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">IN PROGRESS</span>`;
    } else if (order.status === 'ready') {
      statusBadge = `<span style="background: rgba(16,185,129,0.2); color: #34d399; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">STAGED IN ${order.holdingBin || 'BIN'}</span>`;
    } else if (order.status === 'collected') {
      statusBadge = `<span style="background: rgba(107,114,128,0.2); color: #9ca3af; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">COLLECTED</span>`;
    }

    return `
      <div class="kds-card status-${order.status}" id="kds-card-${order.id}">
        <div class="kds-card-header">
          <div>
            <div class="kds-order-code">${order.orderCode}</div>
            <div class="kds-time-slot">
              <span>🕒 ${order.pickupSlot}</span> • <span>👤 ${order.customerName}</span>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <!-- Pick Progress Bar -->
        <div style="background: rgba(255,255,255,0.05); height: 6px; width: 100%;">
          <div style="background: var(--primary); height: 100%; width: ${progressPct}%; transition: width 0.2s ease;"></div>
        </div>

        <div style="padding: 0.75rem 1.25rem 0.25rem; display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
          <span>WALKING ROUTE: AISLE 1 ➔ AISLE 5</span>
          <span><strong>${pickedCount} of ${totalCount}</strong> items bagged</span>
        </div>

        <!-- Aisle-Optimized Items Checklist -->
        <div class="kds-items-list">
          ${sortedItems.map(item => `
            <div class="kds-item-row ${item.isPicked ? 'picked' : ''}" onclick="toggleItem('${order.id}', '${item.productId}', ${!item.isPicked})">
              <div class="kds-check-box">
                ${item.isPicked ? '✓' : ''}
              </div>
              <div style="flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="font-size: 0.95rem; color: #fff;">${item.qty}x ${item.title}</strong>
                  <span class="kds-aisle-pill">${item.aisleLocation}</span>
                </div>
                ${item.note ? `
                  <div style="font-size: 0.78rem; color: #f59e0b; margin-top: 0.25rem; background: rgba(245,158,11,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">
                    📝 Note: "${item.note}"
                  </div>
                ` : ''}
              </div>
              <button title="Mark Out of Stock (86) on shelf"
                onclick="event.stopPropagation(); trigger86FromFloor('${item.productId}', '${item.title}')"
                style="background: transparent; border: none; font-size: 0.75rem; color: var(--danger); cursor: pointer; padding: 0.2rem;"
              >
                86?
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Action Footer -->
        <div class="kds-card-actions">
          ${order.status === 'placed' ? `
            <button class="btn btn-accent" style="width: 100%;" onclick="startPickingOrder('${order.id}')">
              Start Picking Route ➔
            </button>
          ` : order.status === 'picking' ? `
            <button class="btn btn-primary" style="width: 100%;" onclick="openBinModal('${order.id}', '${order.orderCode}')" ${!allPicked ? 'disabled' : ''}>
              ${allPicked ? '📦 All Picked: Assign Holding Bin ➔' : `Bag all items (${pickedCount}/${totalCount})`}
            </button>
          ` : `
            <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; width: 100%;">
              Staged at <strong>${order.holdingBin}</strong> • PIN: ${order.pin}
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// 1-Tap Item Confirmation
async function toggleItem(orderId, productId, isPicked) {
  try {
    const res = await fetch(`/api/orders/${orderId}/toggle-item-picked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, isPicked })
    });
    const data = await res.json();
    if (data.success) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders[idx] = data.order;
        renderKdsBoard();
      }
    }
  } catch (err) {
    console.error('Failed to toggle item:', err);
  }
}

async function startPickingOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/start-picking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders[idx] = data.order;
        renderKdsBoard();
      }
    }
  } catch (err) {
    console.error('Failed to start picking:', err);
  }
}

// Bin Assignment
function openBinModal(orderId, orderCode) {
  packingOrderId = orderId;
  document.getElementById('bin-modal-order-code').textContent = orderCode;
  document.getElementById('bin-assign-modal').classList.add('active');
}

function closeBinModal() {
  document.getElementById('bin-assign-modal').classList.remove('active');
  packingOrderId = null;
}

async function submitBinAssignment() {
  if (!packingOrderId) return;
  const holdingBin = document.getElementById('bin-select').value;
  const btn = document.getElementById('btn-confirm-bin');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/orders/${packingOrderId}/pack-and-assign-bin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdingBin })
    });
    const data = await res.json();
    if (data.success) {
      const idx = orders.findIndex(o => o.id === packingOrderId);
      if (idx !== -1) {
        orders[idx] = data.order;
      }
      playChime('success');
      closeBinModal();
      renderKdsBoard();
    }
  } catch (err) {
    alert(`Failed to assign bin: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

// Emergency Item 86 from floor picker
async function trigger86FromFloor(productId, title) {
  if (!confirm(`Are you sure you want to 86 "${title}"? This will disable it in real-time on all customer apps.`)) {
    return;
  }
  try {
    const res = await fetch(`/api/products/${productId}/toggle-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: false })
    });
    const data = await res.json();
    if (data.success) {
      alert(`SKU "${title}" is now marked OUT OF STOCK (Item 86).`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
