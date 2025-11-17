import User from '../models/user.js';
import Problem from '../models/problem.js';
import Submission from '../models/submission.js';
import mongoose from 'mongoose';

// 1. GET Profile Data by Username
export const getProfile = async (req, res) => {
    try {
        const { username } = req.params;

        // ✅ FIX: Use findOne with username, not findById
        const user = await User.findOne({ username })
            .select('firstName lastName username emailId bio location gender age streak following followers badges')
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const profileData = {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            emailId: user.emailId,
            bio: user.bio || '',
            location: user.location || '',
            gender: user.gender || '',
            age: user.age || null,
            currentStreak: user.streak?.current || 0,
            longestStreak: user.streak?.longest || 0,
            followingCount: user.following?.length || 0,
            followersCount: user.followers?.length || 0,
            badges: user.badges || []
        };

        res.status(200).json({ success: true, data: profileData });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 2. UPDATE Profile (requires authentication - edits own profile)
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const { firstName, lastName, username, bio, location, age, gender } = req.body;

        // Validate age if provided
        if (age && (age < 6 || age > 80)) {
            return res.status(400).json({ success: false, message: 'Age must be between 6 and 80' });
        }

        // Validate username format if provided
        if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username can only contain letters, numbers, and underscores' 
            });
        }

        // Check username uniqueness if changed
        if (username) {
            const existingUser = await User.findOne({ 
                username, 
                _id: { $ne: userId } 
            }).lean();
            
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Username already taken' });
            }
        }

        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (username !== undefined) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (location !== undefined) updateData.location = location;
        if (age !== undefined) updateData.age = age;
        if (gender !== undefined) updateData.gender = gender;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('firstName lastName username bio location age gender');

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 3. CHECK Username Availability (public - no auth needed)
export const checkUsernameAvailability = async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ success: false, message: 'Username is required' });
        }

        // Validate format
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ 
                success: false, 
                available: false,
                message: 'Username can only contain letters, numbers, and underscores' 
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ 
                success: false, 
                available: false,
                message: 'Username must be between 3 and 20 characters' 
            });
        }

        const existingUser = await User.findOne({ username }).lean();

        res.status(200).json({ 
            success: true, 
            available: !existingUser,
            message: existingUser ? 'Username is already taken' : 'Username is available'
        });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 4. GET Problems Solved Statistics by Username
