import mongoose from 'mongoose';
import Submission from '../models/submission.js';
import Problem from '../models/problem.js';

// GET /api/problems/:problemId/submissions
export const getUserSubmissionsForProblem = async (req, res) => {
    try {
        const { problemId } = req.params;
        const userId = req.user._id;

        if (!problemId) {
            return res.status(400).json({ error: 'Problem ID is required' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'User not authenticated' });
        }

        // Validate problemId format
        if (!mongoose.Types.ObjectId.isValid(problemId)) {
            return res.status(400).json({ error: 'Invalid problem ID format' });
        }

        // Check if problem exists
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        // Get all submissions for this user and problem
        const submissions = await Submission.find({
            userId: userId,
            problemId: problemId
        })
        .select('_id status language runtime memory notes createdAt')
        .sort({ createdAt: -1 }) // Most recent first
        .lean();

        if (!submissions || submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No submissions found for this problem',
                submissions: [],
                totalSubmissions: 0
            });
        }

        // Format response
        const formattedSubmissions = submissions.map(submission => ({
            id: submission._id,
            status: submission.status,
            language: submission.language,
            runtime: submission.runtime || 0,
            memory: submission.memory || 0,
            notes: {
                timeTaken: submission.notes?.timeTaken || 0,
                text: submission.notes?.text || ''
            },
            submittedAt: submission.createdAt
        }));

        res.status(200).json({
            success: true,
            submissions: formattedSubmissions,
            totalSubmissions: submissions.length,
            problem: {
                id: problem._id,
                title: problem.title,
                difficulty: problem.difficulty
            }
        });

    } catch (error) {
        console.error('Error fetching user submissions for problem:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
};

// GET /api/submissions/:submissionId
// GET /api/submissions/:submissionId
export const getSubmissionDetails = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const userId = req.user._id;

        if (!submissionId) {
            return res.status(400).json({ error: 'Submission ID is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID format' });
        }

        // Get submission with problem details
        const submission = await Submission.findById(submissionId)
            .populate('problemId', 'title difficulty slug')
            .lean();

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Verify submission belongs to the user
        if (submission.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Access denied. This submission does not belong to you.' });
        }

        // ✅ NEW: Get performance statistics for this problem
        const performanceStats = await getPerformanceStatistics(submission.problemId._id, submission.language);
        
        // ✅ NEW: Get optimal solutions for this problem
        const optimalSolutions = await getOptimalSolutions(submission.problemId._id, submission.language);

        // Format detailed response
        const submissionDetails = {
            id: submission._id,
            code: submission.code,
            language: submission.language,
            status: submission.status,
            runtime: submission.runtime || 0,
            memory: submission.memory || 0,
            testCasesPassed: submission.testCasesPassed || 0,
            testCasesTotal: submission.testCasesTotal || 0,
            errorMessage: submission.errorMessage || '',
            notes: {
                timeTaken: submission.notes?.timeTaken || 0,
                text: submission.notes?.text || ''
            },
            submittedAt: submission.createdAt,
            updatedAt: submission.updatedAt,
            problem: {
                id: submission.problemId._id,
                title: submission.problemId.title,
                difficulty: submission.problemId.difficulty,
                slug: submission.problemId.slug
            }
        };

        res.status(200).json({
            success: true,
            submission: submissionDetails,
            // ✅ NEW: Performance comparison charts
            performanceChart: performanceStats,
            // ✅ NEW: Optimal solutions
            optimalSolutions: optimalSolutions
        });

    } catch (error) {
        console.error('Error fetching submission details:', error);
        res.status(500).json({ error: 'Failed to fetch submission details' });
    }
};

// ✅ NEW: Function to get performance statistics (LeetCode-style charts)
const getPerformanceStatistics = async (problemId, language) => {
    try {
        // Get all accepted submissions for this problem and language
        const acceptedSubmissions = await Submission.find({
            problemId: problemId,
            language: language,
            status: 'accepted',
            runtime: { $gt: 0 }, // Exclude 0 runtime submissions
            memory: { $gt: 0 }   // Exclude 0 memory submissions
        })
        .select('runtime memory')
        .lean();

        if (acceptedSubmissions.length < 10) {
            // Not enough data for meaningful statistics
            return {
                runtimeChart: { message: 'Not enough data for runtime analysis' },
                memoryChart: { message: 'Not enough data for memory analysis' },
                totalSubmissions: acceptedSubmissions.length
            };
        }

        // ✅ RUNTIME DISTRIBUTION
        const runtimes = acceptedSubmissions.map(s => s.runtime).sort((a, b) => a - b);
        const runtimeChart = generatePerformanceChart(runtimes, 'ms');

        // ✅ MEMORY DISTRIBUTION  
        const memories = acceptedSubmissions.map(s => s.memory).sort((a, b) => a - b);
        const memoryChart = generatePerformanceChart(memories, 'KB');

        return {
            runtimeChart,
            memoryChart,
            totalSubmissions: acceptedSubmissions.length,
            language: language
        };

    } catch (error) {
        console.error('Error calculating performance statistics:', error);
        return {
            runtimeChart: { error: 'Failed to calculate runtime statistics' },
            memoryChart: { error: 'Failed to calculate memory statistics' }
        };
    }
};

