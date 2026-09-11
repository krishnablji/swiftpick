const db = require('../config/database');
const { socketEvents } = require('../services/socketService');

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const orderController = {
  // POST /api/orders
  createOrder: (req, res) => {
    try {
      const { items, pickupSlot, branchId = 'S01', customerName, customerPhone, paymentMethod = 'card_mock' } = req.body;
      const customerId = req.user ? req.user.id : (req.body.customerId || 'usr_cust_1');

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Cannot create an empty order.' });
      }

      if (!pickupSlot) {
        return res.status(400).json({ success: false, error: 'Pickup collection slot is required.' });
      }

      // 1. Verify stock availability and build full item snapshots
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const prod = db.getProductById(item.productId);
        if (!prod) {
          return res.status(400).json({ success: false, error: `Product ${item.productId} not found.` });
        }
        if (!prod.isAvailable) {
          return res.status(400).json({ success: false, error: `Product "${prod.title}" is currently out of stock.` });
        }
        if (prod.stockQuantity < item.qty) {
          return res.status(400).json({
            success: false,
            error: `Not enough stock for "${prod.title}". Only ${prod.stockQuantity} remaining.`
          });
        }

        const linePrice = Number((prod.price * item.qty).toFixed(2));
        totalAmount += linePrice;

        orderItems.push({
          productId: prod.id,
          title: prod.title,
          qty: item.qty,
          price: prod.price,
          aisleLocation: prod.aisleLocation || 'Aisle 1 - Shelf A',
          note: item.note ? String(item.note).trim() : '',
          isPicked: false
        });
      }

      // 2. Decrement physical inventory
      for (const item of items) {
        const prod = db.getProductById(item.productId);
        db.updateProductStock(item.productId, prod.stockQuantity - item.qty);
      }

      // 3. Clear customer's reservation holds
      db.releaseCustomerReservations(customerId);

      // 4. Generate sequential express order number atomically: S01-#042
      const orderCode = db.getNextOrderCode(branchId);
      const pin = generatePin();

      // 5. Build order document
      const newOrder = {
        id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        orderCode,
        branchId,
        customerId,
        customerName: customerName || (req.user ? req.user.name : 'Express Shopper'),
        customerPhone: customerPhone || '+1 (555) 000-1234',
        paymentMethod,
        paymentStatus: 'paid',
        items: orderItems,
        totalAmount: Number(totalAmount.toFixed(2)),
        pickupSlot,
        holdingBin: null,
        pin,
        status: 'placed', // 'placed' -> 'picking' -> 'ready' -> 'collected'
        customerArrived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        packedAt: null,
        collectedAt: null
      };

      db.createOrder(newOrder);

      // Update slot capacity
      const today = new Date().toISOString().slice(0, 10);
      db.incrementSlotBooking(branchId, today, pickupSlot);

      // Real-time broadcast to floor pickers & managers
      socketEvents.emitNewOrder(newOrder);

      // Broadcast inventory updates
      items.forEach(item => {
        const prod = db.getProductById(item.productId);
        if (prod) {
          socketEvents.emitInventoryUpdated(prod.id, prod.availableStock);
        }
      });

      console.log(`[Order] New order created: ${orderCode} (Total: $${newOrder.totalAmount}, PIN: ${pin})`);

      return res.status(201).json({
        success: true,
        order: newOrder
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/orders
  getOrders: (req, res) => {
    try {
      const { status, customerId, branchId } = req.query;
      let orders = db.getAllOrders();

      if (status) {
        orders = orders.filter(o => o.status === status);
      }
      if (customerId) {
        orders = orders.filter(o => o.customerId === customerId);
      }
      if (branchId) {
        orders = orders.filter(o => o.branchId === branchId);
      }

      return res.json({ success: true, orders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/orders/:id
  getOrderById: (req, res) => {
    try {
      const order = db.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }
      return res.json({ success: true, order });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/orders/:id/start-picking
  startPicking: (req, res) => {
    try {
      const order = db.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const updated = db.updateOrder(order.id, { status: 'picking' });
      socketEvents.emitOrderStatusChanged(updated);

      return res.json({ success: true, order: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/orders/:id/toggle-item-picked
  toggleItemPicked: (req, res) => {
    try {
      const { productId, isPicked } = req.body;
      const order = db.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const item = order.items.find(i => i.productId === productId);
      if (!item) return res.status(404).json({ success: false, error: 'Item not found in order.' });

      item.isPicked = typeof isPicked === 'boolean' ? isPicked : !item.isPicked;
      const updated = db.updateOrder(order.id, { items: order.items });

      // Notify interested pickers
      socketEvents.emitOrderStatusChanged(updated);

      return res.json({ success: true, order: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/orders/:id/pack-and-assign-bin
  packAndAssignBin: (req, res) => {
    try {
      const { holdingBin } = req.body;
      const order = db.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

      if (!holdingBin) {
        return res.status(400).json({ success: false, error: 'Holding bin / locker code is required.' });
      }

      // Mark all items picked if not already
      order.items.forEach(i => { i.isPicked = true; });

      const updated = db.updateOrder(order.id, {
        status: 'ready',
        holdingBin,
        packedAt: new Date().toISOString()
      });

      // Emit to Express Counter and Customer Pass
      socketEvents.emitOrderPacked(updated);

      console.log(`[Order] Packed & assigned to ${holdingBin}: ${order.orderCode}`);

      return res.json({ success: true, order: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/orders/:id/arrived
  customerArrived: (req, res) => {
    try {
      const order = db.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

      const updated = db.updateOrder(order.id, {
        customerArrived: true,
        arrivedAt: new Date().toISOString()
      });

      socketEvents.emitCustomerArrived(updated);

      console.log(`[Customer Check-in] Customer arrived for order ${order.orderCode} (Bin: ${order.holdingBin})`);

      return res.json({ success: true, order: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/orders/verify-and-handover (via QR payload or PIN)
  verifyAndHandover: (req, res) => {
    try {
      const { orderCode, pin } = req.body;
      let order = null;

      if (orderCode) {
        order = db.getOrderById(orderCode);
      }
      if (!order && pin) {
        order = db.getAllOrders().find(o => o.pin === String(pin).trim() && o.status !== 'collected');
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'No active order matches the provided QR code or PIN.'
        });
      }

      if (pin && order.pin !== String(pin).trim()) {
        return res.status(400).json({ success: false, error: 'Invalid 4-digit security PIN.' });
      }

      const updated = db.updateOrder(order.id, {
        status: 'collected',
        collectedAt: new Date().toISOString()
      });

      socketEvents.emitOrderStatusChanged(updated);

      console.log(`[Handover Complete] Order ${order.orderCode} marked as collected from ${order.holdingBin}`);

      return res.json({
        success: true,
        message: 'Order verified and handed over successfully.',
        order: updated
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = orderController;
