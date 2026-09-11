const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seed() {
  console.log('[Seed] Seeding SwiftPick Express initial data...');

  // 1. Demo Users
  const passwordHash = await bcrypt.hash('pass123', 8);

  const users = [
    {
      id: 'usr_cust_1',
      name: 'Alex Johnson',
      email: 'customer@swiftpick.com',
      password: passwordHash,
      role: 'customer',
      branchId: 'S01'
    },
    {
      id: 'usr_pick_1',
      name: 'Sam Rivera (Floor Lead)',
      email: 'picker@swiftpick.com',
      password: passwordHash,
      role: 'picker',
      branchId: 'S01'
    },
    {
      id: 'usr_cash_1',
      name: 'Elena Rostova',
      email: 'cashier@swiftpick.com',
      password: passwordHash,
      role: 'cashier',
      branchId: 'S01'
    },
    {
      id: 'usr_mgr_1',
      name: 'David Chen (Store GM)',
      email: 'manager@swiftpick.com',
      password: passwordHash,
      role: 'manager',
      branchId: 'S01'
    }
  ];

  // 2. Realistic Product Catalog sorted across Aisles
  const products = [
    // Aisle 1 - Dairy & Cold
    {
      id: 'prod_milk',
      title: 'Organic Whole Milk (1 Gallon)',
      category: 'Dairy & Eggs',
      price: 4.49,
      stockQuantity: 18,
      aisleLocation: 'Aisle 1 - Shelf A',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
      description: 'Pasteurized grade A whole milk from pasture-raised cows.'
    },
    {
      id: 'prod_yogurt',
      title: 'Greek Vanilla Yogurt (32oz)',
      category: 'Dairy & Eggs',
      price: 5.29,
      stockQuantity: 12,
      aisleLocation: 'Aisle 1 - Shelf B',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80',
      description: 'Triple-strained high-protein creamy Greek yogurt.'
    },
    {
      id: 'prod_butter',
      title: 'Pure Irish Grass-Fed Butter (8oz)',
      category: 'Dairy & Eggs',
      price: 4.99,
      stockQuantity: 8,
      aisleLocation: 'Aisle 1 - Shelf C',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80',
      description: 'Golden churned butter with natural sea salt crystals.'
    },
    {
      id: 'prod_eggs',
      title: 'Pasture-Raised Grade A Eggs (12pk)',
      category: 'Dairy & Eggs',
      price: 4.19,
      stockQuantity: 20,
      aisleLocation: 'Aisle 1 - Shelf D',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=400&q=80',
      description: 'Certified humane pasture-raised brown large eggs.'
    },

    // Aisle 2 - Fresh Produce
    {
      id: 'prod_apples',
      title: 'Crisp Honeycrisp Apples (3lb Bag)',
      category: 'Produce',
      price: 6.49,
      stockQuantity: 14,
      aisleLocation: 'Aisle 2 - Shelf A',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
      description: 'Sweet, tart, exceptionally juicy and crisp apples.'
    },
    {
      id: 'prod_bananas',
      title: 'Fresh Organic Bananas (Bunch)',
      category: 'Produce',
      price: 2.29,
      stockQuantity: 28,
      aisleLocation: 'Aisle 2 - Shelf B',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
      description: 'Fair-trade Cavendish bananas rich in potassium.'
    },
    {
      id: 'prod_avocados',
      title: 'Ripe Hass Avocados (4pk)',
      category: 'Produce',
      price: 4.99,
      stockQuantity: 3, // LOW STOCK to showcase atomic locking!
      aisleLocation: 'Aisle 2 - Shelf C',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=400&q=80',
      description: 'Creamy Hass avocados ready for guacamole or salads.'
    },
    {
      id: 'prod_spinach',
      title: 'Baby Spinach Clamshell (16oz)',
      category: 'Produce',
      price: 3.89,
      stockQuantity: 15,
      aisleLocation: 'Aisle 2 - Shelf D',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&q=80',
      description: 'Pre-washed, tender crisp organic young baby spinach.'
    },

    // Aisle 3 - Bakery & Pantry
    {
      id: 'prod_sourdough',
      title: 'Handcrafted Artisan Sourdough Loaf',
      category: 'Bakery',
      price: 5.49,
      stockQuantity: 2, // LOW STOCK!
      aisleLocation: 'Aisle 3 - Shelf A',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=400&q=80',
      description: 'Slow-fermented crusty sourdough baked fresh this morning.'
    },
    {
      id: 'prod_oliveoil',
      title: 'Extra Virgin Italian Olive Oil (750ml)',
      category: 'Pantry',
      price: 13.99,
      stockQuantity: 10,
      aisleLocation: 'Aisle 3 - Shelf B',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
      description: 'First cold-pressed single estate extra virgin olive oil.'
    },
    {
      id: 'prod_pasta',
      title: 'Bronze-Cut Penne Rigate (16oz)',
      category: 'Pantry',
      price: 2.79,
      stockQuantity: 24,
      aisleLocation: 'Aisle 3 - Shelf C',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=400&q=80',
      description: 'Durum semolina pasta crafted with traditional bronze dies.'
    },
    {
      id: 'prod_sauce',
      title: 'San Marzano Tomato & Basil Sauce (24oz)',
      category: 'Pantry',
      price: 7.49,
      stockQuantity: 16,
      aisleLocation: 'Aisle 3 - Shelf D',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=400&q=80',
      description: 'Slow-simmered Italian tomatoes, fresh garlic and sweet basil.'
    },

    // Aisle 4 - Snacks & Beverages
    {
      id: 'prod_chips',
      title: 'Kettle Cooked Himalayan Pink Salt Chips',
      category: 'Snacks',
      price: 3.79,
      stockQuantity: 22,
      aisleLocation: 'Aisle 4 - Shelf A',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80',
      description: 'Batch-fried thick cut potato chips with mineral pink salt.'
    },
    {
      id: 'prod_water',
      title: 'Sparkling Mineral Water (8x12oz Cans)',
      category: 'Beverages',
      price: 6.29,
      stockQuantity: 18,
      aisleLocation: 'Aisle 4 - Shelf B',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80',
      description: 'Zero calorie mountain spring sparkling water with natural fizz.'
    },
    {
      id: 'prod_coldbrew',
      title: 'Nitro Cold Brew Espresso Blend (32oz)',
      category: 'Beverages',
      price: 6.99,
      stockQuantity: 9,
      aisleLocation: 'Aisle 4 - Shelf C',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=400&q=80',
      description: 'Micro-steeped Arabica coffee with velvety crema.'
    },
    {
      id: 'prod_chocolate',
      title: '72% Dark Chocolate with Roasted Sea Salt Almonds',
      category: 'Snacks',
      price: 3.49,
      stockQuantity: 25,
      aisleLocation: 'Aisle 4 - Shelf D',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=400&q=80',
      description: 'Single-origin Ecuadorian cacao with whole roasted almonds.'
    },

    // Aisle 5 - Household
    {
      id: 'prod_towels',
      title: 'Ultra-Absorbent Bamboo Paper Towels (6 Rolls)',
      category: 'Household',
      price: 11.99,
      stockQuantity: 14,
      aisleLocation: 'Aisle 5 - Shelf A',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
      description: 'Sustainable unbleached 2-ply high-absorption sheets.'
    },
    {
      id: 'prod_soap',
      title: 'Organic Citrus & Eucalyptus Dish Soap (24oz)',
      category: 'Household',
      price: 3.99,
      stockQuantity: 20,
      aisleLocation: 'Aisle 5 - Shelf B',
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=400&q=80',
      description: 'Plant-derived degreaser with invigorating natural essential oils.'
    }
  ];

  // 3. Realistic Demo Orders showcasing different states
  const orders = [
    {
      id: 'ord_demo_101',
      orderCode: 'S01-#001',
      branchId: 'S01',
      customerId: 'usr_cust_1',
      customerName: 'Marcus Vance',
      customerPhone: '+1 (555) 392-1084',
      items: [
        {
          productId: 'prod_milk',
          title: 'Organic Whole Milk (1 Gallon)',
          qty: 1,
          price: 4.49,
          aisleLocation: 'Aisle 1 - Shelf A',
          note: 'Check expiration date past next week please',
          isPicked: true
        },
        {
          productId: 'prod_eggs',
          title: 'Pasture-Raised Grade A Eggs (12pk)',
          qty: 1,
          price: 4.19,
          aisleLocation: 'Aisle 1 - Shelf D',
          note: 'Please verify no cracked eggs',
          isPicked: true
        },
        {
          productId: 'prod_apples',
          title: 'Crisp Honeycrisp Apples (3lb Bag)',
          qty: 1,
          price: 6.49,
          aisleLocation: 'Aisle 2 - Shelf A',
          note: '',
          isPicked: true
        }
      ],
      totalAmount: 15.17,
      pickupSlot: '5:15 PM – 5:30 PM',
      holdingBin: 'Locker B-04',
      pin: '4821',
      status: 'ready', // Picker finished, ready at counter!
      customerArrived: false,
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      packedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
    },
    {
      id: 'ord_demo_102',
      orderCode: 'S01-#002',
      branchId: 'S01',
      customerId: 'usr_cust_1',
      customerName: 'Sarah Jenkins',
      customerPhone: '+1 (555) 749-3012',
      items: [
        {
          productId: 'prod_butter',
          title: 'Pure Irish Grass-Fed Butter (8oz)',
          qty: 2,
          price: 4.99,
          aisleLocation: 'Aisle 1 - Shelf C',
          note: '',
          isPicked: true
        },
        {
          productId: 'prod_bananas',
          title: 'Fresh Organic Bananas (Bunch)',
          qty: 1,
          price: 2.29,
          aisleLocation: 'Aisle 2 - Shelf B',
          note: 'Select slightly greenish bunch',
          isPicked: false
        },
        {
          productId: 'prod_coldbrew',
          title: 'Nitro Cold Brew Espresso Blend (32oz)',
          qty: 1,
          price: 6.99,
          aisleLocation: 'Aisle 4 - Shelf C',
          note: '',
          isPicked: false
        }
      ],
      totalAmount: 19.26,
      pickupSlot: '5:30 PM – 5:45 PM',
      holdingBin: null,
      pin: '7392',
      status: 'picking', // Currently being picked on the floor
      customerArrived: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      packedAt: null
    },
    {
      id: 'ord_demo_103',
      orderCode: 'S01-#003',
      branchId: 'S01',
      customerId: 'usr_cust_1',
      customerName: 'Jordan Taylor',
      customerPhone: '+1 (555) 821-4991',
      items: [
        {
          productId: 'prod_sourdough',
          title: 'Handcrafted Artisan Sourdough Loaf',
          qty: 1,
          price: 5.49,
          aisleLocation: 'Aisle 3 - Shelf A',
          note: '',
          isPicked: false
        },
        {
          productId: 'prod_pasta',
          title: 'Bronze-Cut Penne Rigate (16oz)',
          qty: 2,
          price: 2.79,
          aisleLocation: 'Aisle 3 - Shelf C',
          note: '',
          isPicked: false
        },
        {
          productId: 'prod_sauce',
          title: 'San Marzano Tomato & Basil Sauce (24oz)',
          qty: 1,
          price: 7.49,
          aisleLocation: 'Aisle 3 - Shelf D',
          note: '',
          isPicked: false
        }
      ],
      totalAmount: 18.56,
      pickupSlot: '5:45 PM – 6:00 PM',
      holdingBin: null,
      pin: '3150',
      status: 'placed', // Fresh incoming order
      customerArrived: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      packedAt: null
    }
  ];

  // Set in-memory master state
  db.state.users = users;
  db.state.products = products;
  db.state.orders = orders;
  db.state.reservations = [];
  
  // Set sequential counter to reflect the 3 initial demo orders
  const today = new Date().toISOString().slice(0, 10);
  db.state.dailyCounters[`S01_${today}`] = 3;

  // Persist to disk
  db.persist();

  console.log('[Seed] Successfully seeded:');
  console.log(` - ${users.length} Users`);
  console.log(` - ${products.length} Products`);
  console.log(` - ${orders.length} Sample Orders`);
  console.log(` - Daily Sequential Counter set to 3 (next order will be S01-#004)`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}

module.exports = seed;
