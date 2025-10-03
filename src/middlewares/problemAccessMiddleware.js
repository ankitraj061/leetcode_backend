import Problem from "../models/problem.js";

export const problemAccessMiddleware = async (req, res, next) => {
    try {
        const problemId = req.params.problemId || req.body.problemId;
        
        if (!problemId) {
            throw new Error('Problem ID required');
        }
        
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        // Check if problem is active
        if (!problem.isActive) {
            return res.status(403).json({ 
                error: 'This problem is currently unavailable.',
                action: 'problem_inactive'
            });
        }
        
        // Check premium access
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ 
                error: 'Premium subscription required to access this problem.',
                action: 'upgrade_to_premium'
            });
        }
        
        req.problem = problem;
        next();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
