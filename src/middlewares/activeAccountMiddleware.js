export const activeAccountMiddleware = async (req, res, next) => {
    try {
        // console.log("Inside activeAccountMiddleware");
        if (!req.user) {
            // console.log('User not authenticated');
            throw new Error('User not authenticated');
        }

        if (!req.user.isActive) {
            // console.log('User account is inactive');
            return res.status(403).json({ 
                error: 'Your account has been suspended. Please contact support.',
                action: 'account_suspended'
            });
        }
        // console.log('User account is active');

        next();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
