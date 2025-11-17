import express from 'express';
import { checkAuth } from '../middlewares/checkAuthMiddleware.js';
import {
    saveSolutionDraft,
    getSolutionDraft,
    deleteSolutionDraft,
    getUserDrafts
} from '../controllers/draft.controller.js';

const router = express.Router();

// All routes require authentication
router.use(checkAuth);

// Problem-specific draft routes
router.post('/problems/:problemId/draft', saveSolutionDraft);
router.get('/problems/:problemId/draft', getSolutionDraft);
router.delete('/problems/:problemId/draft', deleteSolutionDraft);

// User draft management
router.get('/drafts', getUserDrafts);

export default router;
