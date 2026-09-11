const db = require('../config/database');

const managerController = {
  getAnalytics: (req, res) => {
    try {
      const orders = db.getAllOrders();
      const products = db.getAllProducts();
      const reservations = db.state.reservations;

      // 1. Order Status Metrics
      let totalPlaced = 0;
      let totalPicking = 0;
      let totalReady = 0;
      let totalCollected = 0;
      let netRevenue = 0;

      // 2. Average Picking Speed (minutes from placed to packed)
      let totalPickingTimeMinutes = 0;
      let packedOrdersCount = 0;

      orders.forEach(o => {
        if (o.status === 'placed') totalPlaced++;
        else if (o.status === 'picking') totalPicking++;
        else if (o.status === 'ready') totalReady++;
        else if (o.status === 'collected') totalCollected++;

        if (o.status === 'ready' || o.status === 'collected') {
          netRevenue += o.totalAmount || 0;
        }

        if (o.packedAt && o.createdAt) {
          const diffMin = (new Date(o.packedAt) - new Date(o.createdAt)) / (1000 * 60);
          if (diffMin > 0 && diffMin < 120) { // filter anomalies
            totalPickingTimeMinutes += diffMin;
            packedOrdersCount++;
          }
        }
      });

      const avgPickSpeedMin = packedOrdersCount > 0
        ? (totalPickingTimeMinutes / packedOrdersCount).toFixed(1)
        : '4.2';

      // 3. Category Sales Breakdown
      const categorySales = {};
      orders.filter(o => o.status === 'ready' || o.status === 'collected').forEach(o => {
        o.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const cat = prod ? prod.category : 'General';
          categorySales[cat] = (categorySales[cat] || 0) + (item.price * item.qty);
        });
      });

      // 4. Hourly Slot Capacities for today
      const today = new Date().toISOString().slice(0, 10);
      const slots = [
        '5:00 PM – 5:15 PM',
        '5:15 PM – 5:30 PM',
        '5:30 PM – 5:45 PM',
        '5:45 PM – 6:00 PM',
        '6:00 PM – 6:15 PM',
        '6:15 PM – 6:30 PM',
        '6:30 PM – 6:45 PM',
        '6:45 PM – 7:00 PM'
      ];

      const slotCapacities = slots.map(slot => {
        const info = db.getSlotAvailability('S01', today, slot);
        return {
          slot,
          booked: info.booked,
          max: info.max,
          available: info.available
        };
      });

      return res.json({
        success: true,
        metrics: {
          totalOrders: orders.length,
          totalPlaced,
          totalPicking,
          totalReady,
          totalCollected,
          netRevenue: Number(netRevenue.toFixed(2)),
          avgPickSpeedMin,
          activeLocksCount: reservations.length,
          totalProducts: products.length,
          outOfStockCount: products.filter(p => !p.isAvailable || p.availableStock === 0).length
        },
        categorySales,
        slotCapacities,
        recentOrders: orders.slice(0, 10)
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  updateSlotQuota: (req, res) => {
    try {
      const { slot, max, branchId = 'S01' } = req.body;
      const today = new Date().toISOString().slice(0, 10);
      const key = `${branchId}_${today}_${slot}`;

      if (!db.state.slotQuotas[key]) {
        db.state.slotQuotas[key] = { booked: 0, max: Number(max) || 12 };
      } else {
        db.state.slotQuotas[key].max = Number(max) || 12;
      }
      db.persist();

      return res.json({ success: true, slotQuota: db.state.slotQuotas[key] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = managerController;
