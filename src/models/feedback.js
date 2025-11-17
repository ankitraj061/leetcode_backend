import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['bug', 'suggestion', 'question', 'other'],
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  problemSlug: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Feedback', feedbackSchema);
