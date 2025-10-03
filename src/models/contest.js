import mongoose from "mongoose";
const { Schema } = mongoose;
const contestSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes
    problems: [{ type: Schema.Types.ObjectId, ref: 'Problem', required: true }],
    participants: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        registeredAt: { type: Date, default: Date.now },
        rank: { type: Number },
        score: { type: Number, default: 0 },
        penalty: { type: Number, default: 0 }
    }],
    type: { type: String, enum: ['public', 'private', 'educational'], default: 'public' },
    maxParticipants: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['upcoming', 'running', 'ended'], default: 'upcoming' },
    prizes: [{ position: Number, reward: String }]
}, { timestamps: true });

const Contest = mongoose.model('Contest', contestSchema);
export default Contest