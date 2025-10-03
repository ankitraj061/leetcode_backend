import express from 'express';
import { createOrder, verifyPayment, webhookHandler } from '../controllers/payment.controller.js';
import { checkAuth } from '../middlewares/checkAuthMiddleware.js';

const router = express.Router();

// Create order (authenticated)
router.post('/create-order', checkAuth, createOrder);

// Verify payment coming from frontend (authenticated)
router.post('/verify-payment', checkAuth, verifyPayment);

// Webhook: this route must receive raw body; we will attach express.raw middleware when mounting.
// For modularity, we just export route name — but see mounting below for express.raw.
router.post('/webhook', webhookHandler);

export default router;
