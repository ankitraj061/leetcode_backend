import mongoose from "mongoose";
const { Schema } = mongoose;

const solutionDraftSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    problemId: {
        type: Schema.Types.ObjectId,
        ref: "Problem",
        required: true
    },
    code: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure one draft per user per problem
solutionDraftSchema.index({ userId: 1, problemId: 1 }, { unique: true });

const SolutionDraft = mongoose.model("SolutionDraft", solutionDraftSchema);
export default SolutionDraft;
