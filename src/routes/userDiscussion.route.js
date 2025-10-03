import express from 'express';
import {
    getProblemDiscussions,
    getDiscussion,
    createDiscussion,
    updateDiscussion,
    deleteDiscussion,
    addReply,
    voteDiscussion,
    voteReply,
    getMyDiscussions,
    deleteOwnReply,
    editOwnReply  // ADD THIS IMPORT
} from '../controllers/userDiscussion.controller.js';
import { userMiddleware } from '../middlewares/userMiddleware.js';
import { activeAccountMiddleware } from '../middlewares/activeAccountMiddleware.js';
import { emailVerificationMiddleware } from '../middlewares/emailVerificationMiddleware.js';
import { discussionRateLimitMiddleware } from '../middlewares/discussionRateLimitMiddleware.js';
import { ipRateLimitMiddleware } from '../middlewares/ipRateLimitMiddleware.js';
import { requestLoggingMiddleware } from '../middlewares/requestLoggingMiddleware.js';
import { validateInput } from '../middlewares/inputValidationMiddleware.js';
import { 
    discussionCreationSchema, 
    discussionUpdateSchema,
    replySchema,
    voteSchema
} from '../validations/discussionSchemas.js';

const userDiscussionRouter = express.Router();

// Get user's own discussions
userDiscussionRouter.get('/my',
    ipRateLimitMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getMyDiscussions
);

// Get discussions for a specific problem
userDiscussionRouter.get('/problem/:problemId',
    ipRateLimitMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getProblemDiscussions
);

// Get single discussion
userDiscussionRouter.get('/:discussionId',
    ipRateLimitMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getDiscussion
);

// Create new discussion
userDiscussionRouter.post('/',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    emailVerificationMiddleware,
    // discussionRateLimitMiddleware,
    validateInput(discussionCreationSchema),
    createDiscussion
);

// Update own discussion
userDiscussionRouter.put('/:discussionId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    validateInput(discussionUpdateSchema),
    updateDiscussion
);

// Delete own discussion
userDiscussionRouter.delete('/:discussionId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    deleteDiscussion
);

// Add reply to discussion
userDiscussionRouter.post('/:discussionId/replies',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    emailVerificationMiddleware,
    // discussionRateLimitMiddleware,
    validateInput(replySchema),
    addReply
);

// EDIT OWN REPLY - ADD THIS ROUTE
userDiscussionRouter.put('/:discussionId/replies/:replyId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    validateInput(replySchema),
    editOwnReply
);

// Vote on discussion
userDiscussionRouter.post('/:discussionId/vote',
    ipRateLimitMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    validateInput(voteSchema),
    voteDiscussion
);

// Vote on reply
userDiscussionRouter.post('/:discussionId/replies/:replyId/vote',
    ipRateLimitMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    validateInput(voteSchema),
    voteReply
);

// Delete own reply
userDiscussionRouter.delete('/:discussionId/replies/:replyId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    deleteOwnReply
);

export default userDiscussionRouter;
