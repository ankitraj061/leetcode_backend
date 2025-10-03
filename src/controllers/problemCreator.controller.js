
import {submitBatch,submitToken} from "../utils/problemUtility.js";
import Problem from "../models/problem.js";
import { getLanguageId } from "../utils/validator.js";
import User from "../models/user.js";
import Submission from "../models/submission.js";
import mongoose from "mongoose";
import Contest from "../models/contest.js";
import Company from "../models/company.js";
import Discussion from "../models/discussion.js";

const createProblem = async (req, res) => {
    const {
        title,
        description,
        difficulty,
        tags,
        constraints,
        companies,
        visibleTestCases,
        hiddenTestCases,
        startCode,
        referenceSolution,
        hints,
        editorialContent,
        videoSolution,
        isPremium
    } = req.body;

    try {
        // Validate required fields
        if (!constraints || constraints.length === 0) {
            throw new Error('At least one constraint is required');
        }

        if (!tags || tags.length === 0) {
            throw new Error('At least one tag is required');
        }

        if (!visibleTestCases || visibleTestCases.length === 0) {
            throw new Error('At least one visible test case is required');
        }

        // DEBUG: Log the visible test cases to see data types
        console.log('Visible Test Cases:', JSON.stringify(visibleTestCases, null, 2));

        // Test reference solutions against visible test cases
        for (const { language, completeCode } of referenceSolution) {
            const lang = language.toLowerCase();
            const language_id = getLanguageId(lang);
            
            if (!language_id) {
                throw new Error(`Language ${language} not supported`);
            }

            // CRITICAL FIX: Ensure ALL fields are strings
            const submissions = visibleTestCases.map(({ input, output }, index) => {
                // DEBUG: Log each test case
                console.log(`Test case ${index}:`, { input, output, inputType: typeof input, outputType: typeof output });
                
                const submission = {
                    language_id: String(language_id),
                    source_code: String(completeCode),
                    stdin: String(input),
                    expected_output: String(output)
                };

                // DEBUG: Log the final submission object
                console.log(`Submission ${index}:`, submission);
                
                return submission;
            });

            console.log('Final submissions array:', JSON.stringify(submissions, null, 2));

            const submitResponse = await submitBatch(submissions);
            const resultToken = submitResponse.map(value => value.token);
            const testResult = await submitToken(resultToken);

            // Enhanced error handling
            for (let i = 0; i < testResult.length; i++) {
                const test = testResult[i];
                const testCase = visibleTestCases[i];
                
                if (test.status_id === 4) {
                    throw new Error(`Wrong Answer in ${language} for test case: ${testCase.input}`);
                } else if (test.status_id === 5) {
                    throw new Error(`Time Limit Exceeded in ${language} for test case: ${testCase.input}`);
                } else if (test.status_id === 6) {
                    throw new Error(`Compilation Error in ${language}. Check your reference solution.`);
                } else if (test.status_id === 13) {
                    throw new Error(`Internal Error while testing ${language}`);
                } else if (test.status_id === 14) {
                    throw new Error(`Exec Format Error in ${language}`);
                } else if (test.status_id !== 3) {
                    throw new Error(`Runtime Error in ${language} for test case: ${testCase.input}`);
                }
            }
        }

        // Create the problem
        const problemData = {
            title,
            description,
            difficulty: difficulty.toLowerCase(),
            tags,
            constraints,
            visibleTestCases,
            hiddenTestCases,
            startCode,
            referenceSolution,
            problemCreator: req.user._id,
            ...(companies && { companies }),
            ...(hints && { hints }),
            ...(editorialContent && { editorialContent }),
            ...(videoSolution && { videoSolution }),
            ...(isPremium !== undefined && { isPremium })
        };

        const problem = await Problem.create(problemData);

        res.status(201).json({
            message: "Problem created successfully",
            problemId: problem._id,
            title: problem.title,
            difficulty: problem.difficulty,
            isActive: problem.isActive,
            isPremium: problem.isPremium
        });

    } catch (error) {
        console.error('Error creating problem:', error);
        res.status(400).json({ error: error.message });
    }
};





