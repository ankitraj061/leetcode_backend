import User from '../models/user.js';
import Problem from '../models/problem.js';
import Submission from '../models/submission.js';
import mongoose from 'mongoose';
export const toggleSaveProblem = async (req, res) => {
    try {
        const { problemId } = req.params;
        const userId = req.user._id;
        
        // Validate problem exists and is active
        const problem = await Problem.findOne({ _id: problemId, isActive: true });
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found or inactive' });
        }
        
        // REMOVED: Premium access check - users can save any problem
        
        // Find user and check if problem is already saved
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isAlreadySaved = user.savedProblems.includes(problemId);
        let message;
        let isSaved;
        
        if (isAlreadySaved) {
            // Remove from saved problems (unsave)
            await User.findByIdAndUpdate(
                userId,
                { $pull: { savedProblems: problemId } }
            );
            message = 'Problem removed from saved list';
            isSaved = false;
        } else {
            // Add to saved problems (save) - $addToSet ensures uniqueness
            await User.findByIdAndUpdate(
                userId,
                { $addToSet: { savedProblems: problemId } }
            );
            message = 'Problem saved successfully';
            isSaved = true;
        }
        
        res.json({
            success: true,
            message,
            isSaved,
            problem: {
                id: problem._id,
                title: problem.title,
                difficulty: problem.difficulty,
                isPremium: problem.isPremium // Include premium status for UI
            }
        });
        
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid problem ID format' });
        }
        console.error('Error toggling saved problem:', error);
        res.status(500).json({ error: 'Failed to toggle saved problem' });
    }
};





