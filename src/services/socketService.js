let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join room based on role or explicit subscribe
    socket.on('join_role_room', (role) => {
      if (['picker', 'cashier', 'manager'].includes(role)) {
        const roomName = `room_${role === 'cashier' ? 'counter' : role + 's'}`;
        socket.join(roomName);
        console.log(`[Socket] Client ${socket.id} joined role room: ${roomName}`);
      }
    });

    socket.on('subscribe_order', (orderCode) => {
      if (orderCode) {
        const roomName = `room_order_${orderCode}`;
        socket.join(roomName);
        console.log(`[Socket] Client ${socket.id} subscribed to ${roomName}`);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return ioInstance;
}

// Broadcasting helpers
const socketEvents = {
  // New order placed -> broadcast to Pickers and Managers
  emitNewOrder: (order) => {
    if (!ioInstance) return;
    ioInstance.to('room_pickers').emit('new_pickup_order', order);
    ioInstance.to('room_managers').emit('new_pickup_order', order);
    // Also notify order room
    ioInstance.to(`room_order_${order.orderCode}`).emit('order_status_changed', order);
  },

  // Order packed & bin assigned by picker -> broadcast to Counter and Order room
  emitOrderPacked: (order) => {
    if (!ioInstance) return;
    ioInstance.to('room_counter').emit('order_packed_bin_assigned', order);
    ioInstance.to('room_managers').emit('order_packed_bin_assigned', order);
    ioInstance.to(`room_order_${order.orderCode}`).emit('order_status_changed', order);
  },

  // Order state transition (e.g., picking, collected, cancelled)
  emitOrderStatusChanged: (order) => {
    if (!ioInstance) return;
    ioInstance.emit('order_status_changed', order);
    ioInstance.to(`room_order_${order.orderCode}`).emit('order_status_changed', order);
  },

  // Customer arrived at store -> flash alert to Counter staff
  emitCustomerArrived: (order) => {
    if (!ioInstance) return;
    ioInstance.to('room_counter').emit('customer_arrived', {
      orderCode: order.orderCode,
      customerName: order.customerName,
      holdingBin: order.holdingBin,
      pickupSlot: order.pickupSlot,
      itemsCount: order.items.length,
      timestamp: new Date().toISOString()
    });
    ioInstance.to('room_managers').emit('customer_arrived', { orderCode: order.orderCode });
  },

  // Item 86 - Out of stock toggle (Emergency floor override)
  emitItemAvailabilityChanged: (product) => {
    if (!ioInstance) return;
    // Broadcast globally to all connected customers, pickers, and managers
    ioInstance.emit('item_86_out_of_stock', {
      productId: product.id,
      title: product.title,
      isAvailable: product.isAvailable,
      stockQuantity: product.stockQuantity,
      availableStock: product.availableStock
    });
  },

  // Inventory reservation lock broadcast
  emitInventoryUpdated: (productId, availableStock) => {
    if (!ioInstance) return;
    ioInstance.emit('inventory_lock_updated', {
      productId,
      availableStock
    });
  }
};

module.exports = {
  initSocket,
  getIO,
  socketEvents
};
