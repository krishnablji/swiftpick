// SwiftPick Express - Express Counter Cashier Controller

let currentOrder = null;
let lastArrivedOrder = null;
let html5QrScanner = null;
let isScanning = false;

const socket = io();

document.addEventListener('DOMContentLoaded', () => {
  renderSharedNav('counter');
  initSocket();
  loadReadyOrders();
});

function initSocket() {
  socket.on('connect', () => {
    console.log('[Socket] Express Counter connected.');
    socket.emit('join_role_room', 'cashier');
    const pill = document.getElementById('ws-status-text');
    if (pill) pill.textContent = 'Socket: Online (Counter Room)';
  });

  // Real-Time Alert: Floor picker finished packing and assigned a bin
  socket.on('order_packed_bin_assigned', (order) => {
    console.log('[Socket] Order ready in bin:', order.orderCode, order.holdingBin);
    loadReadyOrders();
    playChime('success');
  });

  // Real-Time Alert: Customer arrived at store!
  socket.on('customer_arrived', (data) => {
    console.log('[Socket] Customer arrived:', data);
    lastArrivedOrder = data;
    showArrivalAlert(data);
    playChime('alert');
    loadReadyOrders();
  });

  socket.on('order_status_changed', (order) => {
    loadReadyOrders();
    if (currentOrder && currentOrder.id === order.id) {
      currentOrder = order;
      if (order.status === 'collected') {
        showCollectedState();
      }
    }
  });
}

function showArrivalAlert(data) {
  const box = document.getElementById('arrived-alert-box');
  document.getElementById('alert-cust-name').textContent = data.customerName || 'Express Customer';
  document.getElementById('alert-order-code').textContent = data.orderCode;
  document.getElementById('alert-bin-name').textContent = data.holdingBin || 'Locker Assigned';
  box.style.display = 'block';
}

async function loadArrivedOrderToCounter() {
  if (!lastArrivedOrder) return;
  await fetchAndDisplayOrder(lastArrivedOrder.orderCode);
}

// --- SCANNING & PIN LOOKUP ---
function toggleCameraScanner() {
  const btn = document.getElementById('btn-toggle-camera');
  if (isScanning) {
    stopCamera();
    btn.textContent = '📷 Start Camera Scanner';
    isScanning = false;
  } else {
    startCamera();
    btn.textContent = '⏹️ Stop Camera Scanner';
    isScanning = true;
  }
}

