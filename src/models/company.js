import mongoose from "mongoose";
const { Schema } = mongoose;
const companySchema = new Schema({
    name: { type: String, required: true, unique: true },
    logo: { type: String },
    description: { type: String },
    website: { type: String },
    problems: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
    interviewProcess: { type: String },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    industry: { type: String },
    size: { type: String, enum: ['Startup', 'Mid-size', 'Large', 'Enterprise'] }
}, { timestamps: true });

const Company = mongoose.model('Company', companySchema);
export default Company