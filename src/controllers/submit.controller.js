import Problem from "../models/problem.js";
import Submission from "../models/submission.js";
import User from "../models/user.js";
import { getLanguageId } from "../utils/validator.js";
import { submitBatch,submitToken } from "../utils/problemUtility.js";
import mongoose from "mongoose";
import { compileCode } from "../services/compiler.service.js";
import { updateUserAfterProblemSolve } from "../services/user.service.js";


export const submitProblem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { problemId } = req.params;
        
        if (!problemId) throw new Error('Problem id not found');
        if (!userId) throw new Error('User id not found');
        
        const { code, language, notes } = req.body;
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

        // Local compilation check before sending to Judge0
        const compilationResult = await compileCode({ code, language });
        if (!compilationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Compilation Error',
                compilationError: compilationResult.error,
                status: 'compilation error'
            });
        }

        const totalTestCases = problem.hiddenTestCases.length + problem.visibleTestCases.length;

        // Create initial submission record
        const submissionResponse = await Submission.create({
            problemId,
            userId,
            code,
            language,
            status: 'pending',
            testCasesTotal: totalTestCases,
            notes: {
                timeTaken: notes?.timeTaken || 0,
                text: notes?.text || ''
            }
        });

        const lang = language.toLowerCase();
        const language_id = getLanguageId(lang);
        
        // Test both visible and hidden test cases
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

        // ✅ COMPETITIVE PROGRAMMING APPROACH
        let testCasesPassed = 0;
        let totalRuntime = 0;     // SUM of all test case times
        let maxMemory = 0;        // MAX memory across all test cases
        let status = 'accepted';
        let errorMessage = '';
        
        const detailedResults = [];
        const visibleTestCount = problem.visibleTestCases.length;
        
        // Debug logging
        console.log('=== Judge0 Test Results ===');
        
        for (let i = 0; i < testResult.length; i++) {
            const test = testResult[i];
            const isVisible = i < visibleTestCount;
            
            // Parse time and memory with robust error handling
            const testTime = parseFloat(test.time) || 0;
            const testMemory = parseInt(test.memory) || 0;
            
            console.log(`Test ${i + 1}: status=${test.status_id}, time=${test.time}s, memory=${test.memory}KB`);
            
            const testDetail = {
                index: i,
                passed: test.status_id === 3,
                statusId: test.status_id,
                status: getStatusName(test.status_id),
                executionTime: testTime * 1000, // Convert to milliseconds
                memoryUsage: testMemory,
                isVisible: isVisible,
                isHidden: !isVisible
            };
            
            if (isVisible || test.status_id !== 3) {
                testDetail.input = isVisible ? problem.visibleTestCases[i].input : '[Hidden]';
                testDetail.expectedOutput = isVisible ? problem.visibleTestCases[i].output : '[Hidden]';
                testDetail.actualOutput = test.stdout || '';
                testDetail.errorMessage = test.stderr || test.compile_output || '';
            }
            
            detailedResults.push(testDetail);

            // ✅ COMPETITIVE PROGRAMMING STYLE CALCULATION
            if (test.status_id === 3) {
                // Accepted test case
                testCasesPassed++;
                
                // SUM approach for runtime (total execution time)
                totalRuntime += testTime * 1000; // Convert seconds to milliseconds
                
                // MAX approach for memory (peak memory usage)
                maxMemory = Math.max(maxMemory, testMemory);
                
            } else {
                // Failed test case - stop execution (competitive programming behavior)
                if (test.status_id === 4) {
                    status = 'wrong answer';
                } else if (test.status_id === 5) {
                    status = 'time limit exceeded';
                } else if (test.status_id === 6) {
                    status = 'compilation error';
                } else if (test.status_id === 13) {
                    status = 'internal error';
                } else if (test.status_id === 14) {
                    status = 'other error';
                } else {
                    status = 'runtime error';
                }
                
                errorMessage = test.stderr || test.compile_output || 'Unknown error';
                console.log(`❌ Test ${i + 1} FAILED: ${status}`);
                break; // Stop on first failure (competitive programming style)
            }
        }
        
        // ✅ FINAL CALCULATIONS (Competitive Programming Style)
        const runtime = Math.round(totalRuntime); // Total time in milliseconds
        const memory = maxMemory; // Peak memory in KB
        
        console.log(`=== FINAL RESULTS ===`);
        console.log(`Status: ${status}`);
        console.log(`Tests Passed: ${testCasesPassed}/${totalTestCases}`);
        console.log(`Total Runtime: ${runtime}ms`);
        console.log(`Peak Memory: ${memory}KB`);
        console.log(`=====================`);

        // Update submission record
        const submission = await Submission.findById(submissionResponse._id);
        if (!submission) throw new Error('Submission not found');
        
        submission.status = status;
        submission.errorMessage = errorMessage;
        submission.testCasesPassed = testCasesPassed;
        submission.runtime = runtime;
        submission.memory = memory;
        
        await submission.save();

        // Call user service only on accepted submission
        if (status === 'accepted') {
            try {
                await updateUserAfterProblemSolve(userId, problemId, problem.difficulty);
            } catch (userUpdateError) {
                console.error('Error updating user stats:', userUpdateError);
            }
        }

        // Response
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
                submittedAt: submission.createdAt,
                notes: submission.notes
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
                testDetails: detailedResults.filter(r => 
                    r.isVisible || !r.passed || r.statusId === 6
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
            customTestCases = []
        } = req.body;
        
        if (!code) throw new Error('Code not found');
        if (!language) throw new Error('Language not found');
        
        const problem = await Problem.findById(problemId);
        if (!problem) throw new Error('Problem not found');

        // Check premium access
        if (problem.isPremium && req.user.subscriptionType !== 'premium') {
            return res.status(403).json({ 
                error: 'Premium subscription required' 
            });
        }

        // Local compilation check
        const compilationResult = await compileCode({ code, language });
        if (!compilationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Compilation Error',
                compilationError: compilationResult.error
            });
        }

        const lang = language.toLowerCase();
        const language_id = getLanguageId(lang);

        // Combine visible test cases with custom test cases
        let testCasesToRun = [];
        
        // Include visible test cases
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

        // Process results
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

        // SIMPLIFIED RESPONSE
        res.status(200).json({
            success: true,
            summary: {
                allPassed,
                passedTests,
                totalTests,
                executionTime: maxTime,
                memoryUsage: maxMemory
            },
            testResults: processedResults.map(result => ({
                input: result.input,
                expectedOutput: result.expectedOutput,
                actualOutput: result.actualOutput,
                passed: result.passed,
                status: result.status,
                executionTime: result.executionTime,
                errorMessage: result.errorMessage
            }))
        });

    } catch (error) {
        console.error('Error in runProblem:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
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
