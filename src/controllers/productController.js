const db = require('../config/database');
const { socketEvents } = require('../services/socketService');

const productController = {
  getAll: (req, res) => {
    try {
      const products = db.getAllProducts();
      return res.json({ success: true, products });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  getById: (req, res) => {
    try {
      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }
      return res.json({ success: true, product });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Item 86 - Emergency Stock Override
  toggleAvailability: (req, res) => {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;

      const current = db.getProductById(id);
      if (!current) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }

      const targetStatus = typeof isAvailable === 'boolean' ? isAvailable : !current.isAvailable;
      const updated = db.setProductAvailability(id, targetStatus);
      const fullProd = db.getProductById(id);

      // Real-time broadcast to all connected clients
      socketEvents.emitItemAvailabilityChanged(fullProd);

      console.log(`[Item 86] Product "${fullProd.title}" availability set to ${targetStatus ? 'IN-STOCK' : 'OUT-OF-STOCK (86)'}`);

      return res.json({
        success: true,
        message: `Product ${targetStatus ? 'marked Available' : '86’d (Out of Stock)'}`,
        product: fullProd
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  updateStock: (req, res) => {
    try {
      const { id } = req.params;
      const { stockQuantity } = req.body;

      if (stockQuantity === undefined || Number(stockQuantity) < 0) {
        return res.status(400).json({ success: false, error: 'Valid stock quantity required.' });
      }

      db.updateProductStock(id, Number(stockQuantity));
      const updated = db.getProductById(id);

      // Broadcast inventory update
      socketEvents.emitInventoryUpdated(id, updated.availableStock);

      return res.json({ success: true, product: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = productController;
