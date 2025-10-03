import Discussion from "../models/discussion.js";
import Problem from "../models/problem.js";
import User from "../models/user.js";
import mongoose from 'mongoose';

// Get all discussions with admin filters and pagination
export const getAllDiscussions = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            type, 
            problemId, 
            userId,
            sortBy = 'createdAt',
            order = 'desc',
            search,
            isPinned,
            isAccepted
        } = req.query;
        
        // Build filter object
        const filter = {};
        if (type) filter.type = type;
        if (problemId) filter.problemId = problemId;
        if (userId) filter.userId = userId;
        if (isPinned !== undefined) filter.isPinned = isPinned === 'true';
        if (isAccepted !== undefined) filter.isAccepted = isAccepted === 'true';
        
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Sort options
        const sortOptions = {};
        if (sortBy === 'votes') {
            // Sort by total votes (upvotes - downvotes)
            sortOptions._id = order === 'desc' ? -1 : 1; // Fallback sort
        } else {
            sortOptions[sortBy] = order === 'desc' ? -1 : 1;
        }
        
        const discussions = await Discussion.find(filter)
            .populate('userId', 'username profilePicture email createdAt isActive')
            .populate('problemId', 'title difficulty isActive isPremium')
            .populate('replies.userId', 'username profilePicture')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Discussion.countDocuments(filter);
        
        // Add vote counts and reply counts for admin dashboard
        const discussionsWithStats = discussions.map(discussion => {
            const discussionObj = discussion.toObject();
            
            // Ensure arrays exist
            if (!Array.isArray(discussionObj.upvotes)) discussionObj.upvotes = [];
            if (!Array.isArray(discussionObj.downvotes)) discussionObj.downvotes = [];
            
            return {
                ...discussionObj,
                upvoteCount: discussionObj.upvotes.length,
                downvoteCount: discussionObj.downvotes.length,
                replyCount: discussionObj.replies.length,
                score: discussionObj.upvotes.length - discussionObj.downvotes.length
            };
        });
        
        res.json({
            success: true,
            discussions: discussionsWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalDiscussions: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching discussions:', error);
        res.status(500).json({ error: 'Failed to fetch discussions' });
    }
};

// Get single discussion by ID
export const getDiscussionById = async (req, res) => {
    try {
        const { discussionId } = req.params;
        
        const discussion = await Discussion.findById(discussionId)
            .populate('userId', 'username profilePicture email createdAt isActive')
            .populate('problemId', 'title difficulty companies tags isActive isPremium')
            .populate('replies.userId', 'username profilePicture email');
            
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        // Add stats for admin view
        const discussionObj = discussion.toObject();
        
        // Ensure arrays exist
        if (!Array.isArray(discussionObj.upvotes)) discussionObj.upvotes = [];
        if (!Array.isArray(discussionObj.downvotes)) discussionObj.downvotes = [];
        
        discussionObj.upvoteCount = discussionObj.upvotes.length;
        discussionObj.downvoteCount = discussionObj.downvotes.length;
        discussionObj.score = discussionObj.upvotes.length - discussionObj.downvotes.length;
        
        // Add reply stats
        discussionObj.replies = discussionObj.replies.map(reply => {
            if (!Array.isArray(reply.upvotes)) reply.upvotes = [];
            if (!Array.isArray(reply.downvotes)) reply.downvotes = [];
            
            return {
                ...reply,
                upvoteCount: reply.upvotes.length,
                downvoteCount: reply.downvotes.length,
                score: reply.upvotes.length - reply.downvotes.length
            };
        });
        
        res.json({ 
            success: true,
            discussion: discussionObj 
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid discussion ID format' });
        }
        console.error('Error fetching discussion:', error);
        res.status(500).json({ error: 'Failed to fetch discussion' });
    }
};

// Create discussion (admin can create on behalf)
export const createDiscussion = async (req, res) => {
    try {
        const {
            problemId,
            title,
            content,
            type,
            tags,
            onBehalfOfUserId, // Optional: admin creating for specific user
            isPinned,
            isSolution,
            isAccepted
        } = req.body;
        
        // Validate problem exists
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        // If creating on behalf of user, validate user exists
        let targetUserId = req.user._id;
        if (onBehalfOfUserId) {
            const targetUser = await User.findById(onBehalfOfUserId);
            if (!targetUser) {
                return res.status(404).json({ error: 'Target user not found' });
            }
            targetUserId = onBehalfOfUserId;
        }
        
        const discussionData = {
            problemId,
            userId: targetUserId,
            title,
            content,
            type,
            tags: tags || [],
            upvotes: [],
            downvotes: [],
            isPinned: isPinned || false,
            isSolution: isSolution || false,
            isAccepted: isAccepted || false
        };
        
        // If marking as accepted, unmark other accepted solutions for same problem
        if (isAccepted) {
            await Discussion.updateMany(
                { problemId, isAccepted: true },
                { isAccepted: false }
            );
        }
        
        const discussion = await Discussion.create(discussionData);
        
        // Populate for response
        await discussion.populate('userId', 'username profilePicture');
        await discussion.populate('problemId', 'title difficulty');
        
        res.status(201).json({
            success: true,
            message: `Discussion created successfully${onBehalfOfUserId ? ' on behalf of user' : ''}`,
            discussion
        });
        
    } catch (error) {
        console.error('Error creating discussion:', error);
        res.status(500).json({ error: 'Failed to create discussion' });
    }
};

// Update discussion
export const updateDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const {
            title,
            content,
            type,
            tags,
            isSolution,
            isAccepted,
            isPinned
        } = req.body;
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (type !== undefined) updateData.type = type;
        if (tags !== undefined) updateData.tags = tags;
        if (isSolution !== undefined) updateData.isSolution = isSolution;
        if (isPinned !== undefined) {
            updateData.isPinned = isPinned;
            updateData.pinnedBy = isPinned ? req.user._id : null;
            updateData.pinnedAt = isPinned ? new Date() : null;
        }
        
        // Handle accepted solution
        if (isAccepted !== undefined) {
            updateData.isAccepted = isAccepted;
            updateData.acceptedBy = isAccepted ? req.user._id : null;
            updateData.acceptedAt = isAccepted ? new Date() : null;
            
            // If marking as accepted, unmark other accepted solutions for same problem
            if (isAccepted) {
                await Discussion.updateMany(
                    { problemId: discussion.problemId, _id: { $ne: discussionId } },
                    { isAccepted: false, acceptedBy: null, acceptedAt: null }
                );
            }
        }
        
        // Add edit tracking
        updateData.editedBy = req.user._id;
        updateData.editedAt = new Date();
        
        const updatedDiscussion = await Discussion.findByIdAndUpdate(
            discussionId,
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', 'username profilePicture')
         .populate('problemId', 'title difficulty');
        
        res.json({
            success: true,
            message: 'Discussion updated successfully',
            discussion: updatedDiscussion
        });
        
    } catch (error) {
        console.error('Error updating discussion:', error);
        res.status(500).json({ error: 'Failed to update discussion' });
    }
};