export const getProblemsStats = async (req, res) => {
    try {
        const { username } = req.params;

        // ✅ Find user by username
        const user = await User.findOne({ username })
            .select('problemsSolved')
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const solvedProblemIds = user.problemsSolved?.map(p => p.problemId) || [];

        // Count solved problems by difficulty using aggregation
        const solvedStats = await Problem.aggregate([
            {
                $match: {
                    _id: { $in: solvedProblemIds },
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$difficulty',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Count total problems by difficulty
        const totalStats = await Problem.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$difficulty',
                    count: { $sum: 1 }
                }
            }
        ]);

        // ✅ NEW: Get total submissions count and accepted submissions count
        const userObjectId = new mongoose.Types.ObjectId(user._id);
        
        const submissionStats = await Submission.aggregate([
            {
                $match: {
                    userId: userObjectId
                }
            },
            {
                $group: {
                    _id: null,
                    totalSubmissions: { $sum: 1 },
                    acceptedSubmissions: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'accepted'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // Calculate acceptance rate
        const totalSubmissions = submissionStats[0]?.totalSubmissions || 0;
        const acceptedSubmissions = submissionStats[0]?.acceptedSubmissions || 0;
        const acceptanceRate = totalSubmissions > 0 
            ? Math.round((acceptedSubmissions / totalSubmissions) * 100) 
            : 0;

        // Format results
        const solvedMap = {};
        solvedStats.forEach(stat => {
            solvedMap[stat._id] = stat.count;
        });

        const totalMap = {};
        totalStats.forEach(stat => {
            totalMap[stat._id] = stat.count;
        });

        const stats = {
            easy: {
                solved: solvedMap['easy'] || 0,
                total: totalMap['easy'] || 0
            },
            medium: {
                solved: solvedMap['medium'] || 0,
                total: totalMap['medium'] || 0
            },
            hard: {
                solved: solvedMap['hard'] || 0,
                total: totalMap['hard'] || 0
            },
            // ✅ NEW: Add overall submission statistics
            overall: {
                totalSubmissions: totalSubmissions,
                acceptedSubmissions: acceptedSubmissions,
                acceptanceRate: acceptanceRate
            }
        };

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error('Get problems stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 5. GET Heatmap Data by Username
export const getHeatmapData = async (req, res) => {
    try {
        const { username } = req.params; // ✅ FIX: Get username from params
        const { year } = req.query;

        // ✅ FIX: Find user by username first
        const user = await User.findOne({ username }).select('_id').lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let startDate, endDate;

        if (year) {
            startDate = new Date(`${year}-01-01T00:00:00.000Z`);
            endDate = new Date(`${year}-12-31T23:59:59.999Z`);
        } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 365);
        }

        // ✅ Convert user._id to ObjectId for aggregation
        const userObjectId = new mongoose.Types.ObjectId(user._id);

        const submissions = await Submission.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    status: 'accepted',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    date: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    }
                }
            },
            {
                $group: {
                    _id: '$date',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        const heatmapData = submissions.map(item => ({
            date: item._id,
            count: item.count
        }));

        res.status(200).json({ 
            success: true, 
            data: heatmapData,
            period: year ? `Year ${year}` : 'Last 365 days'
        });
    } catch (error) {
        console.error('Get heatmap data error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 6. GET Recent Submissions by Username
export const getRecentSubmissions = async (req, res) => {
    try {
        const { username } = req.params; // ✅ FIX: Get username from params

        // ✅ FIX: Find user by username first
        const user = await User.findOne({ username }).select('_id').lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const submissions = await Submission.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('problemId', 'title slug difficulty')
            .select('problemId language status runtime memory createdAt')
            .lean();

        res.status(200).json({ success: true, data: submissions });
    } catch (error) {
        console.error('Get recent submissions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



// controllers/profile.controller.js

// 7. FOLLOW a User (requires authentication)
export const followUser = async (req, res) => {
    try {
        const currentUserId = req.user.id; // From auth middleware
        const { username } = req.params; // Username of user to follow

        // Find the user to follow
        const userToFollow = await User.findOne({ username }).select('_id username followers');

        if (!userToFollow) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const targetUserId = userToFollow._id;

        // Prevent following yourself
        if (currentUserId === targetUserId.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        }

        // Check if already following
        const currentUser = await User.findById(currentUserId).select('following');
        const isAlreadyFollowing = currentUser.following.some(
            id => id.toString() === targetUserId.toString()
        );

        if (isAlreadyFollowing) {
            return res.status(400).json({ success: false, message: 'Already following this user' });
        }

        // Add to following array of current user
        await User.findByIdAndUpdate(
            currentUserId,
            { $push: { following: targetUserId } }
        );

        // Add to followers array of target user
        await User.findByIdAndUpdate(
            targetUserId,
            { $push: { followers: currentUserId } }
        );

        res.status(200).json({ 
            success: true, 
            message: `You are now following ${userToFollow.username}`,
            data: {
                followingUsername: userToFollow.username,
                followingId: targetUserId
            }
        });
    } catch (error) {
        console.error('Follow user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 8. UNFOLLOW a User (requires authentication)
export const unfollowUser = async (req, res) => {
    try {
        const currentUserId = req.user.id; // From auth middleware
        const { username } = req.params; // Username of user to unfollow

        // Find the user to unfollow
        const userToUnfollow = await User.findOne({ username }).select('_id username');

        if (!userToUnfollow) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const targetUserId = userToUnfollow._id;

        // Prevent unfollowing yourself
        if (currentUserId === targetUserId.toString()) {
            return res.status(400).json({ success: false, message: 'Invalid operation' });
        }

        // Check if currently following
        const currentUser = await User.findById(currentUserId).select('following');
        const isFollowing = currentUser.following.some(
            id => id.toString() === targetUserId.toString()
        );

        if (!isFollowing) {
            return res.status(400).json({ success: false, message: 'You are not following this user' });
        }

        // Remove from following array of current user
        await User.findByIdAndUpdate(
            currentUserId,
            { $pull: { following: targetUserId } }
        );

        // Remove from followers array of target user
        await User.findByIdAndUpdate(
            targetUserId,
            { $pull: { followers: currentUserId } }
        );

        res.status(200).json({ 
            success: true, 
            message: `You have unfollowed ${userToUnfollow.username}`,
            data: {
                unfollowedUsername: userToUnfollow.username,
                unfollowedId: targetUserId
            }
        });
    } catch (error) {
        console.error('Unfollow user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 9. GET Follow Status (check if current user follows a specific user)
export const getFollowStatus = async (req, res) => {
    try {
        const currentUserId = req.user.id; // From auth middleware
        const { username } = req.params;

        // Find target user
        const targetUser = await User.findOne({ username }).select('_id');

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if current user follows target user
        const currentUser = await User.findById(currentUserId).select('following');
        const isFollowing = currentUser.following.some(
            id => id.toString() === targetUser._id.toString()
        );

        res.status(200).json({ 
            success: true, 
            data: {
                isFollowing,
                username
            }
        });
    } catch (error) {
        console.error('Get follow status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