const updateProblemById = async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'Problem id not found' });
    }

    const {
        title,
        description,
        difficulty,
        tags,
        constraints,              // NEW: Required field
        companies,                // NEW: Optional field
        visibleTestCases,
        hiddenTestCases,
        startCode,
        referenceSolution,
        hints,                    // NEW: Optional field
        editorialContent,         // NEW: Optional field
        videoSolution,            // NEW: Optional field
        isActive,                 // NEW: Admin can activate/deactivate
        isPremium                 // NEW: Admin can set premium status
    } = req.body;

    try {
        // Check if problem exists
        const existingProblem = await Problem.findById(id);
        if (!existingProblem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        // Validate required fields if they're being updated
        if (constraints !== undefined && (!constraints || constraints.length === 0)) {
            throw new Error('At least one constraint is required');
        }

        if (tags !== undefined && (!tags || tags.length === 0)) {
            throw new Error('At least one tag is required');
        }

        if (visibleTestCases !== undefined && (!visibleTestCases || visibleTestCases.length === 0)) {
            throw new Error('At least one visible test case is required');
        }

        // Test reference solutions if they're being updated
        if (referenceSolution && visibleTestCases) {
            console.log('Testing updated reference solutions...');
            
            for (const { language, completeCode } of referenceSolution) {
                const lang = language.toLowerCase();
                const language_id = getLanguageId(lang);
                
                if (!language_id) {
                    throw new Error(`Language ${language} not supported`);
                }

                // Use existing visible test cases if not being updated
                const testCases = visibleTestCases || existingProblem.visibleTestCases;

                // FIXED: Convert all values to strings for Judge0
                const submissions = testCases.map(({ input, output }) => ({
                    language_id: String(language_id),
                    source_code: String(completeCode),
                    stdin: String(input),
                    expected_output: String(output)
                }));

                const submitResponse = await submitBatch(submissions);
                const resultToken = submitResponse.map(value => value.token);
                const testResult = await submitToken(resultToken);

                // Enhanced error handling with test case info
                for (let i = 0; i < testResult.length; i++) {
                    const test = testResult[i];
                    const testCase = testCases[i];
                    
                    if (test.status_id === 4) {
                        throw new Error(`Wrong Answer in ${language} for test case: ${testCase.input}`);
                    } else if (test.status_id === 5) {
                        throw new Error(`Time Limit Exceeded in ${language} for test case: ${testCase.input}`);
                    } else if (test.status_id === 6) {
                        throw new Error(`Compilation Error in ${language}. Check your reference solution.`);
                    } else if (test.status_id === 13) {
                        throw new Error(`Internal Error while testing ${language}`);
                    } else if (test.status_id === 14) {
                        throw new Error(`Exec Format Error in ${language}`);
                    } else if (test.status_id !== 3) { // 3 = Accepted
                        throw new Error(`Runtime Error in ${language} for test case: ${testCase.input}`);
                    }
                }
            }
        }

        // Prepare update data - only include fields that are provided
        const updateData = {};
        
        // Core fields
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (difficulty !== undefined) updateData.difficulty = difficulty.toLowerCase();
        if (tags !== undefined) updateData.tags = tags;
        if (constraints !== undefined) updateData.constraints = constraints;
        
        // Test cases and code
        if (visibleTestCases !== undefined) updateData.visibleTestCases = visibleTestCases;
        if (hiddenTestCases !== undefined) updateData.hiddenTestCases = hiddenTestCases;
        if (startCode !== undefined) updateData.startCode = startCode;
        if (referenceSolution !== undefined) updateData.referenceSolution = referenceSolution;
        
        // Optional new fields
        if (companies !== undefined) updateData.companies = companies;
        if (hints !== undefined) updateData.hints = hints;
        if (editorialContent !== undefined) updateData.editorialContent = editorialContent;
        if (videoSolution !== undefined) updateData.videoSolution = videoSolution;
        
        // Admin controls
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isPremium !== undefined) updateData.isPremium = isPremium;

        // Update the problem
        const updatedProblem = await Problem.findByIdAndUpdate(
            id,
            updateData,
            { 
                runValidators: true, 
                new: true,
                context: 'query' // For custom validators
            }
        );

        res.status(200).json({
            message: "Problem updated successfully",
            problem: {
                id: updatedProblem._id,
                title: updatedProblem.title,
                difficulty: updatedProblem.difficulty,
                isActive: updatedProblem.isActive,
                isPremium: updatedProblem.isPremium,
                updatedAt: updatedProblem.updatedAt
            }
        });

    } catch (error) {
        console.error('Error updating problem:', error);
        res.status(400).json({ error: error.message });
    }
};



