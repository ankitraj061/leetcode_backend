import { redisClient } from "../config/redis.js";

export const ipRateLimitMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const redisKey = `ip_limit:${clientIP}`;
        
        const currentCount = await redisClient.get(redisKey) || 0;
        const maxRequests = 1000;
        
        if (parseInt(currentCount) >= maxRequests) {
            return res.status(429).json({ 
                error: 'Too many requests from this IP. Please try again later.',
                action: 'ip_rate_limit_exceeded'
            });
        }
        
        // FIX: Convert to string before passing to Redis
        const newCount = String(parseInt(currentCount) + 1);
        await redisClient.setEx(redisKey, 3600, newCount);
        console.log(`IP ${clientIP} has made ${newCount} requests in the last hour.`);
        
        
        next();
    } catch (error) {
        console.error('IP Rate Limiting Error:', error);
        res.status(400).json({ error: error.message });
    }
};




// Protection Against
// DDoS attacks - Prevents server overload from flood requests

// Brute force attacks - Stops password cracking attempts

// API abuse - Prevents scraping and excessive usage

// Resource exhaustion - Protects database and server resources

// Bot traffic - Blocks automated spam and scraping



// Without rate limiting
// Attacker sends 10,000 requests per second → Server crashes

// With rate limiting  
// Attacker sends 10,000 requests → Only first 1000 allowed per hour
// Server stays stable and legitimate users can still access
