// controllers/orderController.js — Place & manage orders

const PDFDocument = require('pdfkit');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const { createError } = require('../middleware/errorHandler');

// ────────────────────────────────────────────────────────────
// POST /api/orders
// Customer (optionally authenticated) places an order
// ────────────────────────────────────────────────────────────
exports.placeOrder = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      address,
      payment,
      items,       // [{ productId, qty }]
    } = req.body;

    if (!items || items.length === 0) {
      return next(createError('Order must contain at least one item.', 400));
    }

    // ── Validate stock & build order items ──────────────────
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, isActive: true });

      if (!product) {
        return next(createError(`Product not found: ${item.productId}`, 404));
      }
      if (product.stock < item.qty) {
        return next(
          createError(
            `Insufficient stock for "${product.name}". Available: ${product.stock}`,
            400
          )
        );
      }

      const itemSubtotal = product.price * item.qty;
      subtotal += itemSubtotal;

      orderItems.push({
        product:  product._id,
        name:     product.name,
        emoji:    product.emoji,
        price:    product.price,
        qty:      item.qty,
        subtotal: itemSubtotal,
      });
    }

    const delivery = subtotal >= 499 ? 0 : 49;
    const total    = subtotal + delivery;

    // ── Create order in DB ───────────────────────────────────
    const order = await Order.create({
      customer:      req.user ? req.user._id : null,
      customerName,
      customerPhone,
      customerEmail: customerEmail || (req.user ? req.user.email : null),
      address,
      payment:       { method: payment || 'Cash on Delivery', status: 'pending' },
      items:         orderItems,
      subtotal,
      delivery,
      total,
    });

    // ── Deduct stock AFTER order is saved ────────────────────
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.qty } }
      );
    }

    res.status(201).json({
      success:  true,
      orderId:  order.orderId,
      total,
      delivery,
      message:  'Order placed successfully!',
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/orders/my  (customer — protected)
// ────────────────────────────────────────────────────────────
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/orders  (admin only)
// Supports ?status=placed&page=1&limit=20
// ────────────────────────────────────────────────────────────
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('customer', 'name email');

    // Dashboard summary stats
    const stats = {
      total:       await Order.countDocuments(),
      placed:      await Order.countDocuments({ status: 'placed' }),
      dispatched:  await Order.countDocuments({ status: 'dispatched' }),
      delivered:   await Order.countDocuments({ status: 'delivered' }),
    };

    res.json({
      success: true,
      stats,
      total,
      page:   Number(page),
      pages:  Math.ceil(total / Number(limit)),
      orders,
    });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/orders/:id  (admin only)
// ────────────────────────────────────────────────────────────
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        { orderId: req.params.id },
      ],
    }).populate('customer', 'name email');

    if (!order) return next(createError('Order not found.', 404));
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status  (admin only)
// Body: { status } — update order status
// ────────────────────────────────────────────────────────────
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['placed', 'confirmed', 'packed', 'dispatched', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return next(createError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) return next(createError('Order not found.', 404));

    // If cancelled, restore stock
    if (status === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.qty } }
        );
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/orders/:id/invoice  (logged-in customer, own orders only)
// Streams a generated PDF invoice back to the client.
// ────────────────────────────────────────────────────────────
exports.downloadInvoice = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
        { orderId: req.params.id },
      ],
    });

    if (!order) return next(createError('Order not found.', 404));

    // Ownership check — a customer can only download their own invoice.
    // Admin tokens (req.user.role === 'admin') can download any invoice.
    const isAdmin = req.user.role === 'admin';
    const isOwner = order.customer && order.customer.toString() === req.user._id?.toString();

    if (!isAdmin && !isOwner) {
      return next(createError('You are not authorised to view this invoice.', 403));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header ────────────────────────────────────────────────
    doc
      .fillColor('#16316F')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('AMAN MEDICAL', 50, 50)
      .fontSize(9)
      .fillColor('#2BA199')
      .font('Helvetica')
      .text('YOUR HEALTH PARTNER', 50, 76);

    doc
      .fillColor('#444')
      .fontSize(10)
      .text('INVOICE', 400, 50, { align: 'right' })
      .fontSize(10)
      .text(`Order ID: ${order.orderId}`, 400, 68, { align: 'right' })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 400, 82, { align: 'right' })
      .text(`Status: ${order.status.toUpperCase()}`, 400, 96, { align: 'right' });

    doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#E5E9F0').stroke();

    // ── Billed-to block ───────────────────────────────────────
    doc
      .fillColor('#16316F')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Billed To', 50, 135)
      .font('Helvetica')
      .fillColor('#333')
      .fontSize(10)
      .text(order.customerName, 50, 152)
      .text(order.customerPhone, 50, 167)
      .text(order.address, 50, 182, { width: 280 });

    doc
      .fillColor('#16316F')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Payment', 380, 135)
      .font('Helvetica')
      .fillColor('#333')
      .fontSize(10)
      .text(`Method: ${order.payment.method}`, 380, 152)
      .text(`Status: ${order.payment.status}`, 380, 167);

    // ── Items table ───────────────────────────────────────────
    let y = 230;
    doc
      .fillColor('#fff')
      .rect(50, y, 495, 24)
      .fill('#16316F');

    doc
      .fillColor('#fff')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Item', 60, y + 7)
      .text('Qty', 330, y + 7, { width: 50, align: 'center' })
      .text('Price', 390, y + 7, { width: 70, align: 'right' })
      .text('Subtotal', 470, y + 7, { width: 65, align: 'right' });

    y += 24;

    order.items.forEach((item, i) => {
      const rowHeight = 22;
      if (i % 2 === 1) {
        doc.fillColor('#F5F8FC').rect(50, y, 495, rowHeight).fill();
      }
      doc
        .fillColor('#222')
        .font('Helvetica')
        .fontSize(9.5)
        .text(item.name, 60, y + 6, { width: 260 })
        .text(String(item.qty), 330, y + 6, { width: 50, align: 'center' })
        .text(`Rs ${item.price.toFixed(2)}`, 390, y + 6, { width: 70, align: 'right' })
        .text(`Rs ${item.subtotal.toFixed(2)}`, 470, y + 6, { width: 65, align: 'right' });
      y += rowHeight;
    });

    doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#E5E9F0').stroke();
    y += 20;

    // ── Totals ────────────────────────────────────────────────
    const totalsX = 380;
    doc.font('Helvetica').fontSize(10).fillColor('#444');
    doc.text('Subtotal', totalsX, y, { width: 90 }).text(`Rs ${order.subtotal.toFixed(2)}`, 470, y, { width: 65, align: 'right' });
    y += 16;
    doc.text('Delivery', totalsX, y, { width: 90 }).text(order.delivery === 0 ? 'FREE' : `Rs ${order.delivery.toFixed(2)}`, 470, y, { width: 65, align: 'right' });
    y += 20;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#16316F')
      .text('Total', totalsX, y, { width: 90 })
      .text(`Rs ${order.total.toFixed(2)}`, 470, y, { width: 65, align: 'right' });

    // ── Footer ────────────────────────────────────────────────
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#999')
      .text(
        'This is a system-generated invoice from AMAN MEDICAL. For queries, contact support@amanmedical.in',
        50,
        740,
        { width: 495, align: 'center' }
      );

    doc.end();
  } catch (err) {
    next(err);
  }
};
