// utils/seed.js — Seed MongoDB with the AMAN MEDICAL product catalog
// Run: node utils/seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const connectDB = require('../config/db');

const PRODUCTS = [
  { name:'Paracetamol 500mg (Strip of 15)',  category:'Medicines',     emoji:'💊', price:35,   oldPrice:45,   stock:142, lowStockThreshold:20, rx:false, tag:'sale', bg:'#E9F0FB', rating:4.7, desc:'Fast-acting fever and pain relief tablets. Suitable for headaches, body ache, and mild fever.',                            unit:'15 tablets',    mfg:'GenPharma Labs'   },
  { name:'Amoxicillin 250mg Capsules',        category:'Medicines',     emoji:'💊', price:68,   oldPrice:null, stock:8,   lowStockThreshold:15, rx:true,  tag:null,   bg:'#E9F0FB', rating:4.6, desc:'Broad-spectrum antibiotic capsules. Requires valid prescription for purchase.',                                             unit:'10 capsules',   mfg:'CurePoint Pharma' },
  { name:'Cetirizine 10mg Tablets',           category:'Medicines',     emoji:'💊', price:22,   oldPrice:null, stock:96,  lowStockThreshold:20, rx:false, tag:null,   bg:'#E9F0FB', rating:4.5, desc:'Antihistamine for allergy relief — sneezing, runny nose, and itchy eyes.',                                                 unit:'10 tablets',    mfg:'AllerCare'        },
  { name:'ORS Electrolyte Sachets',           category:'Medicines',     emoji:'🧂', price:18,   oldPrice:null, stock:0,   lowStockThreshold:25, rx:false, tag:null,   bg:'#E9F0FB', rating:4.8, desc:'Oral rehydration salts to quickly restore fluids and electrolytes.',                                                       unit:'Pack of 5',     mfg:'HydraLyte'        },
  { name:'Digital BP Monitor',                category:'Devices',       emoji:'🩺', price:1499, oldPrice:1899, stock:14,  lowStockThreshold:8,  rx:false, tag:'sale', bg:'#FFF1E0', rating:4.6, desc:'Automatic upper-arm blood pressure monitor with large LCD display and memory storage.',                                    unit:'1 unit',        mfg:'VitalCheck'       },
  { name:'Digital Infrared Thermometer',      category:'Devices',       emoji:'🌡️', price:899,  oldPrice:null, stock:22,  lowStockThreshold:10, rx:false, tag:'new',  bg:'#FFF1E0', rating:4.7, desc:'Non-contact infrared thermometer for fast, accurate readings — ideal for all ages.',                                       unit:'1 unit',        mfg:'ThermoSafe'       },
  { name:'Pulse Oximeter',                    category:'Devices',       emoji:'🫁', price:1199, oldPrice:1499, stock:6,   lowStockThreshold:8,  rx:false, tag:'sale', bg:'#FFF1E0', rating:4.5, desc:'Fingertip pulse oximeter measuring SpO2 and pulse rate with bright OLED display.',                                        unit:'1 unit',        mfg:'VitalCheck'       },
  { name:'Nebulizer Machine',                 category:'Devices',       emoji:'🌬️', price:2199, oldPrice:null, stock:5,   lowStockThreshold:5,  rx:false, tag:null,   bg:'#FFF1E0', rating:4.4, desc:'Compact compressor nebulizer for effective respiratory medication delivery at home.',                                      unit:'1 unit',        mfg:'BreathEase'       },
  { name:'Vitamin C 1000mg Tablets',          category:'Wellness',      emoji:'🍊', price:299,  oldPrice:349,  stock:58,  lowStockThreshold:15, rx:false, tag:'sale', bg:'#E7F7F3', rating:4.6, desc:'Immunity-boosting Vitamin C tablets with zinc for daily wellness support.',                                               unit:'30 tablets',    mfg:'NutriLife'        },
  { name:'Multivitamin Daily Capsules',       category:'Wellness',      emoji:'🌿', price:449,  oldPrice:null, stock:0,   lowStockThreshold:15, rx:false, tag:null,   bg:'#E7F7F3', rating:4.5, desc:'Complete daily multivitamin and mineral formula for adults.',                                                              unit:'60 capsules',   mfg:'NutriLife'        },
  { name:'Omega-3 Fish Oil Capsules',         category:'Wellness',      emoji:'🐟', price:599,  oldPrice:699,  stock:31,  lowStockThreshold:12, rx:false, tag:'sale', bg:'#E7F7F3', rating:4.7, desc:'High-strength omega-3 fatty acids supporting heart and brain health.',                                                    unit:'60 capsules',   mfg:'PureWell'         },
  { name:'Probiotic Gut Health Capsules',     category:'Wellness',      emoji:'🦠', price:649,  oldPrice:null, stock:19,  lowStockThreshold:10, rx:false, tag:'new',  bg:'#E7F7F3', rating:4.4, desc:'Multi-strain probiotic blend to support digestive balance and gut health.',                                               unit:'30 capsules',   mfg:'BioFlora'         },
  { name:'N95 Respirator Masks',              category:'Safety',        emoji:'😷', price:249,  oldPrice:299,  stock:210, lowStockThreshold:30, rx:false, tag:'sale', bg:'#FFE9E5', rating:4.8, desc:'5-layer protection N95 masks with adjustable nose clip, individually packed.',                                            unit:'Pack of 10',    mfg:'SafeBreathe'      },
  { name:'Hand Sanitizer 500ml',              category:'Safety',        emoji:'🧴', price:149,  oldPrice:null, stock:76,  lowStockThreshold:20, rx:false, tag:null,   bg:'#FFE9E5', rating:4.6, desc:'70% alcohol-based sanitizer gel that kills 99.9% of germs without drying skin.',                                         unit:'500ml bottle',  mfg:'CleanGuard'       },
  { name:'Nitrile Examination Gloves',        category:'Safety',        emoji:'🧤', price:399,  oldPrice:null, stock:12,  lowStockThreshold:15, rx:false, tag:null,   bg:'#FFE9E5', rating:4.5, desc:'Powder-free nitrile gloves, latex-free, suitable for sensitive skin.',                                                   unit:'Box of 100',    mfg:'SafeHands'        },
  { name:'First Aid Kit — Family Size',       category:'Safety',        emoji:'🩹', price:799,  oldPrice:949,  stock:24,  lowStockThreshold:10, rx:false, tag:'sale', bg:'#FFE9E5', rating:4.7, desc:'Comprehensive first aid kit with bandages, antiseptics, and emergency tools for home use.',                             unit:'1 kit',         mfg:'ReadyCare'        },
  { name:'Adult Diapers (Medium)',             category:'Personal Care', emoji:'🧷', price:599,  oldPrice:null, stock:17,  lowStockThreshold:12, rx:false, tag:null,   bg:'#FDE9F3', rating:4.3, desc:'Highly absorbent adult diapers with leak-proof design for all-day comfort.',                                             unit:'Pack of 10',    mfg:'ComfortPlus'      },
  { name:'Orthopedic Knee Support Brace',     category:'Personal Care', emoji:'🦵', price:549,  oldPrice:649,  stock:9,   lowStockThreshold:10, rx:false, tag:'sale', bg:'#FDE9F3', rating:4.5, desc:'Breathable compression knee brace for joint support during recovery or activity.',                                       unit:'1 unit (M/L/XL)',mfg:'OrthoFit'       },
  { name:'Baby Diaper Rash Cream',            category:'Personal Care', emoji:'👶', price:189,  oldPrice:null, stock:44,  lowStockThreshold:15, rx:false, tag:null,   bg:'#FDE9F3', rating:4.6, desc:"Gentle zinc oxide cream that soothes and protects baby's sensitive skin.",                                              unit:'100g tube',     mfg:'BabySoft'         },
  { name:'Glucometer with Test Strips',       category:'Devices',       emoji:'🩸', price:999,  oldPrice:1299, stock:3,   lowStockThreshold:6,  rx:false, tag:'sale', bg:'#FFF1E0', rating:4.6, desc:'Accurate blood glucose monitoring kit with 25 free test strips included.',                                               unit:'1 kit',         mfg:'VitalCheck'       },
];

const seed = async () => {
  await connectDB();

  console.log('🌱 Seeding database...');

  // Drop existing products (clean re-seed)
  await Product.deleteMany({});
  console.log('🗑️  Existing products cleared');

  const inserted = await Product.insertMany(PRODUCTS);
  console.log(`✅ ${inserted.length} products inserted`);

  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed. Seed complete!');
};

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