export const getAllProblemsForUser = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            difficulty, 
            status, // 'solved', 'unsolved', 'attempted'
            type, // 'saved', 'premium', 'free'
            search,
            company,
            topic,
            sortBy = 'title', // 'title', 'difficulty', 'acceptance', 'created'
            order = 'asc'
        } = req.query;
        
        const userId = req.user._id;
        
        // Build match stage for initial filtering
        const matchStage = { 
            isActive: true,
            ...(difficulty && { difficulty }),
            ...(type === 'premium' && { isPremium: true }),
            ...(type === 'free' && { isPremium: false }),
             ...(company && { companies: { $in: [company] } }),
             ...(topic && { tags: { $in: [topic] } }) 
        };
        
        // Add text search if provided
        if (search) {
            matchStage.$text = { $search: search };
        }
        
        // Build aggregation pipeline
        const pipeline = [
            // Initial match for active problems and filters
            { $match: matchStage },
            
            // For saved problems filter
            ...(type === 'saved' ? [{
                $lookup: {
                    from: 'users',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { _id: userId } },
                        { $project: { hasSaved: { $in: ['$$problemId', '$savedProblems'] } } }
                    ],
                    as: 'savedCheck'
                }
            }, {
                $match: { 'savedCheck.hasSaved': true }
            }] : []),
            
            // Lookup user data for saved and solved status
            {
                $lookup: {
                    from: 'users',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { _id: userId } },
                        {
                            $project: {
                                isSaved: { $in: ['$$problemId', '$savedProblems'] },
                                isSolved: { $in: ['$$problemId', '$problemsSolved.problemId'] }
                            }
                        }
                    ],
                    as: 'userStatus'
                }
            },
            
            // Lookup acceptance rate from submissions
            {
                $lookup: {
                    from: 'submissions',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$problemId', '$$problemId'] } } },
                        {
                            $group: {
                                _id: null,
                                totalSubmissions: { $sum: 1 },
                                acceptedSubmissions: {
                                    $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                                }
                            }
                        },
                        {
                            $project: {
                                acceptanceRate: {
                                    $cond: [
                                        { $eq: ['$totalSubmissions', 0] },
                                        0,
                                        { 
                                            $round: [
                                                { $multiply: [{ $divide: ['$acceptedSubmissions', '$totalSubmissions'] }, 100] }, 
                                                2
                                            ] 
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'submissionStats'
                }
            },
            
            // Project only the required fields
            {
                $project: {
                    _id: 1,
                    title: 1,
                    difficulty: 1,
                    isPremiumProblem: '$isPremium',
                    isSavedProblem: { 
                        $ifNull: [{ $arrayElemAt: ['$userStatus.isSaved', 0] }, false] 
                    },
                    isSolvedByUser: { 
                        $ifNull: [{ $arrayElemAt: ['$userStatus.isSolved', 0] }, false] 
                    },
                    acceptanceRate: { 
                        $ifNull: [{ $arrayElemAt: ['$submissionStats.acceptanceRate', 0] }, 0] 
                    },
                    createdAt: 1,
                    // Add text search score if searching
                    ...(search && { score: { $meta: 'textScore' } })
                }
            },
            
            // Apply status filter after user data lookup
            ...(status === 'solved' ? [{ $match: { isSolvedByUser: true } }] : []),
            ...(status === 'unsolved' ? [{ $match: { isSolvedByUser: false } }] : []),
            
            // Sort stage
            {
                $sort: {
                    // If searching, sort by text score first
                    ...(search && { score: { $meta: 'textScore' } }),
                    // Custom sort for difficulty
                    ...(sortBy === 'difficulty' && {
                        difficulty: order === 'desc' ? -1 : 1
                    }),
                    // Sort by acceptance rate
                    ...(sortBy === 'acceptance' && {
                        acceptanceRate: order === 'desc' ? -1 : 1
                    }),
                    // Sort by creation date
                    ...(sortBy === 'created' && {
                        createdAt: order === 'desc' ? -1 : 1
                    }),
                    // Default sort by title
                    ...(sortBy === 'title' && {
                        title: order === 'desc' ? -1 : 1
                    }),
                    // Fallback sort
                    _id: 1
                }
            },
            
            // Add facet for pagination and count
            {
                $facet: {
                    problems: [
                        { $skip: (page - 1) * parseInt(limit) },
                        { $limit: parseInt(limit) }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];
        
        const [result] = await Problem.aggregate(pipeline);
        
        const problems = result.problems || [];
        const totalCount = result.totalCount[0]?.count || 0;
        
        res.json({
            success: true,
            problems,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalProblems: totalCount,
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching problems for user (optimized):', error);
        
        // Handle specific MongoDB errors
        if (error.name === 'MongoError') {
            if (error.code === 16389) { // Aggregation pipeline too large
                return res.status(400).json({ error: 'Query too complex, please refine your filters' });
            }
            if (error.code === 16552) { // Text search error
                return res.status(400).json({ error: 'Invalid search query' });
            }
        }
        
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
};




export const getProblemForUserbyProblemId = async (req, res) => {
    try {
        const { problemId } = req.params;
        const userId = req.user._id;
        
        // Validate problem ID format
        if (!mongoose.Types.ObjectId.isValid(problemId)) {
            return res.status(400).json({ error: 'Invalid problem ID format' });
        }
        
        // Get problem with user status in single aggregation
        const [problemData] = await Problem.aggregate([
            { 
                $match: { 
                    _id: new mongoose.Types.ObjectId(problemId), 
                    isActive: true 
                } 
            },
            {
                $lookup: {
                    from: 'users',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { _id: userId } },
                        {
                            $project: {
                                isSaved: { $in: ['$$problemId', '$savedProblems'] },
                                isSolved: { $in: ['$$problemId', '$problemsSolved.problemId'] },
                                subscriptionType: 1,
                                preferredLanguage: '$preferences.preferredLanguage'
                            }
                        }
                    ],
                    as: 'userStatus'
                }
            },
            {
                $project: {
                    title: 1,
                    description: 1,
                    difficulty: 1,
                    constraints: 1,
                    visibleTestCases: 1,
                    startCode: 1,
                    hints: 1,
                    isPremium: 1,
                    createdAt: 1,
                    userStatus: { $arrayElemAt: ['$userStatus', 0] }
                }
            }
        ]);
        
        if (!problemData) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        const userStatus = problemData.userStatus || {};
        
        // Check premium access
        if (problemData.isPremium && userStatus.subscriptionType !== 'premium') {
            return res.status(403).json({ 
                error: 'Please subscribe to unlock this problem',
                isPremium: true,
                requiresSubscription: true,
                problem: {
                    _id: problemData._id,
                    title: problemData.title,
                    difficulty: problemData.difficulty,
                    isPremium: true
                }
            });
        }
        
        // Get user's preferred language start code or default to first available
        const preferredLanguage = userStatus.preferredLanguage || 'javascript';
        const defaultStartCode = problemData.startCode.find(code => 
            code.language === preferredLanguage
        ) || problemData.startCode[0];
        
        // Prepare response
        const response = {
            _id: problemData._id,
            title: problemData.title,
            description: problemData.description,
            difficulty: problemData.difficulty,
            constraints: problemData.constraints,
            visibleTestCases: problemData.visibleTestCases,
            startCode: problemData.startCode,
            defaultStartCode: defaultStartCode,
            hints: problemData.hints,
            isPremium: problemData.isPremium,
            
            // User-specific data
            isSavedProblem: userStatus.isSaved || false,
            isSolvedByUser: userStatus.isSolved || false,
            
            // Metadata for frontend
            createdAt: problemData.createdAt
        };
        
        res.json({
            success: true,
            problem: response
        });
        
    } catch (error) {
        console.error('Error fetching problem for user:', error);
        res.status(500).json({ error: 'Failed to fetch problem details' });
    }
};

// Get problem statistics (separate lightweight endpoint)
export const getProblemStats = async (req, res) => {
    try {
        const { problemId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(problemId)) {
            return res.status(400).json({ error: 'Invalid problem ID format' });
        }
        
        const stats = await Problem.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(problemId), isActive: true } },
            {
                $lookup: {
                    from: 'submissions',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$problemId', '$$problemId'] } } },
                        {
                            $group: {
                                _id: null,
                                totalSubmissions: { $sum: 1 },
                                acceptedSubmissions: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                                uniqueUsers: { $addToSet: '$userId' }
                            }
                        }
                    ],
                    as: 'submissionStats'
                }
            },
            {
                $lookup: {
                    from: 'discussions',
                    let: { problemId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$problemId', '$$problemId'] } } },
                        { $count: 'totalDiscussions' }
                    ],
                    as: 'discussionStats'
                }
            },
            {
                $project: {
                    _id: 1,
                    submissionStats: { $arrayElemAt: ['$submissionStats', 0] },
                    totalDiscussions: { $ifNull: [{ $arrayElemAt: ['$discussionStats.totalDiscussions', 0] }, 0] }
                }
            }
        ]);
        
        const problemStats = stats[0];
        if (!problemStats) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        const submissionData = problemStats.submissionStats || {};
        
        res.json({
            success: true,
            stats: {
                totalSubmissions: submissionData.totalSubmissions || 0,
                acceptedSubmissions: submissionData.acceptedSubmissions || 0,
                acceptanceRate: submissionData.totalSubmissions ? 
                    Math.round((submissionData.acceptedSubmissions / submissionData.totalSubmissions) * 100 * 100) / 100 : 0,
                totalSolvers: submissionData.uniqueUsers ? submissionData.uniqueUsers.length : 0,
                totalDiscussions: problemStats.totalDiscussions
            }
        });
        
    } catch (error) {
        console.error('Error fetching problem stats:', error);
        res.status(500).json({ error: 'Failed to fetch problem statistics' });
    }
};



export const getAllCompaniesWithCount = async (req, res) => {
    console.log('Inside getAllCompaniesWithCount');
    
    try {
        const pipeline = [
            // Match only active problems
            { $match: { isActive: true } },
            
            // Unwind the companies array to create separate documents for each company
            { $unwind: '$companies' },
            
            // Group by company and count problems
            {
                $group: {
                    _id: '$companies',
                    count: { $sum: 1 },
                    difficulties: {
                        $push: '$difficulty'
                    }
                }
            },
            
            // Add difficulty breakdown counts
            {
                $addFields: {
                    difficultyBreakdown: {
                        easy: {
                            $size: {
                                $filter: {
                                    input: '$difficulties',
                                    cond: { $eq: ['$$this', 'easy'] }
                                }
                            }
                        },
                        medium: {
                            $size: {
                                $filter: {
                                    input: '$difficulties',
                                    cond: { $eq: ['$$this', 'medium'] }
                                }
                            }
                        },
                        hard: {
                            $size: {
                                $filter: {
                                    input: '$difficulties',
                                    cond: { $eq: ['$$this', 'hard'] }
                                }
                            }
                        }
                    }
                }
            },
            
            // Project final structure
            {
                $project: {
                    _id: 0,
                    company: '$_id',
                    count: 1,
                    difficultyBreakdown: 1
                }
            },
            
            // Sort by count (highest first) then by company name
            { $sort: { count: -1, company: 1 } }
        ];
        
        const companies = await Problem.aggregate(pipeline);
        
        res.json({
            success: true,
            companies,
            totalCompanies: companies.length
        });
        
    } catch (error) {
        console.error('Error fetching companies with count:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};




export const getAllTopicsWithCount = async (req, res) => {
    console.log('Inside getAllTopicsWithCount');
    try {
        const pipeline = [
            // Match only active problems
            { $match: { isActive: true } },
            
            // Unwind the tags array to create separate documents for each tag
            { $unwind: '$tags' },
            
            // Group by tag and count problems
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 }
                }
            },
            
            // Project final structure
            {
                $project: {
                    _id: 0,
                    topic: '$_id',
                    count: 1
                }
            },
            
            // Sort by count (highest first) then by topic name
            { $sort: { count: -1, topic: 1 } }
        ];
        
        const topics = await Problem.aggregate(pipeline);
        
        res.json({
            success: true,
            topics,
            totalTopics: topics.length
        });
        
    } catch (error) {
        console.error('Error fetching topics with count:', error);
        res.status(500).json({ error: 'Failed to fetch topics' });
    }
};



