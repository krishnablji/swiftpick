const db = require('../config/database');
const { socketEvents } = require('./socketService');

let intervalId = null;

function startLockCleaner(intervalMs = 10000) {
  if (intervalId) return;

  intervalId = setInterval(() => {
    try {
      const expiredCount = db.cleanExpiredLocks();
      if (expiredCount > 0) {
        console.log(`[LockCleaner] Cleaned ${expiredCount} expired stock reservation(s).`);
        // Notify all clients of updated inventory counts
        const products = db.getAllProducts();
        products.forEach(p => {
          socketEvents.emitInventoryUpdated(p.id, p.availableStock);
        });
      }
    } catch (err) {
      console.error('[LockCleaner Error]', err.message);
    }
  }, intervalMs);

  console.log(`[LockCleaner] Service started with interval ${intervalMs}ms.`);
}

function stopLockCleaner() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  startLockCleaner,
  stopLockCleaner
};
