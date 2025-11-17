import mongoose from "mongoose";
const { Schema } = mongoose;

const submissionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    problemId: {
        type: Schema.Types.ObjectId,
        ref: 'Problem',
        required: true
    },
    code: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true,
        enum: ['cpp', 'python', 'java', 'javascript', 'c']
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending',
            'accepted',
            'wrong answer',
            'time limit exceeded',
            'runtime error',
            'compilation error',
            'internal error',
            'other error'
        ],
        default: 'pending'
    },
    runtime: {
        type: Number,
        default: 0
    },
    memory: {
        type: Number,
        default: 0
    },
    errorMessage: {
        type: String,
        default: ''
    },
    testCasesPassed: {
        type: Number,
        default: 0
    },
    testCasesTotal: {
        type: Number,
        default: 0
    },

    // ✅ New notes field
    notes: {
        timeTaken: {
            type: Number,  // store in seconds (or milliseconds if you prefer)
            default: 0
        },
        text: {
            type: String,
            default: ''
        }
    }

}, {
    timestamps: true
});

submissionSchema.index({ userId: 1, problemId: 1 });
submissionSchema.index({ problemId: 1, status: 1 });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
