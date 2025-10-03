export const emailVerificationMiddleware = async (req, res, next) => {
    try {
        // if (!req.user) {
        //     throw new Error('User not authenticated');
        // }

        // if (!req.user.isEmailVerified) {
        //     return res.status(403).json({ 
        //         error: 'Email verification required. Please verify your email to access this feature.',
        //         action: 'email_verification_required'
        //     });
        // }

        next();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
