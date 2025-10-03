// src/migrations/updateDiscussionSchema.js
import Discussion from "../models/discussion.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const updateDiscussionSchema = async () => {
    try {
        // Use your MongoDB URI from environment variables
        const mongoUri = process.env.DB_CONNECT_STRING;
        
        if (!mongoUri) {
            throw new Error('MongoDB URI not found. Please check your .env file for MONGODB_URI or MONGO_URI');
        }
        
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');
        
        console.log('Starting migration: Adding new fields to existing discussions...');
        
        // Count existing discussions
        const totalDiscussions = await Discussion.countDocuments();
        console.log(`Found ${totalDiscussions} existing discussions`);
        
        if (totalDiscussions === 0) {
            console.log('No discussions found. Migration not needed.');
            await mongoose.disconnect();
            process.exit(0);
        }
        
        // Check how many already have the new fields
        const discussionsWithNewFields = await Discussion.countDocuments({ 
            isPinned: { $exists: true } 
        });
        
        if (discussionsWithNewFields === totalDiscussions) {
            console.log('All discussions already have the new fields. Migration not needed.');
            await mongoose.disconnect();
            process.exit(0);
        }
        
        console.log(`${totalDiscussions - discussionsWithNewFields} discussions need to be updated`);
        
        // Update discussions that don't have the new fields
        const result = await Discussion.updateMany(
            { isPinned: { $exists: false } }, // Only update documents without isPinned field
            {
                $set: {
                    isPinned: false,
                    pinnedBy: null,
                    pinnedAt: null,
                    editedBy: null,
                    editedAt: null,
                    acceptedBy: null,
                    acceptedAt: null
                }
            }
        );
        
        console.log(`Migration completed! Modified ${result.modifiedCount} discussions`);
        
        // Verify the migration
        const finalCount = await Discussion.countDocuments({ 
            isPinned: { $exists: true } 
        });
        
        console.log(`Verification: ${finalCount}/${totalDiscussions} discussions now have new fields`);
        
        if (finalCount === totalDiscussions) {
            console.log('✅ Migration successful! All discussions now have the new fields.');
        } else {
            console.log('⚠️ Migration incomplete. Some discussions might still be missing fields.');
        }
        
        await mongoose.disconnect();
        console.log('Database connection closed');
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError.message);
        }
        process.exit(1);
    }
};

// Run migration
console.log('Starting discussion schema migration...');
updateDiscussionSchema();
