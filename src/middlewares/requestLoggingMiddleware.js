export const requestLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user?.username || 'Anonymous'}`);
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};



// [2025-09-20T18:47:22.123Z] POST /problems/submit - User: ankit_dev
// [2025-09-20T18:47:22.867Z] POST /problems/submit - 200 - 744ms
// [2025-09-20T18:47:25.456Z] GET /leaderboard - User: Anonymous
// [2025-09-20T18:47:25.623Z] GET /leaderboard - 200 - 167ms



// Benefits
// Debug production issues by seeing exact request patterns

// Monitor performance - identify slow endpoints

// Track user behavior - see what features are used most

// Security monitoring - detect suspicious activity patterns

// Analytics data - understand platform usage

// Compliance logging - meet audit requirements