const deleteProblemById = async (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({ error: 'Problem id is required' });
    }

    // Start a transaction for atomic deletion
    const session = await mongoose.startSession();
    
    try {
        await session.withTransaction(async () => {
            // Check if problem exists
            const problem = await Problem.findById(id).session(session);
            if (!problem) {
                throw new Error('Problem not found');
            }

            // Store problem info for response
            const problemInfo = {
                id: problem._id,
                title: problem.title,
                difficulty: problem.difficulty
            };

            console.log(`Starting transactional deletion for problem: ${problem.title} (${id})`);

            // 1. Delete all submissions for this problem
            const submissionDeleteResult = await Submission.deleteMany(
                { problemId: id }, 
                { session }
            );

            console.log(`Deleted ${submissionDeleteResult.deletedCount} submissions for problem: ${problem.title} (${id})`);

            // 2. Delete all discussions for this problem
            const discussionDeleteResult = await Discussion.deleteMany(
                { problemId: id }, 
                { session }
            );

            console.log(`Deleted ${discussionDeleteResult.deletedCount} discussions for problem: ${problem.title} (${id})`);

            // 3. Remove problem from users' problemsSolved arrays
            const userUpdateResult = await User.updateMany(
                { 'problemsSolved.problemId': id },
                { $pull: { problemsSolved: { problemId: id } } },
                { session }
            );

            console.log(`Updated ${userUpdateResult.modifiedCount} users' problemsSolved arrays for problem: ${problem.title} (${id})`);

            // 4. Update user problem statistics
            const usersWhoSolved = await User.find(
                { 'problemsSolved.problemId': id },
                null,
                { session }
            );

            console.log(`Found ${usersWhoSolved.length} users who solved problem: ${problem.title} (${id})`);
            
            for (const user of usersWhoSolved) {
                const difficultyLevel = problem.difficulty.toLowerCase();
                
                if (user.problemStats[difficultyLevel]) {
                    user.problemStats[difficultyLevel].solved = Math.max(0, 
                        user.problemStats[difficultyLevel].solved - 1
                    );

                    await user.save({ session });
                }
            }

            console.log(`Updated problem stats for ${usersWhoSolved.length} users for problem: ${problem.title} (${id})`);

            // 5. Remove problem from all contests
            const contestUpdateResult = await Contest.updateMany(
                { problems: id },
                { $pull: { problems: id } },
                { session }
            );

            console.log(`Updated ${contestUpdateResult.modifiedCount} contests for problem: ${problem.title} (${id})`);

            // 6. Handle contests that become empty (optional - you might want to keep them)
            const emptyContests = await Contest.find(
                { problems: { $size: 0 } },
                null,
                { session }
            );

            console.log(`Found ${emptyContests.length} empty contests for problem: ${problem.title} (${id})`);

            // Optional: Delete contests with no problems or just mark them as inactive
            let emptyContestCount = 0;
            for (const contest of emptyContests) {
                // Option A: Delete empty contests
                // await Contest.findByIdAndDelete(contest._id, { session });
                
                // Option B: Mark empty contests as inactive (recommended)
                contest.status = 'cancelled';
                await contest.save({ session });
                emptyContestCount++;
            }

            console.log(`Handled ${emptyContestCount} empty contests for problem: ${problem.title} (${id})`);

            // 7. Remove problem from all companies' problem arrays
            const companyUpdateResult = await Company.updateMany(
                { problems: id },
                { $pull: { problems: id } },
                { session }
            );

            console.log(`Updated ${companyUpdateResult.modifiedCount} companies for problem: ${problem.title} (${id})`);

            // 8. Delete the problem itself
            await Problem.findByIdAndDelete(id, { session });

            console.log(`Deleted problem: ${problem.title} (${id})`);

            // Store results for response
            req.deletionResults = {
                problemInfo,
                submissionsDeleted: submissionDeleteResult.deletedCount,
                discussionsDeleted: discussionDeleteResult.deletedCount,
                usersUpdated: userUpdateResult.modifiedCount,
                contestsUpdated: contestUpdateResult.modifiedCount,
                emptyContestsHandled: emptyContestCount,
                companiesUpdated: companyUpdateResult.modifiedCount
            };
        });

        console.log(`Problem deletion completed: ${req.deletionResults.problemInfo.title}`);

        res.status(200).json({
            message: "Problem and all related data deleted successfully",
            deletedData: req.deletionResults
        });

    } catch (error) {
        console.error('Transaction failed - Problem deletion rolled back:', error);
        
        if (error.message === 'Problem not found') {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid problem ID format' });
        }
        
        res.status(500).json({ 
            error: 'Internal server error while deleting problem and related data',
            details: error.message 
        });
    } finally {
        await session.endSession();
    }
};


const problemFetchById= async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new Error('Problem id not found');
    }
    try {
        const problem = await Problem.findById(id).select('-problemCreator -hiddenTestCases -referenceSolution');
        if (!problem) {
            throw new Error('Problem not found');
        }
        res.status(200).json(problem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}




const solvedProblems=async(req,res)=>{

    const userId=req.user._id;
    if(!userId)
        throw new Error('User id not found');

    try{
        
        const user = await User.findById(userId).populate({
            path: 'problemsSolved',
            select: '_id title difficulty tags'
        });
        if(!user)
            throw new Error('User not found');
        

       
        res.status(200).json(user.problemsSolved);

    }
    catch(error){
        res.status(400).json({ error: error.message });
    }

}


const submissionsByProblemId=async(req,res)=>{
    try{
        const problemId=req.params.problemId;
        if(!problemId)
            throw new Error('Problem id not found');
        const userId=req.user._id;
        if(!userId)
            throw new Error('User id not found');
        
        const submissions=await Submission.find({userId,problemId});
        if(!submissions)
            throw new Error('Submissions not found');
        res.status(200).json(submissions);

    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}
export {createProblem,updateProblemById,deleteProblemById,problemFetchById,solvedProblems,submissionsByProblemId};