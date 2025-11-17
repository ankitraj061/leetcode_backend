import mongoose from 'mongoose';
import User from '../models/user.js';
import Submission from '../models/submission.js';
import Problem from '../models/problem.js';

export const updateUserAfterProblemSolve = async (userId, problemId, problemDifficulty) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const problemObjectId = new mongoose.Types.ObjectId(problemId);
        
        // Check if already solved - CORRECTED: check for problemId in objects
        const alreadySolved = user.problemsSolved.some(
            solved => solved.problemId && solved.problemId.toString() === problemId.toString()
        );

        if (alreadySolved) {
            console.log(`User ${userId} already solved problem ${problemId}`);
            return { success: true, message: 'Problem already solved' };
        }

        const updates = {};
        updates.$push = {};

        // ✅ FIX: Push as object with problemId field to match schema
        updates.$push.problemsSolved = {
            problemId: problemObjectId,
            solvedAt: new Date(),
            difficulty: problemDifficulty
        };

        // Update streak calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const lastSolved = user.streak.lastSolvedDate;
        let newCurrentStreak = 1;
        
        if (lastSolved) {
            const lastSolvedDate = new Date(lastSolved);
            lastSolvedDate.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.floor((today - lastSolvedDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 0) {
                newCurrentStreak = user.streak.current;
            } else if (daysDiff === 1) {
                newCurrentStreak = user.streak.current + 1;
            } else {
                newCurrentStreak = 1;
            }
        }

        updates['streak.current'] = newCurrentStreak;
        updates['streak.longest'] = Math.max(user.streak.longest, newCurrentStreak);
        updates['streak.lastSolvedDate'] = new Date();

        // Check for new badges
        const badges = [];
        const totalSolved = user.problemsSolved.length + 1;
        const existingBadgeNames = user.badges.map(badge => badge.name);
        
        // Achievement badges
        if (totalSolved === 1 && !existingBadgeNames.includes('First Solve')) {
            badges.push({
                name: 'First Solve',
                description: 'Solved your first problem!',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/firstSolve.png?updatedAt=1760933577260'
            });
        }
        
        if (totalSolved === 10 && !existingBadgeNames.includes('Problem Solver')) {
            badges.push({
                name: 'Problem Solver',
                description: 'Solved 10 problems',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/problemSolver.png?updatedAt=1760933649100'
            });
        }
        
        if (totalSolved === 50 && !existingBadgeNames.includes('Coding Enthusiast')) {
            badges.push({
                name: 'Coding Enthusiast',
                description: 'Solved 50 problems',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/codingEnthusiast.png?updatedAt=1760932933830'
            });
        }

        if (totalSolved === 100 && !existingBadgeNames.includes('Century Club')) {
            badges.push({
                name: 'Century Club',
                description: 'Solved 100 problems',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/centuryClub.png?updatedAt=1760933703775'
            });
        }
        
        // Streak badges
        if (newCurrentStreak === 7 && !existingBadgeNames.includes('Week Warrior')) {
            badges.push({
                name: 'Week Warrior',
                description: '7-day solving streak',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/weeklyWarrior.png?updatedAt=1760933522731'
            });
        }
        
        if (newCurrentStreak === 30 && !existingBadgeNames.includes('Monthly Master')) {
            badges.push({
                name: 'Monthly Master',
                description: '30-day solving streak',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/monthlyMaster.png?updatedAt=1760932393464'
            });
        }
        
        if (newCurrentStreak === 365 && !existingBadgeNames.includes('Yearly Champion')) {
            badges.push({
                name: 'Yearly Champion',
                description: '365-day solving streak',
                iconUrl: 'https://ik.imagekit.io/tvz1mupab/yearlyChampion.png?updatedAt=1760933438382'
            });
        }

        if (badges.length > 0) {
            updates.$push.badges = { $each: badges };
        }

        if (Object.keys(updates.$push).length === 0) delete updates.$push;

        // Apply all updates
        await User.findByIdAndUpdate(userId, updates);

        console.log(`✅ User ${userId} stats updated after solving problem ${problemId} (${problemDifficulty})`);
        
        return {
            success: true,
            updatedFields: {
                problemsSolved: true,
                streak: true,
                badges: badges.length > 0
            },
            newBadges: badges
        };
        
    } catch (error) {
        console.error('❌ Error updating user after problem solve:', error);
        throw error;
    }
};