// ✅ NEW: Generate LeetCode-style performance chart data
const generatePerformanceChart = (values, unit) => {
    if (values.length === 0) return { message: 'No data available' };

    // Calculate percentiles
    const getPercentile = (arr, percentile) => {
        const index = Math.ceil((percentile / 100) * arr.length) - 1;
        return arr[Math.max(0, index)];
    };

    const p5 = getPercentile(values, 5);
    const p25 = getPercentile(values, 25);
    const p50 = getPercentile(values, 50);  // Median
    const p75 = getPercentile(values, 75);
    const p95 = getPercentile(values, 95);

    // Create distribution buckets (LeetCode-style)
    const buckets = createDistributionBuckets(values, unit);

    return {
        percentiles: {
            p5: { value: p5, label: `5th percentile: ${p5}${unit}` },
            p25: { value: p25, label: `25th percentile: ${p25}${unit}` },
            p50: { value: p50, label: `50th percentile (median): ${p50}${unit}` },
            p75: { value: p75, label: `75th percentile: ${p75}${unit}` },
            p95: { value: p95, label: `95th percentile: ${p95}${unit}` }
        },
        distribution: buckets,
        stats: {
            min: Math.min(...values),
            max: Math.max(...values),
            average: Math.round(values.reduce((sum, val) => sum + val, 0) / values.length),
            median: p50,
            totalSamples: values.length
        }
    };
};

// ✅ NEW: Create distribution buckets for chart visualization
const createDistributionBuckets = (values, unit) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketCount = Math.min(10, Math.max(5, Math.floor(values.length / 10)));
    const bucketSize = (max - min) / bucketCount;

    const buckets = [];
    
    for (let i = 0; i < bucketCount; i++) {
        const bucketMin = min + (i * bucketSize);
        const bucketMax = min + ((i + 1) * bucketSize);
        
        const count = values.filter(val => 
            val >= bucketMin && (i === bucketCount - 1 ? val <= bucketMax : val < bucketMax)
        ).length;
        
        const percentage = ((count / values.length) * 100).toFixed(1);
        
        buckets.push({
            range: `${Math.round(bucketMin)}-${Math.round(bucketMax)}${unit}`,
            count: count,
            percentage: parseFloat(percentage),
            label: `${percentage}% of users: ${Math.round(bucketMin)}-${Math.round(bucketMax)}${unit}`
        });
    }

    return buckets;
};

// ✅ NEW: Get optimal solutions (best runtime and memory)
const getOptimalSolutions = async (problemId, language) => {
    try {
        // Get best runtime solution
        const fastestSolution = await Submission.findOne({
            problemId: problemId,
            language: language,
            status: 'accepted',
            runtime: { $gt: 0 }
        })
        .sort({ runtime: 1 }) // Ascending order (fastest first)
        .select('code runtime memory userId createdAt')
        .populate('userId', 'username firstName lastName')
        .lean();

        // Get most memory-efficient solution
        const memoryEfficientSolution = await Submission.findOne({
            problemId: problemId,
            language: language,
            status: 'accepted',
            memory: { $gt: 0 }
        })
        .sort({ memory: 1 }) // Ascending order (least memory first)
        .select('code runtime memory userId createdAt')
        .populate('userId', 'username firstName lastName')
        .lean();

        const result = {};

        if (fastestSolution) {
            result.fastestSolution = {
                code: fastestSolution.code,
                runtime: fastestSolution.runtime,
                memory: fastestSolution.memory,
                author: {
                    username: fastestSolution.userId.username,
                    name: `${fastestSolution.userId.firstName} ${fastestSolution.userId.lastName || ''}`.trim()
                },
                submittedAt: fastestSolution.createdAt,
                type: 'runtime_optimal'
            };
        }

        if (memoryEfficientSolution) {
            result.memoryEfficientSolution = {
                code: memoryEfficientSolution.code,
                runtime: memoryEfficientSolution.runtime,
                memory: memoryEfficientSolution.memory,
                author: {
                    username: memoryEfficientSolution.userId.username,
                    name: `${memoryEfficientSolution.userId.firstName} ${memoryEfficientSolution.userId.lastName || ''}`.trim()
                },
                submittedAt: memoryEfficientSolution.createdAt,
                type: 'memory_optimal'
            };
        }

        // Check if both solutions are the same
        if (fastestSolution && memoryEfficientSolution && 
            fastestSolution._id.toString() === memoryEfficientSolution._id.toString()) {
            result.optimalSolution = result.fastestSolution;
            result.optimalSolution.type = 'both_optimal';
            delete result.fastestSolution;
            delete result.memoryEfficientSolution;
        }

        return result;

    } catch (error) {
        console.error('Error fetching optimal solutions:', error);
        return { error: 'Failed to fetch optimal solutions' };
    }
};


export const addOrUpdateNotes = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { text, timeTaken } = req.body; // timeTaken in minutes
        const userId = req.user._id;

        if (!submissionId) {
            return res.status(400).json({ error: 'Submission ID is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID format' });
        }

        // Validate timeTaken if provided
        if (timeTaken !== undefined && (typeof timeTaken !== 'number' || timeTaken < 0)) {
            return res.status(400).json({ error: 'timeTaken must be a non-negative number' });
        }

        // Find the submission
        const submission = await Submission.findById(submissionId);

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Verify submission belongs to the user
        if (submission.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Access denied. This submission does not belong to you.' });
        }

        // Update notes
        submission.notes = submission.notes || {};
        if (text !== undefined) submission.notes.text = text;
        if (timeTaken !== undefined) submission.notes.timeTaken = timeTaken;

        await submission.save();

        res.status(200).json({
            success: true,
            message: 'Notes updated successfully',
            notes: submission.notes
        });

    } catch (error) {
        console.error('Error updating notes:', error);
        res.status(500).json({ error: 'Failed to update notes' });
    }
}
