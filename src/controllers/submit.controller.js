import Problem from "../models/problem.js";
import Submission from "../models/submission.js";
import User from "../models/user.js";
import { getLanguageId } from "../utils/validator.js";
import { submitBatch,submitToken } from "../utils/problemUtility.js";
import mongoose from "mongoose";
import { compileCode } from "../services/compiler.service.js";


export const submitProblem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { problemId } = req.params;
        
        if (!problemId) throw new Error('Problem id not found');
        if (!userId) throw new Error('User id not found');
        
        const { code, language } = req.body;
        if (!code) throw new Error('Code not found');
        if (!language) throw new Error('Language not found');
        
        const problem = await Problem.findById(problemId);
        if (!problem) throw new Error('Problem not found');

        // Check premium access
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ 
                error: 'Premium subscription required',
                isPremium: true 
            });
        }

        // NEW: Local compilation check before sending to Judge0
        const compilationResult = await compileCode({ code, language });
        if (!compilationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Compilation Error',
                compilationError: compilationResult.error,
                status: 'compilation error'
            });
        }

        // Create initial submission record (keep existing logic)
        const submissionResponse = await Submission.create({
            problemId,
            userId,
            code,
            language,
            status: 'pending',
            totalTestCases: problem.hiddenTestCases.length
        });

        const lang = language.toLowerCase();
        const language_id = getLanguageId(lang);
        
        // Test both visible and hidden test cases (keep existing logic)
        const submissions = problem.visibleTestCases.map(({ input, output }) => ({
            language_id,
            source_code: code,
            stdin: input,
            expected_output: output
        }));
        submissions.push(...problem.hiddenTestCases.map(({ input, output }) => ({
            language_id,
            source_code: code,
            stdin: input,
            expected_output: output
        })));

        const submitResponse = await submitBatch(submissions);
        const resultToken = submitResponse.map(value => value.token);
        const testResult = await submitToken(resultToken);

        // Enhanced result processing (keeping your existing logic but adding details)
        let testCasesPassed = 0;
        let memory = 0;
        let runtime = 0;
        let status = 'accepted';
        let errorMessage = '';
        
        // NEW: Enhanced result tracking
        const detailedResults = [];
        const visibleTestCount = problem.visibleTestCases.length;
        
        for (let i = 0; i < testResult.length; i++) {
            const test = testResult[i];
            const isVisible = i < visibleTestCount;
            
            const testDetail = {
                index: i,
                passed: test.status_id === 3,
                statusId: test.status_id,
                status: getStatusName(test.status_id),
                executionTime: parseFloat(test.time) || 0,
                memoryUsage: parseInt(test.memory) || 0,
                isVisible: isVisible,
                isHidden: !isVisible
            };
            
            // Only show details for visible tests or failed tests
            if (isVisible || test.status_id !== 3) {
                testDetail.input = isVisible ? problem.visibleTestCases[i].input : '[Hidden]';
                testDetail.expectedOutput = isVisible ? problem.visibleTestCases[i].output : '[Hidden]';
                testDetail.actualOutput = test.stdout || '';
                testDetail.errorMessage = test.stderr || test.compile_output || '';
            }
            
            detailedResults.push(testDetail);

            // Keep your existing logic for overall status
            if (test.status_id === 3) {
                testCasesPassed++;
                runtime = runtime + parseInt(test.time);
                memory = Math.max(memory, test.memory);
            } else if (test.status_id === 4) {
                status = 'wrong answer';
                errorMessage = test.stderr;
                break;
            } else if (test.status_id === 5) {
                status = 'time limit exceeded';
                errorMessage = test.stderr;
                break;
            } else if (test.status_id === 6) {
                status = 'compilation error';
                errorMessage = test.stderr;
                break;
            } else if (test.status_id === 13) {
                status = 'internal error';
                errorMessage = test.stderr;
                break;
            } else if (test.status_id === 14) {
                status = 'other error';
                errorMessage = test.stderr;
                break;
            } else {
                status = 'runtime error';
                errorMessage = test.stderr;
                break;
            }
        }

        // Update submission (keep existing logic)
        const submission = await Submission.findById(submissionResponse._id);
        if (!submission) throw new Error('Submission not found');
        
        submission.status = status;
        submission.errorMessage = errorMessage;
        submission.testCasesPassed = testCasesPassed;
        submission.totalTestCases = problem.hiddenTestCases.length;
        submission.memory = memory;
        submission.runtime = runtime;
        submission.testCasesTotal = problem.hiddenTestCases.length + problem.visibleTestCases.length;
        await submission.save();

        // Update user's solved problems (keep existing logic)
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        
        if (status === 'accepted') {
            if (!Array.isArray(user.problemsSolved)) {
                user.problemsSolved = [];
            }

            const problemObjectId = new mongoose.Types.ObjectId(problemId);

            if (!user.problemsSolved.some(id => id.equals(problemObjectId))) {
                user.problemsSolved.push(problemObjectId);
                await user.save();
            }
        }

        // NEW: Enhanced response with detailed information
        res.status(200).json({
            success: true,
            message: 'Code submitted successfully',
            submission: {
                id: submission._id,
                status: status,
                testCasesPassed: testCasesPassed,
                totalTestCases: submission.testCasesTotal,
                executionTime: runtime,
                memoryUsage: memory,
                language: language,
                submittedAt: submission.createdAt
            },
            results: {
                overall: {
                    status: status,
                    passed: status === 'accepted',
                    passedTests: testCasesPassed,
                    totalTests: submission.testCasesTotal,
                    visibleTests: problem.visibleTestCases.length,
                    hiddenTests: problem.hiddenTestCases.length,
                    executionTime: runtime,
                    memoryUsage: memory
                },
                // Only show failed test details or visible test results
                testDetails: detailedResults.filter(r => 
                    r.isVisible || !r.passed || r.statusId === 6 // Show visible, failed, or compilation errors
                ),
                errorMessage: errorMessage
            },
            problem: {
                id: problem._id,
                title: problem.title,
                difficulty: problem.difficulty
            }
        });

    } catch (error) {
        console.error('Error in submitProblem:', error);
        res.status(400).json({ error: error.message });
    }
};



