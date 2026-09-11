const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const db = require('./src/config/database');
const seed = require('./src/utils/seedData');
const { initSocket } = require('./src/services/socketService');
const { startLockCleaner } = require('./src/services/lockCleanerService');
const apiRoutes = require('./src/routes/apiRoutes');

// Auto-seed on first deployment if store is clean
if (db.state.products.length === 0) {
  console.log('[Startup] Empty database detected. Running initial seed...');
  seed();
}

const app = express();
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
initSocket(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Friendly URL routing for the 4 persona screens
app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/picker', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/picker.html'));
});

app.get('/counter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/counter.html'));
});

app.get('/manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/manager.html'));
});

// Start Background Services
startLockCleaner(10000); // Check and clean expired cart locks every 10 seconds

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
===================================================================
🚀 SWIFTPICK EXPRESS - REAL-TIME RETAIL FULFILLMENT ENGINE
===================================================================
🌐 Server running on: http://localhost:${PORT}

📱 High-Density Operational Screens:
  • 🛒 Customer Storefront:     http://localhost:${PORT}/index.html
  • 📋 Store Picker Tablet KDS: http://localhost:${PORT}/picker.html
  • ⚡ Express Counter Scanner:  http://localhost:${PORT}/counter.html
  • 📊 Store Manager Portal:    http://localhost:${PORT}/manager.html

🔑 Demo Accounts:
  • Customer: customer@swiftpick.com (Alex Johnson)
  • Picker:   picker@swiftpick.com   (Sam Rivera)
  • Cashier:  cashier@swiftpick.com  (Elena Rostova)
  • Manager:  manager@swiftpick.com  (David Chen)
  • Password: pass123 (or use the 1-Click Role Switcher bar!)

⚡ Real-Time Pipeline:
  • Socket.io rooms active (room_pickers, room_counter, room_managers)
  • Atomic Inventory Lock Engine running with 5-minute TTL
  • Daily Sequential Code Generator: S01-#001 ... S01-#042
===================================================================
`);
});
