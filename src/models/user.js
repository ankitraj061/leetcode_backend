import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
    // Basic Information
    firstName: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: 30,
        trim: true
    },
    lastName: {
        type: String,
        maxLength: 30,
        trim: true
    },
    emailId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        immutable: true,
        validate: {
            validator: function(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Please enter a valid email address'
        }
    },
    username: {
        type: String,
        required: true,
        unique: true,
        minLength: 3,
        maxLength: 20,
        trim: true,
        validate: {
            validator: function(username) {
                return /^[a-zA-Z0-9_]+$/.test(username);
            },
            message: 'Username can only contain letters, numbers, and underscores'
        }
    },
    
    // === NEW: Google OAuth fields ===
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows null values while maintaining uniqueness
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    
    // Profile Information  
    profilePicture: { type: String }, // URL to profile image (Google profile pic for OAuth users)
    bio: { 
        type: String, 
        maxLength: 500,
        trim: true 
    },
    location: { 
        type: String,
        maxLength: 100,
        trim: true 
    },
    
    // Demographics (optional)
    age: { type: Number, min: 6, max: 80 },
    gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer-not-to-say']
    },
    
    // Platform Statistics
    rating: { type: Number, default: 1200 },
    maxRating: { type: Number, default: 1200 },
    globalRank: { type: Number },
    
    // Problem Solving Stats
    problemsSolved: [{
        problemId: { type: Schema.Types.ObjectId, ref: 'Problem' },
        solvedAt: { type: Date, default: Date.now },
        attempts: { type: Number, default: 1 }
    }],
    
    problemStats: {
        easy: {
            solved: { type: Number, default: 0 },
            attempted: { type: Number, default: 0 }
        },
        medium: {
            solved: { type: Number, default: 0 },
            attempted: { type: Number, default: 0 }
        },
        hard: {
            solved: { type: Number, default: 0 },
            attempted: { type: Number, default: 0 }
        }
    },
    
    // Activity Tracking
    streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastSolvedDate: { type: Date }
    },
    
    // Preferences
    preferences: {
        preferredLanguage: { 
            type: String, 
            enum: ['cpp', 'python', 'java', 'javascript', 'c', 'typescript'],
            default: 'javascript' 
        },
        theme: { 
            type: String, 
            enum: ['light', 'dark'], 
            default: 'light' 
        },
        notifications: {
            email: { type: Boolean, default: true },
            contests: { type: Boolean, default: true },
            discussions: { type: Boolean, default: true }
        }
    },
    
    // Social Features
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    
    // Achievements
    badges: [{
        name: { type: String },
        description: { type: String },
        earnedAt: { type: Date, default: Date.now },
        iconUrl: { type: String }
    }],
    
    // Account Management
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    
    // Subscription (for premium features)
    subscriptionType: { 
        type: String, 
        enum: ['free', 'premium'], 
        default: 'free' 
    },
    subscriptionExpiry: { type: Date },
    savedProblems: {
        type: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
        default: [],
        validate: {
            validator: function(array) {
                return array.length === new Set(array.map(id => id.toString())).size;
            },
            message: 'Saved problems must be unique'
        }
    },
    
    // Security - Password only required for local auth
    password: { 
        type: String, 
        required: function() {
            return this.authProvider === 'local';
        }
    },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 }
    
}, { timestamps: true });

// Updated indexes
userSchema.index({ rating: -1 });
userSchema.index({ 'problemsSolved.problemId': 1 });
userSchema.index({ savedProblems: 1 });
userSchema.index({ googleId: 1 }); // New index for Google OAuth
userSchema.index({ authProvider: 1 }); // New index for auth provider

const User = mongoose.model('User', userSchema);
export default User;
