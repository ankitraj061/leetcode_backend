import { body, param, validationResult } from 'express-validator';

const validateChatRequest = [
  param('problemId')
    .isMongoId()
    .withMessage('Invalid problem ID'),
  
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message cannot be empty')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('conversationHistory')
    .optional()
    .isArray()
    .withMessage('Conversation history must be an array')
    .custom((history) => {
      if (history.length > 20) {
        throw new Error('Conversation history too long. Maximum 20 messages.');
      }
      return true;
    }),
  
  body('conversationHistory.*.role')
    .optional()
    .isIn(['user', 'assistant'])
    .withMessage('Invalid message role'),
  
  body('conversationHistory.*.content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Message content cannot be empty'),

  // Validation error handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  }
];

export { validateChatRequest };
