import Joi from 'joi';

// For both user and admin discussion creation
export const discussionCreationSchema = Joi.object({
    problemId: Joi.string().required(),
    title: Joi.string().min(5).max(200).required(),
    content: Joi.string().min(10).required(),
    type: Joi.string().valid('question', 'solution', 'hint', 'general').required(),
    tags: Joi.array().items(Joi.string().max(50)).max(5),
    onBehalfOfUserId: Joi.string(), // Admin only field
    // Admin-specific fields for creation
    isPinned: Joi.boolean().default(false),
    isSolution: Joi.boolean().default(false),
    isAccepted: Joi.boolean().default(false)
});

export const discussionUpdateSchema = Joi.object({
    title: Joi.string().min(5).max(200),
    content: Joi.string().min(10),
    type: Joi.string().valid('question', 'solution', 'hint', 'general'),
    tags: Joi.array().items(Joi.string().max(50)).max(5),
    isSolution: Joi.boolean(),
    isAccepted: Joi.boolean(),
    isPinned: Joi.boolean()
}).min(1);

export const replySchema = Joi.object({
    content: Joi.string().min(3).max(2000).required()
});

export const voteSchema = Joi.object({
    voteType: Joi.string().valid('upvote', 'downvote').required()
});

export const bulkActionSchema = Joi.object({
    discussionIds: Joi.array().items(Joi.string()).min(1).required(),
    action: Joi.string().valid('delete', 'pin', 'updateType', 'markSolution').required(), // Added 'markSolution'
    data: Joi.object({
        isPinned: Joi.boolean(),
        type: Joi.string().valid('question', 'solution', 'hint', 'general'),
        isSolution: Joi.boolean() // Added for markSolution action
    })
});

// Admin-specific schemas
export const pinToggleSchema = Joi.object({
    isPinned: Joi.boolean().required()
});

export const solutionMarkSchema = Joi.object({
    isSolution: Joi.boolean(),
    isAccepted: Joi.boolean()
}).min(1);
