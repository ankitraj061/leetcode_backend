export const premiumMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new Error('User not authenticated');
        }

        const now = new Date();
        const isPremiumActive = req.user.subscriptionType === 'premium' && 
                               req.user.subscriptionExpiry && 
                               req.user.subscriptionExpiry > now;

        if (!isPremiumActive) {
            return res.status(403).json({ 
                error: 'Premium subscription required to access this feature.',
                action: 'upgrade_to_premium'
            });
        }

        next();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
