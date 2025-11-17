import express from 'express';
const router = express.Router();
import chatController from '../controllers/chat.controller.js';
import { validateChatRequest } from '../middlewares/chatValidator.js';
import { userMiddleware } from '../middlewares/userMiddleware.js';

// Send chat message (public or authenticated)
router.post(
  '/problem/:problemId',
//   chatRateLimiter,
  validateChatRequest,
  chatController.sendMessage
);

// // Get chat history (requires auth)
// router.get(
//   '/problem/:problemId/history',
// //   authMiddleware.authenticate, // Optional: your auth middleware
//   chatController.getChatHistory
// );

// // Clear chat history (requires auth)
// router.delete(
//   '/problem/:problemId/history',
//   userMiddleware,
//   chatController.clearChatHistory
// );

export default router;