/**
 * Run a problem with the given code and language.
 * 
 * @param {Object} req.body - Contains code, language, and customTestCases.
 * @param {Object} req.params - Contains problemId.
 * @param {Object} req.user - Contains userId.
 * 
 * @returns {Object} - Response with success, summary, testResults, and rawResults.
 * @throws {Error} - Error message if something goes wrong.
 */

// const customTestCase = {
//     input: "string",           // The input to pass to your function
//     expectedOutput: "string"   // What you expect the output to be
// };
export const runProblem = async (req, res) => {
    try {
        console.log("Running problem");
        const userId = req.user._id;
        const { problemId } = req.params;
        
        if (!problemId) throw new Error('Problem id not found');
        if (!userId) throw new Error('User id not found');
        
        const { 
            code, 
            language,
            customTestCases = [] // NEW: Accept custom test cases from frontend
        } = req.body;
        
        if (!code) throw new Error('Code not found');
        if (!language) throw new Error('Language not found');
        
        const problem = await Problem.findById(problemId);
        if (!problem) throw new Error('Problem not found');

        // Check premium access (if needed)
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ 
                error: 'Premium subscription required' 
            });
        }

         // NEW: Local compilation check before sending to Judge0
        const compilationResult = await compileCode({ code, language });
        if (!compilationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Compilation Error',
                compilationError: compilationResult.error,
                status: 'compilation error'
            });
        }


        const lang = language.toLowerCase();
        const language_id = getLanguageId(lang);

        // NEW: Combine visible test cases with custom test cases
        let testCasesToRun = [];
        
        // Always include visible test cases
        const visibleTests = problem.visibleTestCases.map(({ input, output }) => ({
            language_id,
            source_code: code,
            stdin: input,
            expected_output: output,
            isDefault: true,
            originalInput: input,
            originalOutput: output
        }));
        
        testCasesToRun.push(...visibleTests);
        
        // Add custom test cases if provided
        if (customTestCases.length > 0) {
            const customTests = customTestCases.map(({ input, expectedOutput }) => ({
                language_id,
                source_code: code,
                stdin: input,
                expected_output: expectedOutput,
                isCustom: true,
                originalInput: input,
                originalOutput: expectedOutput
            }));
            
            testCasesToRun.push(...customTests);
        }

        // Submit to Judge0
        const submissions = testCasesToRun.map(({ language_id, source_code, stdin, expected_output }) => ({
            language_id,
            source_code,
            stdin,
            expected_output
        }));

        const submitResponse = await submitBatch(submissions);
        const resultToken = submitResponse.map(value => value.token);
        const testResult = await submitToken(resultToken);

        // NEW: Process results with enhanced information
        const processedResults = testResult.map((result, index) => {
            const testCase = testCasesToRun[index];
            
            return {
                testCaseIndex: index,
                input: testCase.originalInput,
                expectedOutput: testCase.originalOutput,
                actualOutput: result.stdout || '',
                passed: result.status_id === 3,
                status: getStatusName(result.status_id),
                statusId: result.status_id,
                executionTime: parseFloat(result.time) || 0,
                memoryUsage: parseInt(result.memory) || 0,
                errorMessage: result.stderr || result.compile_output || '',
                isDefault: testCase.isDefault || false,
                isCustom: testCase.isCustom || false
            };
        });

        // Calculate summary
        const passedTests = processedResults.filter(r => r.passed).length;
        const totalTests = processedResults.length;
        const allPassed = passedTests === totalTests;
        const maxTime = Math.max(...processedResults.map(r => r.executionTime));
        const maxMemory = Math.max(...processedResults.map(r => r.memoryUsage));

        // NEW: Enhanced response format
        res.status(200).json({
            success: true,
            summary: {
                allPassed,
                passedTests,
                totalTests,
                defaultTests: processedResults.filter(r => r.isDefault).length,
                customTests: processedResults.filter(r => r.isCustom).length,
                executionTime: maxTime,
                memoryUsage: maxMemory
            },
            testResults: processedResults,
            rawResults: testResult // Keep original for backward compatibility
        });

    } catch (error) {
        console.error('Error in runProblem:', error);
        res.status(400).json({ error: error.message });
    }
};

// Helper function to get readable status names
const getStatusName = (statusId) => {
    const statusMap = {
        1: 'In Queue',
        2: 'Processing',
        3: 'Accepted',
        4: 'Wrong Answer',
        5: 'Time Limit Exceeded',
        6: 'Compilation Error',
        7: 'Runtime Error (SIGSEGV)',
        8: 'Runtime Error (SIGXFSZ)',
        9: 'Runtime Error (SIGFPE)',
        10: 'Runtime Error (SIGABRT)',
        11: 'Runtime Error (NZEC)',
        12: 'Runtime Error (Other)',
        13: 'Internal Error',
        14: 'Exec Format Error'
    };
    return statusMap[statusId] || 'Unknown Error';
};
