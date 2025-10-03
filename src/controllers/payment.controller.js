import Razorpay from 'razorpay';
import crypto from 'crypto';
import Payment from '../models/payment.js';
import User from '../models/user.js';
import dotenv from 'dotenv';
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Configure your plan amounts (in paise) and durations (days)
const PLANS = {
  monthly: { amount: 100, durationDays: 30 },  // ₹1.00 -> 100 paise
  yearly:  { amount: 600, durationDays: 365 } // ₹6.00 -> 600 paise
};

export const createOrder = async (req, res) => {
  try {
    // Prefer extracting user id from auth middleware (req.user or req.userId)
    const userId = (req.user && req.user._id) || req.body.userId;
    const { plan } = req.body;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!PLANS[plan]) return res.status(400).json({ message: 'Invalid plan' });

    const { amount } = PLANS[plan];
const generateShortReceipt = (userId) => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits
  const userIdShort = userId.toString().slice(-8); // Convert ObjectId to string first
  return `${userIdShort}_${timestamp}`; // Format: abcdef12_123456 (15 chars)
};



    const options = {
      amount, // in paise
      currency: 'INR',
      receipt: generateShortReceipt(userId),
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    // Save payment record
    const payment = await Payment.create({
      user: userId,
      plan,
      amount: order.amount,
      currency: order.currency,
      razorpayOrderId: order.id,
      status: 'created'
    });

    return res.json({
      success: true,
      order,            // send order.id etc to frontend
      paymentId: payment._id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('createOrder err', err);
    return res.status(500).json({ success: false, message: 'Order creation failed' });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    // Data from frontend after checkout success
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan
    } = req.body;

    // verify signature using key_secret
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // update payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, status: 'paid' },
      { new: true }
    );

    if (!payment) {
      console.warn('Payment record not found for order', razorpay_order_id);
    }

    // Update user's subscriptionExpiry intelligently:
    const user = await User.findById(payment.user);
    const now = new Date();
    const currentExpiry = user?.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
    const startDate = currentExpiry && currentExpiry > now ? currentExpiry : now;

    const durationDays = PLANS[plan]?.durationDays || PLANS['monthly'].durationDays;
    const newExpiry = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      subscriptionType: 'premium',
      subscriptionExpiry: newExpiry
    });

    return res.json({ success: true, message: 'Payment verified and subscription updated', expiry: newExpiry });
  } catch (err) {
    console.error('verifyPayment err', err);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// Webhook handler — use express.raw for body (see below)
export const webhookHandler = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // req.body here is the **raw** body (Buffer) because route will use express.raw
    const body = req.body; // Buffer
    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

    if (expected !== signature) {
      console.warn('Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(body.toString());
    // handle events — example: payment.captured
    if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { razorpayPaymentId: paymentId, status: 'paid' },
        { new: true }
      );

      if (payment) {
        const user = await User.findById(payment.user);
        const now = new Date();
        const currentExpiry = user?.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
        const startDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
        const durationDays = PLANS[payment.plan].durationDays;
        const newExpiry = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(user._id, {
          subscriptionType: 'premium',
          subscriptionExpiry: newExpiry
        });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('webhookHandler err', err);
    return res.status(500).send('error');
  }
};
