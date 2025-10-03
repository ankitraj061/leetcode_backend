
import mongoose from "mongoose";
const { Schema } = mongoose;

const problemSchema = new Schema({
    title:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    difficulty:{
        type:String,
        enum:['easy','medium','hard'],
        required:true
    },
    tags:{
        type:[String],
        required:true
    },
    constraints: {
        type: [String], // Admin-defined constraints like "Time: 2 seconds", "Memory: 256MB", etc.
        required: true
    },
    companies: {
        type: [String] // ["Google", "Microsoft", "Amazon"]
    },
    visibleTestCases:[
        {
            input:{
                type:String,
                required:true
            },
            output:{
                type:String,
                required:true
            },
            explanation:{
                type:String,
            },
            imageUrl: {
                type: String // Optional image to help explain the test case
            }

        }
    ],
    hiddenTestCases:[
        {
            input:{
                type:String,
                required:true
            },
            output:{
                type:String,
                required:true
            }
        }
    ],
    startCode:[
        {
            language:{
                type:String,
                required:true
            },
            initialCode:{
                type:String,
                required:true
            }
        }
    ],
    referenceSolution:[
        {
            language:{
                type:String,
                required:true
            },
            completeCode:{
                type:String,
                required:true
            }
        }
    ],

     hints: [{ type: String }],
    editorialContent: { type: String },
    videoSolution: { type: String }, // URL to video explanation
    
    // Admin controls
    isActive: { 
        type: Boolean, 
        default: true // Controls visibility to users
    },
    isPremium: { 
        type: Boolean, 
        default: false 
    },
    problemCreator:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },


},{
    timestamps: true
})

problemSchema.index({ isActive: 1, difficulty: 1 });
problemSchema.index({ title: "text", tags: "text" }); // For search
problemSchema.index({ createdAt: -1 });

const Problem = mongoose.model('Problem',problemSchema);
export default Problem