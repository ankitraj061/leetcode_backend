import mongoose from "mongoose";
const { Schema } = mongoose;

const discussionSchema = new Schema({
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['question', 'solution', 'hint', 'general'], required: true },
    tags: [{ type: String }],
    
    // Store user IDs instead of counts
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    
    replies: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        content: { type: String },
        // Store user IDs for reply votes too
        upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        createdAt: { type: Date, default: Date.now }
    }],
    
    // Solution status
    isSolution: { type: Boolean, default: false },
    isAccepted: { type: Boolean, default: false },
    
    // NEW: Pinning functionality
    isPinned: { type: Boolean, default: false },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pinnedAt: { type: Date },
    
    // NEW: Admin tracking fields
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date }
    
}, { timestamps: true });

// Add indexes for better performance
discussionSchema.index({ problemId: 1, isPinned: -1, createdAt: -1 }); // Sort pinned first
discussionSchema.index({ upvotes: 1 });
discussionSchema.index({ downvotes: 1 });
discussionSchema.index({ 'replies.upvotes': 1 });
discussionSchema.index({ 'replies.downvotes': 1 });
discussionSchema.index({ isPinned: 1 });
discussionSchema.index({ isAccepted: 1 });

const Discussion = mongoose.model('Discussion', discussionSchema);
export default Discussion;