// Delete discussion
export const deleteDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        
        const discussion = await Discussion.findById(discussionId)
            .populate('userId', 'username')
            .populate('problemId', 'title');
            
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        // Store info for response
        const discussionInfo = {
            id: discussion._id,
            title: discussion.title,
            type: discussion.type,
            author: discussion.userId.username,
            problem: discussion.problemId.title,
            repliesCount: discussion.replies.length,
            upvotes: Array.isArray(discussion.upvotes) ? discussion.upvotes.length : 0,
            downvotes: Array.isArray(discussion.downvotes) ? discussion.downvotes.length : 0
        };
        
        await Discussion.findByIdAndDelete(discussionId);
        
        res.json({
            success: true,
            message: 'Discussion deleted successfully',
            deletedDiscussion: discussionInfo
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid discussion ID format' });
        }
        console.error('Error deleting discussion:', error);
        res.status(500).json({ error: 'Failed to delete discussion' });
    }
};

// Pin/Unpin discussion
export const toggleDiscussionPin = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { isPinned } = req.body;
        
        const updateData = {
            isPinned,
            pinnedBy: isPinned ? req.user._id : null,
            pinnedAt: isPinned ? new Date() : null
        };
        
        const discussion = await Discussion.findByIdAndUpdate(
            discussionId,
            updateData,
            { new: true }
        ).populate('userId', 'username')
         .populate('problemId', 'title');
        
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        res.json({
            success: true,
            message: `Discussion ${isPinned ? 'pinned' : 'unpinned'} successfully`,
            discussion
        });
        
    } catch (error) {
        console.error('Error toggling pin status:', error);
        res.status(500).json({ error: 'Failed to update pin status' });
    }
};

// Mark as solution/Accept solution
export const markAsSolution = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { isSolution, isAccepted } = req.body;
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const updateData = {};
        if (isSolution !== undefined) updateData.isSolution = isSolution;
        if (isAccepted !== undefined) {
            updateData.isAccepted = isAccepted;
            updateData.acceptedBy = isAccepted ? req.user._id : null;
            updateData.acceptedAt = isAccepted ? new Date() : null;
            
            // If marking as accepted, unmark other accepted solutions for same problem
            if (isAccepted) {
                await Discussion.updateMany(
                    { problemId: discussion.problemId, _id: { $ne: discussionId } },
                    { isAccepted: false, acceptedBy: null, acceptedAt: null }
                );
            }
        }
        
        const updatedDiscussion = await Discussion.findByIdAndUpdate(
            discussionId,
            updateData,
            { new: true }
        ).populate('userId', 'username')
         .populate('problemId', 'title');
        
        const message = isAccepted ? 'accepted as solution' : 
                        isSolution ? 'marked as solution' : 'solution status updated';
        
        res.json({
            success: true,
            message: `Discussion ${message} successfully`,
            discussion: updatedDiscussion
        });
        
    } catch (error) {
        console.error('Error marking as solution:', error);
        res.status(500).json({ error: 'Failed to mark as solution' });
    }
};

