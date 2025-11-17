
import mongoose from "mongoose";
const { Schema } = mongoose;

const problemSchema = new Schema({
    title:{
        type:String,
        required:true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
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
            },
            timeComplexity:{ type: String },
            spaceComplexity:{ type: String }

        }
    ],

     hints: [{ type: String }],
    editorialContent: {
    textContent: {
      type: String,
      default: '' // Text explanation/article
    },
    videoUrl: {
      type: String,
      default: 'xyx.com' // Video solution URL
    },
    thumbnailUrl: {
      type: String,
      default: 'xyx.com' // Video thumbnail
    },
    videoDuration: {
      type: Number,
      default: 0 // Duration in seconds
    }
  },
    
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

problemSchema.index({ slug: 1 });
problemSchema.index({ isActive: 1, slug: 1 });

problemSchema.index({ isActive: 1, difficulty: 1 });
problemSchema.index({ title: "text" });
problemSchema.index({ createdAt: -1 });

const Problem = mongoose.model('Problem',problemSchema);
export default Problem