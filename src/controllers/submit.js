import Problem from "../models/problem.js";
import Submission from "../models/submission.js";
import User from "../models/user.js";
import { getLanguageId } from "../utils/validator.js";
import { submitBatch,submitToken } from "../utils/problemUtility.js";
import mongoose from "mongoose";


export const submitProblem=async(req,res)=>{
    
    try{
        const userId = req.user._id;
        const {problemId}=req.params;
        if(!problemId)
            throw new Error('Problem id not found');
        if(!userId)
            throw new Error('User id not found');
        
        const {code,language}=req.body;
        if(!code)
            throw new Error('Code not found');
        if(!language)
            throw new Error('Language not found');
        const problem= await Problem.findById(problemId);
        if(!problem)
            throw new Error('Problem not found');

        const submissionResponse=await Submission.create({
            problemId,
            userId,
            code,
            language,
            status:'pending',
            totalTestCases:problem.hiddenTestCases.length
        })


        // now submit code to Judge0 api
        const lang=language.toLowerCase();
        const language_id=getLanguageId(lang);
        

        // test both visible and hidden test cases
        const submissions=problem.visibleTestCases.map(({input,output})=>({
            language_id,
            source_code:code,
            stdin:input,
            expected_output:output
        }));
        submissions.push(...problem.hiddenTestCases.map(({input,output})=>({
            language_id,
            source_code:code,
            stdin:input,
            expected_output:output
        })));

        const submitResponse=await submitBatch(submissions);
        const resultToken = submitResponse.map(value => value.token);

        const testResult = await submitToken(resultToken);

        let testCasesPassed=0;
        let memory=0;
        let runtime=0;
        let status='accepted';
        let errorMessage='';
        for(const test of testResult){
            if(test.status_id ===3){
                testCasesPassed++;
                runtime= runtime + parseInt(test.time);
                memory = Math.max(memory,test.memory)
            }
            else if(test.status_id ===4){
                status='wrong answer';
                errorMessage=test.stderr;
                break;
            }
            else if(test.status_id ===5){
                status='time limit exceeded';
                errorMessage=test.stderr;
                break;
            }
            else if(test.status_id ===6){
                status='compilation error';
                errorMessage=test.stderr;
                break;
            }
            else if(test.status_id ===13){
                status='internal error';
                errorMessage=test.stderr;
                break;
            }
            else if(test.status_id ===14){
                status='other error';
                errorMessage=test.stderr;
                break;
            }
            else{
                status='runtime error';
                errorMessage=test.stderr;
                break;
            }

        }


        // update submission
        const submission=await Submission.findById(submissionResponse._id);
        if(!submission)
            throw new Error('Submission not found');
        submission.status=status;
        submission.errorMessage=errorMessage;
        submission.testCasesPassed=testCasesPassed;
        submission.totalTestCases=problem.hiddenTestCases.length;
        submission.memory=memory;
        submission.runtime=runtime;
        submission.testCasesTotal=problem.hiddenTestCases.length+problem.visibleTestCases.length;
        await submission.save();

        const user=await User.findById(userId);
        if(!user)
            throw new Error('User not found');
        if (status === 'accepted') {
    if (!Array.isArray(user.problemsSolved)) {
        user.problemsSolved = [];
    }

    // Convert problemId to ObjectId for correct comparison
    const problemObjectId = new mongoose.Types.ObjectId(problemId);

    if (!user.problemsSolved.some(id => id.equals(problemObjectId))) {
        user.problemsSolved.push(problemObjectId);
        await user.save();
    }
}

        res.status(200).json({ message: 'Code submitted successfully' });

        


    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}

export const runProblem=async(req,res)=>{
     try{
        console.log("Running problem");
        const userId = req.user._id;
        const {problemId}=req.params;
        if(!problemId)
            throw new Error('Problem id not found');
        if(!userId)
            throw new Error('User id not found');
        
        const {code,language}=req.body;
        if(!code)
            throw new Error('Code not found');
        if(!language)
            throw new Error('Language not found');
        const problem= await Problem.findById(problemId);
        if(!problem)
            throw new Error('Problem not found');

       


        // now submit code to Judge0 api
        const lang=language.toLowerCase();
        const language_id=getLanguageId(lang);
        

        // test both visible and hidden test cases
        const submissions=problem.visibleTestCases.map(({input,output})=>({
            language_id,
            source_code:code,
            stdin:input,
            expected_output:output
        }));
        

        const submitResponse=await submitBatch(submissions);
        const resultToken = submitResponse.map(value => value.token);

        const testResult = await submitToken(resultToken);

        // let testCasesPassed=0;
        // let memory=0;
        // let runtime=0;
        // let status='accepted';
        // let errorMessage='';
        // for(const test of testResult){
        //     if(test.status_id ===3){
        //         testCasesPassed++;
        //         runtime= runtime + parseInt(test.time);
        //         memory = Math.max(memory,test.memory)
        //     }
        //     else if(test.status_id ===4){
        //         status='wrong answer';
        //         errorMessage=test.stderr;
        //         break;
        //     }
        //     else if(test.status_id ===5){
        //         status='time limit exceeded';
        //         errorMessage=test.stderr;
        //         break;
        //     }
        //     else if(test.status_id ===6){
        //         status='compilation error';
        //         errorMessage=test.stderr;
        //         break;
        //     }
        //     else if(test.status_id ===13){
        //         status='internal error';
        //         errorMessage=test.stderr;
        //         break;
        //     }
        //     else if(test.status_id ===14){
        //         status='other error';
        //         errorMessage=test.stderr;
        //         break;
        //     }
        //     else{
        //         status='runtime error';
        //         errorMessage=test.stderr;
        //         break;
        //     }

        // }


       

       


        res.status(200).json(testResult);

        


    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}