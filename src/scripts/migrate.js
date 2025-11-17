// src/scripts/deleteVideoSolutionField.js
import 'dotenv/config';
import mongoose from 'mongoose';

async function deleteVideoSolutionField() {
  try {
    await mongoose.connect(process.env.DB_CONNECT_STRING);
    console.log('Connected to MongoDB\n');

    // Use raw MongoDB collection instead of Mongoose model
    const db = mongoose.connection.db;
    const problemsCollection = db.collection('problems');

    // Count how many problems have the videoSolution field
    const countBefore = await problemsCollection.countDocuments({
      videoSolution: { $exists: true }
    });

    console.log(`📊 Found ${countBefore} problems with videoSolution field\n`);

    if (countBefore === 0) {
      console.log('✅ No problems have videoSolution field. Nothing to delete.');
      await mongoose.disconnect();
      return;
    }

    // Remove the videoSolution field from ALL documents
    const result = await problemsCollection.updateMany(
      {},  // Match all documents
      { $unset: { videoSolution: "" } }  // Remove the field
    );

    console.log(`✅ Successfully removed videoSolution field`);
    console.log(`   Matched: ${result.matchedCount} documents`);
    console.log(`   Modified: ${result.modifiedCount} documents\n`);

    // Verify deletion
    const countAfter = await problemsCollection.countDocuments({
      videoSolution: { $exists: true }
    });

    console.log(`📊 Verification:`);
    console.log(`   Before: ${countBefore} problems with videoSolution`);
    console.log(`   After: ${countAfter} problems with videoSolution`);
    
    if (countAfter === 0) {
      console.log(`\n✅ All videoSolution fields successfully deleted!`);
    } else {
      console.log(`\n⚠️  Warning: ${countAfter} problems still have videoSolution field`);
      
      // Show sample document
      const sample = await problemsCollection.findOne({ videoSolution: { $exists: true } });
      console.log('\nSample document still with videoSolution:');
      console.log(JSON.stringify(sample, null, 2));
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

deleteVideoSolutionField();
