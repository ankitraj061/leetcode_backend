import Feedback from '../models/feedback.js';


// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Private
const submitFeedback = async (req, res) => {
  try {
    const { type, message, problemSlug } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type and message are required'
      });
    }

    // Validate feedback type
    const validTypes = ['bug', 'suggestion', 'question', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback type'
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      userId,
      type,
      message,
      problemSlug: problemSlug || undefined
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
};

// @desc    Get user's feedback history
// @route   GET /api/feedback
// @access  Private
const getUserFeedback = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const feedback = await Feedback.find({ userId })
      .sort({ createdAt: -1 })
      .select('type message problemSlug createdAt');

    res.json({
      success: true,
      data: feedback
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

export { submitFeedback, getUserFeedback };