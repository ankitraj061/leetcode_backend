// controllers/codeController.js
import prettier from 'prettier';
import Submission from '../models/submission.js';
import Problem from '../models/problem.js';
import mongoose from 'mongoose';

export const formatCode = async (req, res) => {
    try {
        const { code, language } = req.body;

        // Validate input
        if (!code || !language) {
            return res.status(400).json({
                success: false,
                error: 'Code and language are required'
            });
        }

        if (typeof code !== 'string' || code.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Code must be a non-empty string'
            });
        }

        // Check code length limit (prevent abuse)
        if (code.length > 50000) { // 50KB limit
            return res.status(400).json({
                success: false,
                error: 'Code is too large. Maximum 50,000 characters allowed.'
            });
        }

        const normalizedLanguage = language.toLowerCase();
        
        // Check if language is supported
        const supportedLanguages = ['javascript', 'c', 'cpp', 'python', 'java'];
        if (!supportedLanguages.includes(normalizedLanguage)) {
            return res.status(400).json({
                success: false,
                error: `Language '${language}' is not supported. Supported languages: ${supportedLanguages.join(', ')}`
            });
        }

        let formattedCode;

        try {
            switch (normalizedLanguage) {
                case 'javascript':
                    formattedCode = await prettier.format(code, {
                        parser: 'babel',
                        semi: true,
                        singleQuote: true,
                        tabWidth: 4,
                        trailingComma: 'es5',
                        printWidth: 80,
                        bracketSpacing: true,
                        arrowParens: 'avoid'
                    });
                    break;

                case 'java':
                    formattedCode = formatJavaCode(code);
                    break;

                case 'python':
                    formattedCode = formatPythonCode(code);
                    break;

                case 'cpp':
                    formattedCode = formatCppCode(code);
                    break;

                case 'c':
                    formattedCode = formatCCode(code);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        error: `Unsupported language: ${language}`
                    });
            }

            res.json({
                success: true,
                formattedCode: formattedCode,
                language: language,
                message: 'Code formatted successfully'
            });

        } catch (formatError) {
            console.error('Code formatting error:', formatError);
            
            // Return original code if formatting fails
            res.json({
                success: true,
                formattedCode: code,
                language: language,
                message: 'Could not format code. Syntax may be invalid.',
                warning: 'Formatting failed, returning original code'
            });
        }

    } catch (error) {
        console.error('Format code error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to format code',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function for Java formatting
const formatJavaCode = (code) => {
    let lines = code.split('\n');
    let formatted = [];
    let indentLevel = 0;
    const indent = '    '; // 4 spaces

    for (let line of lines) {
        line = line.trim();
        if (line === '') continue;

        // Decrease indent for closing braces
        if (line.includes('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Add indentation
        formatted.push(indent.repeat(indentLevel) + line);

        // Increase indent for opening braces
        if (line.includes('{')) {
            indentLevel++;
        }
    }

    return formatted.join('\n');
};

// Helper function for Python formatting
const formatPythonCode = (code) => {
    let lines = code.split('\n');
    let formatted = [];
    
    for (let line of lines) {
        // Preserve original indentation for Python
        let trimmed = line.trim();
        if (trimmed === '') continue;
        
        // Basic cleanup - ensure consistent spacing around operators
        trimmed = trimmed
            .replace(/\s*=\s*/g, ' = ')
            .replace(/\s*\+\s*/g, ' + ')
            .replace(/\s*-\s*/g, ' - ')
            .replace(/\s*\*\s*/g, ' * ')
            .replace(/\s*\/\s*/g, ' / ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*:\s*/g, ': ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .replace(/\[\s+/g, '[')
            .replace(/\s+\]/g, ']');

        // Preserve original indentation
        let leadingSpaces = line.match(/^(\s*)/)[0];
        formatted.push(leadingSpaces + trimmed);
    }

    return formatted.join('\n');
};

// Helper function for C++ formatting
const formatCppCode = (code) => {
    let lines = code.split('\n');
    let formatted = [];
    let indentLevel = 0;
    const indent = '    '; // 4 spaces

    for (let line of lines) {
        line = line.trim();
        if (line === '') continue;

        // Handle preprocessor directives
        if (line.startsWith('#')) {
            formatted.push(line);
            continue;
        }

        // Decrease indent for closing braces
        if (line.includes('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Add indentation
        formatted.push(indent.repeat(indentLevel) + line);

        // Increase indent for opening braces
        if (line.includes('{')) {
            indentLevel++;
        }
    }

    return formatted.join('\n');
};

// Helper function for C formatting
const formatCCode = (code) => {
    // C formatting is similar to C++
    return formatCppCode(code);
};









export const getLastSubmission = async (req, res) => {
    try {
        const { problemId } = req.params;
        const { language } = req.query; // Language is optional query parameter
        const userId = req.user._id;

        // Validate problem ID format
        if (!mongoose.Types.ObjectId.isValid(problemId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid problem ID format'
            });
        }

        // Build query object
        const query = {
            userId: userId,
            problemId: new mongoose.Types.ObjectId(problemId)
        };

        // Add language filter if provided
        if (language) {
            const supportedLanguages = ['cpp', 'python', 'java', 'javascript', 'c', 'typescript'];
            const normalizedLanguage = language.toLowerCase();
            
            if (!supportedLanguages.includes(normalizedLanguage)) {
                return res.status(400).json({
                    success: false,
                    error: `Unsupported language: ${language}. Supported languages: ${supportedLanguages.join(', ')}`
                });
            }
            
            query.language = normalizedLanguage;
        }

        // Find the most recent submission
        const lastSubmission = await Submission.findOne(query)
            .sort({ createdAt: -1 }) // Sort by creation date, most recent first
            .select('code language status createdAt runtime memory testCasesPassed testCasesTotal errorMessage')
            .lean(); // Use lean() for better performance

        if (!lastSubmission) {
            return res.status(404).json({
                success: false,
                error: language 
                    ? `No previous submission found for this problem in ${language}`
                    : 'No previous submission found for this problem',
                hasSubmission: false
            });
        }

        // Return the submission data
        res.json({
            success: true,
            hasSubmission: true,
            submission: {
                code: lastSubmission.code,
                language: lastSubmission.language,
                status: lastSubmission.status,
                runtime: lastSubmission.runtime,
                memory: lastSubmission.memory,
                testCasesPassed: lastSubmission.testCasesPassed,
                testCasesTotal: lastSubmission.testCasesTotal,
                errorMessage: lastSubmission.errorMessage,
                submittedAt: lastSubmission.createdAt
            },
            message: 'Last submission retrieved successfully'
        });

    } catch (error) {
        console.error('Error retrieving last submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve last submission',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
