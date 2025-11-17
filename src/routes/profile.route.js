import express from 'express';
import {
    getProfile,
    updateProfile,
    checkUsernameAvailability,
    getProblemsStats,
    getHeatmapData,
    getRecentSubmissions,
    followUser,
    unfollowUser,
    getFollowStatus
} from '../controllers/profile.controller.js';
import { checkAuth as authMiddleware } from '../middlewares/checkAuthMiddleware.js';

const router = express.Router();

// ========================================
// PUBLIC ROUTES (No Authentication Required)
// ========================================

// Username availability check (public utility)
router.get('/profile/username-check', checkUsernameAvailability);

// View any user's profile by username
router.get('/:username/profile', getProfile);

// Get problem statistics by username
router.get('/:username/problems-stats', getProblemsStats);

// Get heatmap data by username (optional query: ?year=2024)
router.get('/:username/heatmap', getHeatmapData);

// Get recent submissions by username
router.get('/:username/recent-submissions', getRecentSubmissions);

// ========================================
// PROTECTED ROUTES (Authentication Required)
// ========================================

// Apply authentication middleware to all routes below this point
router.use(authMiddleware);

// Update own profile (requires authentication)
router.patch('/profile', updateProfile);



// Follow/Unfollow Routes
router.post('/:username/follow', followUser);
router.delete('/:username/unfollow', unfollowUser);
router.get('/:username/follow-status', getFollowStatus);

export default router;
