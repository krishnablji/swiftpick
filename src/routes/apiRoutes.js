const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const reservationController = require('../controllers/reservationController');
const orderController = require('../controllers/orderController');
const managerController = require('../controllers/managerController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// --- AUTH ---
router.post('/auth/login', authController.login);
router.post('/auth/quick-switch', authController.quickSwitch);
router.get('/auth/me', authenticate, authController.me);
router.post('/auth/logout', authController.logout);

// --- PRODUCTS ---
router.get('/products', productController.getAll);
router.get('/products/:id', productController.getById);
router.post('/products/:id/toggle-availability', productController.toggleAvailability); // Item 86 toggle
router.post('/products/:id/stock', productController.updateStock);

// --- ATOMIC CART RESERVATIONS (5-MIN LOCKS) ---
router.post('/cart/lock', reservationController.lockCart);
router.post('/cart/release', reservationController.releaseCart);
router.get('/cart/status', reservationController.getStatus);

// --- ORDERS & FULFILLMENT ---
router.post('/orders', orderController.createOrder);
router.get('/orders', orderController.getOrders);
router.get('/orders/:id', orderController.getOrderById);
router.post('/orders/:id/start-picking', orderController.startPicking);
router.post('/orders/:id/toggle-item-picked', orderController.toggleItemPicked);
router.post('/orders/:id/pack-and-assign-bin', orderController.packAndAssignBin);
router.post('/orders/:id/arrived', orderController.customerArrived);
router.post('/orders/verify-and-handover', orderController.verifyAndHandover);

// --- MANAGER ANALYTICS ---
router.get('/manager/analytics', managerController.getAnalytics);
router.post('/manager/slots/quota', managerController.updateSlotQuota);

module.exports = router;
