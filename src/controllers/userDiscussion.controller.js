import Discussion from "../models/discussion.js";
import Problem from "../models/problem.js";

// Get discussions for a specific problem
export const getProblemDiscussions = async (req, res) => {
    try {
        const { problemId } = req.params;
        const { 
            type, 
            sortBy = 'upvotes',
            order = 'desc',
            page = 1,
            limit = 20 
        } = req.query;
        
        // Verify problem exists and user has access
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        if (!problem.isActive) {
            return res.status(403).json({ error: 'Problem is not available' });
        }
        
        // Check premium access
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ error: 'Premium subscription required' });
        }
        
        const filter = { problemId };
        if (type) filter.type = type;
        
        // Sort pinned discussions first, then by chosen criteria
        const sortOptions = { isPinned: -1 };
        sortOptions[sortBy] = order === 'desc' ? -1 : 1;
        
        const discussions = await Discussion.find(filter)
            .populate('userId', 'username profilePicture')
            .populate('replies.userId', 'username profilePicture')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Discussion.countDocuments(filter);
        
        res.json({
            success: true,
            discussions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalDiscussions: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching problem discussions:', error);
        res.status(500).json({ error: 'Failed to fetch discussions' });
    }
};

// Get single discussion
// Modified controller to show vote counts and user's vote status
export const getDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const userId = req.user._id;
        
        const discussion = await Discussion.findById(discussionId)
            .populate('userId', 'username profilePicture')
            .populate('problemId', 'title difficulty isActive isPremium')
            .populate('replies.userId', 'username profilePicture');
            
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        // Add vote counts and user vote status
        const discussionResponse = discussion.toObject();
        
        // Discussion vote info
        discussionResponse.upvoteCount = discussion.upvotes.length;
        discussionResponse.downvoteCount = discussion.downvotes.length;
        discussionResponse.userVote = discussion.upvotes.includes(userId) ? 'upvote' : 
                                     discussion.downvotes.includes(userId) ? 'downvote' : null;
        
        // Reply vote info
        discussionResponse.replies = discussionResponse.replies.map(reply => ({
            ...reply,
            upvoteCount: reply.upvotes.length,
            downvoteCount: reply.downvotes.length,
            userVote: reply.upvotes.includes(userId) ? 'upvote' : 
                     reply.downvotes.includes(userId) ? 'downvote' : null
        }));
        
        res.json({
            success: true,
            discussion: discussionResponse
        });
        
    } catch (error) {
        console.error('Error fetching discussion:', error);
        res.status(500).json({ error: 'Failed to fetch discussion' });
    }
};


// Create new discussion
export const createDiscussion = async (req, res) => {
    try {
        const { problemId, title, content, type, tags } = req.body;
        
        // Verify problem exists and user has access
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        if (!problem.isActive) {
            return res.status(403).json({ error: 'Cannot create discussion for inactive problem' });
        }
        
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ error: 'Premium subscription required' });
        }
        
        const discussion = await Discussion.create({
            problemId,
            userId: req.user._id,
            title,
            content,
            type,
            tags: tags || []
        });
        
        // Populate for response
        await discussion.populate('userId', 'username profilePicture');
        await discussion.populate('problemId', 'title difficulty');
        
        res.status(201).json({
            success: true,
            message: 'Discussion created successfully',
            discussion
        });
        
    } catch (error) {
        console.error('Error creating discussion:', error);
        res.status(500).json({ error: 'Failed to create discussion' });
    }
};

// Update own discussion
export const updateDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { title, content, type, tags } = req.body;
        
        // Find discussion and verify ownership
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        if (discussion.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only edit your own discussions' });
        }
        
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (type !== undefined) updateData.type = type;
        if (tags !== undefined) updateData.tags = tags;
        
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

// Delete own discussion
export const deleteDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        if (discussion.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete your own discussions' });
        }
        
        await Discussion.findByIdAndDelete(discussionId);
        
        res.json({
            success: true,
            message: 'Discussion deleted successfully'
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid discussion ID format' });
        }
        console.error('Error deleting discussion:', error);
        res.status(500).json({ error: 'Failed to delete discussion' });
    }
};

// Add reply to discussion
export const addReply = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { content } = req.body;
        
        const discussion = await Discussion.findById(discussionId)
            .populate('problemId', 'isActive isPremium');
            
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        // Check access to problem
        if (!discussion.problemId.isActive) {
            return res.status(403).json({ error: 'Cannot reply to discussion of inactive problem' });
        }
        
        if (discussion.problemId.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ error: 'Premium subscription required' });
        }
        
        const reply = {
            userId: req.user._id,
            content,
            createdAt: new Date()
        };
        
        const updatedDiscussion = await Discussion.findByIdAndUpdate(
            discussionId,
            { $push: { replies: reply } },
            { new: true }
        ).populate('userId', 'username profilePicture')
         .populate('replies.userId', 'username profilePicture');
        
        res.json({
            success: true,
            message: 'Reply added successfully',
            discussion: updatedDiscussion
        });
        
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: 'Failed to add reply' });
    }
};

