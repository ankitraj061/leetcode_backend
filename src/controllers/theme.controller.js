// routes/user.js or similar
import User from '../models/user.js';
export const updateTheme = async (req, res) => {
    
    try {
        const { theme } = req.body;
        const userId = req.user._id;

        const user = await User.findByIdAndUpdate(
            userId,
            { 'preferences.theme': theme },
            { new: true }
        );

        res.status(200).json({
            message: 'Theme updated successfully',
            theme: user.preferences.theme
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
