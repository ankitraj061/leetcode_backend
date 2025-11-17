// routes/submissions.js
import express from 'express';
import { checkAuth } from '../middlewares/checkAuthMiddleware.js';
import { getUserSubmissionsForProblem, getSubmissionDetails,addOrUpdateNotes } from '../controllers/submission.controller.js';

const router = express.Router();

// Get all submissions for a problem by user
router.get('/problems/:problemId/submissions', checkAuth, getUserSubmissionsForProblem);

// Get specific submission details
router.get('/submissions/:submissionId', checkAuth, getSubmissionDetails);
router.post('/submissions/:submissionId/notes', checkAuth, addOrUpdateNotes);


export default router;
