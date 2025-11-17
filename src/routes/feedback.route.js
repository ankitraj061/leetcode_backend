import express from 'express';
const router = express.Router();
import { submitFeedback, getUserFeedback } from '../controllers/feedback.controller.js';
import { checkAuth } from '../middlewares/checkAuthMiddleware.js';

// Apply checkAuth middleware to all routes
router.use(checkAuth);

router.route('/')
  .post(submitFeedback)
  .get(getUserFeedback);

export default router;