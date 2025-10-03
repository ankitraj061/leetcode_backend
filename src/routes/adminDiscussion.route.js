import express from 'express';
import {
    getAllDiscussions,
    getDiscussionById,
    createDiscussion,
    updateDiscussion,
    deleteDiscussion,
    toggleDiscussionPin,
    markAsSolution,
    bulkDiscussionActions,
    getDiscussionStats,
    deleteReply
} from '../controllers/adminDiscussion.controller.js';
import { adminMiddleware } from '../middlewares/adminMiddleware.js';
import { activeAccountMiddleware } from '../middlewares/activeAccountMiddleware.js';
import { ipRateLimitMiddleware } from '../middlewares/ipRateLimitMiddleware.js';
import { requestLoggingMiddleware } from '../middlewares/requestLoggingMiddleware.js';
import { validateInput } from '../middlewares/inputValidationMiddleware.js';
import { 
    discussionCreationSchema, 
    discussionUpdateSchema,
    bulkActionSchema,
    pinToggleSchema,
    solutionMarkSchema
} from '../validations/discussionSchemas.js';

const adminDiscussionRouter = express.Router();

// Apply common middlewares to all routes
adminDiscussionRouter.use(ipRateLimitMiddleware);
adminDiscussionRouter.use(requestLoggingMiddleware);
adminDiscussionRouter.use(adminMiddleware);
adminDiscussionRouter.use(activeAccountMiddleware);

// Get all discussions with admin filters
adminDiscussionRouter.get('/', getAllDiscussions);

// Get discussion statistics
adminDiscussionRouter.get('/stats', getDiscussionStats);

// Get single discussion
adminDiscussionRouter.get('/:discussionId', getDiscussionById);

// Create new discussion
adminDiscussionRouter.post('/', 
    validateInput(discussionCreationSchema),
    createDiscussion
);

// Update discussion
adminDiscussionRouter.put('/:discussionId',
    validateInput(discussionUpdateSchema),
    updateDiscussion
);

// Delete discussion
adminDiscussionRouter.delete('/:discussionId', deleteDiscussion);

// Pin/Unpin discussion
adminDiscussionRouter.put('/:discussionId/pin',
    validateInput(pinToggleSchema),
    toggleDiscussionPin
);

// Mark as solution/Accept solution
adminDiscussionRouter.put('/:discussionId/solution',
    validateInput(solutionMarkSchema),
    markAsSolution
);

// Delete reply
adminDiscussionRouter.delete('/:discussionId/replies/:replyId', deleteReply);

// Bulk actions
adminDiscussionRouter.post('/bulk',
    validateInput(bulkActionSchema),
    bulkDiscussionActions
);

export default adminDiscussionRouter;