// Vote on discussion
export const voteDiscussion = async (req, res) => {
    try {
        const { discussionId } = req.params;
        const { voteType } = req.body; // 'upvote' or 'downvote'
        const userId = req.user._id;
        
        if (!['upvote', 'downvote'].includes(voteType)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        // Initialize arrays if they don't exist or are numbers (from old schema)
        if (!Array.isArray(discussion.upvotes)) {
            discussion.upvotes = [];
        }
        if (!Array.isArray(discussion.downvotes)) {
            discussion.downvotes = [];
        }
        
        // Check if user is in upvotes array
        const isInUpvotes = discussion.upvotes.includes(userId);
        // Check if user is in downvotes array
        const isInDownvotes = discussion.downvotes.includes(userId);
        
        let message;
        let updateQuery = {};
        
        if (voteType === 'upvote') {
            if (isInUpvotes) {
                // User already upvoted - remove upvote (toggle off)
                updateQuery = { $pull: { upvotes: userId } };
                message = 'Upvote removed';
            } else {
                // User hasn't upvoted
                if (isInDownvotes) {
                    // User has downvoted - remove from downvotes and add to upvotes
                    updateQuery = { 
                        $pull: { downvotes: userId },
                        $addToSet: { upvotes: userId }
                    };
                    message = 'Changed to upvote';
                } else {
                    // User hasn't voted - add to upvotes
                    updateQuery = { $addToSet: { upvotes: userId } };
                    message = 'Upvoted successfully';
                }
            }
        } else { // downvote
            if (isInDownvotes) {
                // User already downvoted - remove downvote (toggle off)
                updateQuery = { $pull: { downvotes: userId } };
                message = 'Downvote removed';
            } else {
                // User hasn't downvoted
                if (isInUpvotes) {
                    // User has upvoted - remove from upvotes and add to downvotes
                    updateQuery = { 
                        $pull: { upvotes: userId },
                        $addToSet: { downvotes: userId }
                    };
                    message = 'Changed to downvote';
                } else {
                    // User hasn't voted - add to downvotes
                    updateQuery = { $addToSet: { downvotes: userId } };
                    message = 'Downvoted successfully';
                }
            }
        }
        
        const updatedDiscussion = await Discussion.findByIdAndUpdate(
            discussionId,
            updateQuery,
            { new: true }
        );
        
        // Ensure arrays exist in updated discussion too
        if (!Array.isArray(updatedDiscussion.upvotes)) {
            updatedDiscussion.upvotes = [];
        }
        if (!Array.isArray(updatedDiscussion.downvotes)) {
            updatedDiscussion.downvotes = [];
        }
        
        // Determine user's current vote status
        const userHasUpvoted = updatedDiscussion.upvotes.includes(userId);
        const userHasDownvoted = updatedDiscussion.downvotes.includes(userId);
        
        let userVote = null;
        if (userHasUpvoted) userVote = 'upvote';
        else if (userHasDownvoted) userVote = 'downvote';
        
        res.json({
            success: true,
            message,
            upvotes: updatedDiscussion.upvotes.length,
            downvotes: updatedDiscussion.downvotes.length,
            userVote
        });
        
    } catch (error) {
        console.error('Error voting on discussion:', error);
        res.status(500).json({ error: 'Failed to vote on discussion' });
    }
};



// Vote on reply
export const voteReply = async (req, res) => {
    try {
        const { discussionId, replyId } = req.params;
        const { voteType } = req.body;
        const userId = req.user._id;
        
        if (!['upvote', 'downvote'].includes(voteType)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const reply = discussion.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }
        
        // Initialize arrays if they don't exist or are numbers (from old schema)
        if (!Array.isArray(reply.upvotes)) {
            reply.upvotes = [];
        }
        if (!Array.isArray(reply.downvotes)) {
            reply.downvotes = [];
        }
        
        // Check if user is in upvotes/downvotes arrays
        const isInUpvotes = reply.upvotes.includes(userId);
        const isInDownvotes = reply.downvotes.includes(userId);
        
        let message;
        
        if (voteType === 'upvote') {
            if (isInUpvotes) {
                // User already upvoted - remove upvote (toggle off)
                reply.upvotes.pull(userId);
                message = 'Reply upvote removed';
            } else {
                // User hasn't upvoted
                if (isInDownvotes) {
                    // User has downvoted - remove from downvotes and add to upvotes
                    reply.downvotes.pull(userId);
                    reply.upvotes.addToSet(userId);
                    message = 'Reply vote changed to upvote';
                } else {
                    // User hasn't voted - add to upvotes
                    reply.upvotes.addToSet(userId);
                    message = 'Reply upvoted successfully';
                }
            }
        } else { // downvote
            if (isInDownvotes) {
                // User already downvoted - remove downvote (toggle off)
                reply.downvotes.pull(userId);
                message = 'Reply downvote removed';
            } else {
                // User hasn't downvoted
                if (isInUpvotes) {
                    // User has upvoted - remove from upvotes and add to downvotes
                    reply.upvotes.pull(userId);
                    reply.downvotes.addToSet(userId);
                    message = 'Reply vote changed to downvote';
                } else {
                    // User hasn't voted - add to downvotes
                    reply.downvotes.addToSet(userId);
                    message = 'Reply downvoted successfully';
                }
            }
        }
        
        await discussion.save();
        
        // Determine user's current vote status for this reply
        const userHasUpvoted = reply.upvotes.includes(userId);
        const userHasDownvoted = reply.downvotes.includes(userId);
        
        let userVote = null;
        if (userHasUpvoted) userVote = 'upvote';
        else if (userHasDownvoted) userVote = 'downvote';
        
        res.json({
            success: true,
            message,
            upvotes: reply.upvotes.length,
            downvotes: reply.downvotes.length,
            userVote
        });
        
    } catch (error) {
        console.error('Error voting on reply:', error);
        res.status(500).json({ error: 'Failed to vote on reply' });
    }
};


// Get user's own discussions
export const getMyDiscussions = async (req, res) => {
    console.log('Getting user discussions');
    try {
        const { page = 1, limit = 20, type } = req.query;
        
        const filter = { userId: req.user._id };
        if (type) filter.type = type;
        
        const discussions = await Discussion.find(filter)
            .populate('problemId', 'title difficulty')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Discussion.countDocuments(filter);
        
        res.json({
            success: true,
            discussions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalDiscussions: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching user discussions:', error);
        res.status(500).json({ error: 'Failed to fetch your discussions' });
    }
};


// Delete own reply - ADD THIS FUNCTION
export const deleteOwnReply = async (req, res) => {
    try {
        const { discussionId, replyId } = req.params;
        const userId = req.user._id;
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const reply = discussion.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }
        
        // Check ownership - user can only delete their own replies
        if (reply.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'You can only delete your own replies' });
        }
        
        // Remove the reply from the discussion
        discussion.replies.pull(replyId);
        await discussion.save();
        
        res.json({
            success: true,
            message: 'Reply deleted successfully',
            totalReplies: discussion.replies.length
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid discussion or reply ID format' });
        }
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Failed to delete reply' });
    }
};



// Edit own reply - ADD THIS FUNCTION
export const editOwnReply = async (req, res) => {
    try {
        const { discussionId, replyId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Reply content is required' });
        }
        
        const discussion = await Discussion.findById(discussionId);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        
        const reply = discussion.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }
        
        // Check ownership - user can only edit their own replies
        if (reply.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'You can only edit your own replies' });
        }
        
        // Update the reply content
        reply.content = content.trim();
        reply.editedAt = new Date(); // Optional: track when reply was edited
        
        // Save the discussion with updated reply
        await discussion.save();
        
        // Populate the reply user data for response
        await discussion.populate('replies.userId', 'username profilePicture');
        
        // Get the updated reply
        const updatedReply = discussion.replies.id(replyId);
        
        // Ensure arrays exist for vote counts
        if (!Array.isArray(updatedReply.upvotes)) updatedReply.upvotes = [];
        if (!Array.isArray(updatedReply.downvotes)) updatedReply.downvotes = [];
        
        // Determine user's vote status for this reply
        const userVote = updatedReply.upvotes.includes(userId) ? 'upvote' : 
                         updatedReply.downvotes.includes(userId) ? 'downvote' : null;
        
        res.json({
            success: true,
            message: 'Reply updated successfully',
            reply: {
                ...updatedReply.toObject(),
                upvoteCount: updatedReply.upvotes.length,
                downvoteCount: updatedReply.downvotes.length,
                userVote,
                isOwner: true
            }
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid discussion or reply ID format' });
        }
        console.error('Error editing reply:', error);
        res.status(500).json({ error: 'Failed to edit reply' });
    }
};

