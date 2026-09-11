const db = require('../config/database');
const { socketEvents } = require('../services/socketService');

const reservationController = {
  // POST /api/cart/lock
  lockCart: (req, res) => {
    try {
      const { items } = req.body;
      const customerId = req.user ? req.user.id : (req.body.customerId || 'anon_' + req.ip);

      if (!Array.isArray(items) || items.length === 0) {
        // Releasing cart
        db.releaseCustomerReservations(customerId);
        return res.json({ success: true, message: 'Cart reservation cleared.', ttlSeconds: 0 });
      }

      // Attempt atomic hold
      const result = db.atomicReserveItems(customerId, items);

      if (!result.success) {
        return res.status(409).json({
          success: false,
          error: result.error,
          productId: result.productId,
          availableStock: result.availableStock
        });
      }

      // Broadcast inventory updates to all clients so other shoppers see reduced available numbers
      items.forEach(item => {
        const prod = db.getProductById(item.productId);
        if (prod) {
          socketEvents.emitInventoryUpdated(prod.id, prod.availableStock);
        }
      });

      return res.json({
        success: true,
        message: 'Atomic 5-minute inventory lock successfully acquired.',
        expiresAt: result.expiresAt,
        ttlSeconds: result.ttlSeconds,
        reservations: result.reservations
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // POST /api/cart/release
  releaseCart: (req, res) => {
    try {
      const customerId = req.user ? req.user.id : (req.body.customerId || 'anon_' + req.ip);
      db.releaseCustomerReservations(customerId);

      // Re-broadcast current stock levels
      const products = db.getAllProducts();
      products.forEach(p => {
        socketEvents.emitInventoryUpdated(p.id, p.availableStock);
      });

      return res.json({ success: true, message: 'Cart locks released.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // GET /api/cart/status
  getStatus: (req, res) => {
    try {
      const customerId = req.user ? req.user.id : (req.query.customerId || 'anon_' + req.ip);
      const now = Date.now();
      const userLocks = db.state.reservations.filter(r => r.customerId === customerId && r.expiresAt > now);

      const expiresAt = userLocks.length > 0 ? Math.min(...userLocks.map(l => l.expiresAt)) : null;
      const remainingSeconds = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0;

      return res.json({
        success: true,
        hasActiveLocks: userLocks.length > 0,
        remainingSeconds,
        expiresAt,
        itemsLocked: userLocks
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = reservationController;