function startCamera() {
  if (!window.Html5Qrcode) {
    alert('QR Scanner library still loading. Please try again in a moment or use the 4-digit PIN.');
    return;
  }

  html5QrScanner = new Html5Qrcode('qr-reader');
  const config = { fps: 10, qrbox: { width: 220, height: 220 } };

  html5QrScanner.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      console.log('[Scanner] QR Decoded:', decodedText);
      handleScannedData(decodedText);
    },
    (errorMessage) => {
      // parse error / scanning frame
    }
  ).catch(err => {
    console.warn('Camera start error (permission/virtual env):', err.message);
    document.getElementById('qr-reader').innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Camera unavailable in this browser session.<br>
        <strong>Use the 4-digit PIN input below for instant verification.</strong>
      </div>
    `;
  });
}

function stopCamera() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner.clear();
      html5QrScanner = null;
    }).catch(console.error);
  }
}

function handleScannedData(rawText) {
  playChime('success');
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.orderCode) {
      fetchAndDisplayOrder(parsed.orderCode);
    }
  } catch (e) {
    // If text was just orderCode or PIN
    if (rawText.startsWith('S') || rawText.includes('#')) {
      fetchAndDisplayOrder(rawText);
    } else if (rawText.length === 4) {
      document.getElementById('pin-input').value = rawText;
      lookupByPin();
    }
  }
}

async function lookupByPin() {
  const pin = document.getElementById('pin-input').value.trim();
  if (!pin) {
    alert('Please enter a 4-digit PIN.');
    return;
  }

  try {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.success) {
      const match = data.orders.find(o => o.pin === pin && o.status !== 'collected');
      if (match) {
        displayOrderDetails(match);
      } else {
        alert(`No active order found for PIN ${pin}. Please check or re-scan.`);
      }
    }
  } catch (err) {
    alert(`Lookup failed: ${err.message}`);
  }
}

async function fetchAndDisplayOrder(orderCode) {
  try {
    const res = await fetch(`/api/orders/${orderCode}`);
    const data = await res.json();
    if (data.success) {
      displayOrderDetails(data.order);
    } else {
      alert(`Order ${orderCode} not found.`);
    }
  } catch (err) {
    alert(`Error fetching order: ${err.message}`);
  }
}

function displayOrderDetails(order) {
  currentOrder = order;

  document.getElementById('no-order-placeholder').style.display = 'none';
  const display = document.getElementById('order-active-display');
  display.style.display = 'flex';

  document.getElementById('display-bin-name').textContent = order.holdingBin || 'LOCATING...';
  document.getElementById('display-order-code').textContent = order.orderCode;
  document.getElementById('display-cust-name').textContent = order.customerName;
  document.getElementById('display-slot-time').textContent = order.pickupSlot;
  document.getElementById('display-total-price').textContent = order.totalAmount.toFixed(2);
  document.getElementById('display-pin-val').textContent = order.pin;
  document.getElementById('display-item-count').textContent = order.items.length;

  const itemsList = document.getElementById('display-items-list');
  itemsList.innerHTML = order.items.map(i => `
    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.4rem; background: rgba(255,255,255,0.02); border-radius: 6px;">
      <span><strong>${i.qty}x</strong> ${i.title}</span>
      <span style="color: var(--accent); font-family: var(--font-mono); font-size: 0.75rem;">${i.aisleLocation}</span>
    </div>
  `).join('');

  const btnHandover = document.getElementById('btn-handover');
  if (order.status === 'collected') {
    btnHandover.disabled = true;
    btnHandover.textContent = '✓ Already Collected & Handed Over';
  } else {
    btnHandover.disabled = false;
    btnHandover.textContent = `✓ Confirm Handover from ${order.holdingBin || 'Shelf'}`;
  }
}

async function confirmHandover() {
  if (!currentOrder) return;
  const btn = document.getElementById('btn-handover');
  btn.disabled = true;
  btn.textContent = 'Marking Handover Complete...';

  try {
    const res = await fetch('/api/orders/verify-and-handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderCode: currentOrder.orderCode,
        pin: currentOrder.pin
      })
    });
    const data = await res.json();
    if (data.success) {
      currentOrder = data.order;
      playChime('success');
      showCollectedState();
      loadReadyOrders();
      // Hide arrival alert if matched
      document.getElementById('arrived-alert-box').style.display = 'none';
      document.getElementById('pin-input').value = '';
    } else {
      alert(`Handover failed: ${data.error}`);
      btn.disabled = false;
    }
  } catch (err) {
    alert(`Handover error: ${err.message}`);
    btn.disabled = false;
  }
}

function showCollectedState() {
  const btnHandover = document.getElementById('btn-handover');
  btnHandover.disabled = true;
  btnHandover.textContent = '✓ Handover Complete (Sub-30s Handover Met!)';
  btnHandover.style.background = '#059669';
}

// --- READY IN LOCKERS TABLE ---
async function loadReadyOrders() {
  try {
    const res = await fetch('/api/orders?status=ready');
    const data = await res.json();
    if (data.success) {
      renderReadyTable(data.orders);
    }
  } catch (err) {
    console.error('Failed to load ready orders:', err);
  }
}

function renderReadyTable(readyOrders) {
  const tbody = document.getElementById('staging-orders-tbody');
  if (!tbody) return;

  if (readyOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No orders currently waiting in lockers.</td></tr>`;
    return;
  }

  tbody.innerHTML = readyOrders.map(order => `
    <tr>
      <td><strong style="font-family: var(--font-mono); color: #fff;">${order.orderCode}</strong></td>
      <td>${order.customerName}</td>
      <td>${order.pickupSlot}</td>
      <td><span class="bin-location-badge" style="font-size: 0.82rem; padding: 0.2rem 0.6rem; margin: 0;">${order.holdingBin || 'Pending'}</span></td>
      <td><span style="font-family: var(--font-mono); color: var(--accent);">${order.pin}</span></td>
      <td>
        ${order.customerArrived ? `
          <span style="background: rgba(239,68,68,0.2); color: #f87171; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">
            🚨 ARRIVED
          </span>
        ` : `
          <span style="color: var(--text-dim); font-size: 0.78rem;">En Route</span>
        `}
      </td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" onclick="fetchAndDisplayOrder('${order.orderCode}')">
          Verify ➔
        </button>
      </td>
    </tr>
  `).join('');
}