// Bulk actions on discussions
export const bulkDiscussionActions = async (req, res) => {
    try {
        const { discussionIds, action, data } = req.body;
        
        if (!Array.isArray(discussionIds) || discussionIds.length === 0) {
            return res.status(400).json({ error: 'Discussion IDs array is required' });
        }
        
        let result;
        let message;
        
        switch (action) {
            case 'delete':
                result = await Discussion.deleteMany({ _id: { $in: discussionIds } });
                message = `${result.deletedCount} discussions deleted successfully`;
                break;
                
            case 'pin':
                const pinUpdateData = { 
                    isPinned: data.isPinned,
                    ...(data.isPinned && { pinnedBy: req.user._id, pinnedAt: new Date() })
                };
                result = await Discussion.updateMany(
                    { _id: { $in: discussionIds } },
                    pinUpdateData
                );
                message = `${result.modifiedCount} discussions ${data.isPinned ? 'pinned' : 'unpinned'} successfully`;
                break;
                
            case 'updateType':
                result = await Discussion.updateMany(
                    { _id: { $in: discussionIds } },
                    { type: data.type }
                );
                message = `${result.modifiedCount} discussions updated to type '${data.type}' successfully`;
                break;
                
            case 'markSolution':
                result = await Discussion.updateMany(
                    { _id: { $in: discussionIds } },
                    { isSolution: data.isSolution }
                );
                message = `${result.modifiedCount} discussions ${data.isSolution ? 'marked' : 'unmarked'} as solutions`;
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
        res.json({ 
            success: true,
            message, 
            result: {
                requested: discussionIds.length,
                processed: result.modifiedCount || result.deletedCount
            }
        });
        
    } catch (error) {
        console.error('Error performing bulk action:', error);
        res.status(500).json({ error: 'Failed to perform bulk action' });
    }
};

// Get discussion statistics
export const getDiscussionStats = async (req, res) => {
    try {
        const { timeframe = '30d', problemId } = req.query;
        
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const matchFilter = { createdAt: { $gte: startDate } };
        if (problemId) matchFilter.problemId = new mongoose.Types.ObjectId(problemId);
        
        const stats = await Discussion.aggregate([
            { $match: matchFilter },
            {
                $facet: {
                    totalByType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    dailyCount: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    topProblems: [
                        { $group: { _id: '$problemId', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                        {
                            $lookup: {
                                from: 'problems',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'problem'
                            }
                        },
                        { $unwind: '$problem' },
                        {
                            $project: {
                                _id: 1,
                                count: 1,
                                title: '$problem.title',
                                difficulty: '$problem.difficulty'
                            }
                        }
                    ],
                    topUsers: [
                        { $group: { _id: '$userId', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                        {
                            $lookup: {
                                from: 'users',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        { $unwind: '$user' },
                        {
                            $project: {
                                _id: 1,
                                count: 1,
                                username: '$user.username'
                            }
                        }
                    ],
                    overview: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                solutions: { $sum: { $cond: ['$isSolution', 1, 0] } },
                                accepted: { $sum: { $cond: ['$isAccepted', 1, 0] } },
                                pinned: { $sum: { $cond: ['$isPinned', 1, 0] } },
                                questions: { $sum: { $cond: [{ $eq: ['$type', 'question'] }, 1, 0] } },
                                avgReplies: { $avg: { $size: '$replies' } }
                            }
                        }
                    ]
                }
            }
        ]);
        
        res.json({ 
            success: true,
            timeframe,
            stats: stats[0] 
        });
        
    } catch (error) {
        console.error('Error fetching discussion stats:', error);
        res.status(500).json({ error: 'Failed to fetch discussion statistics' });
    }
};

// Delete reply (admin only)
export const deleteReply = async (req, res) => {
    try {
        const { discussionId, replyId } = req.params;
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const reply = discussion.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }
        
        // Store reply info for response
        const replyInfo = {
            id: reply._id,
            content: reply.content.substring(0, 50) + '...',
            author: reply.userId
        };
        
        discussion.replies.pull(replyId);
        await discussion.save();
        
        res.json({
            success: true,
            message: 'Reply deleted successfully',
            deletedReply: replyInfo
        });
        
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Failed to delete reply' });
    }
};
