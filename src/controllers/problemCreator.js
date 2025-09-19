
import {submitBatch,submitToken} from "../utils/problemUtility.js";
import Problem from "../models/problem.js";
import { getLanguageId } from "../utils/validator.js";
import User from "../models/user.js";
import Submission from "../models/submission.js";

const createProblem=async(req,res)=>{
    const {title,description,difficulty,tags,visibleTestCases,hiddenTestCases,startCode,referenceSolution}=req.body;
    try{
        for(const {language,completeCode} of referenceSolution){
            //language_id
            //source_code
            //stdin
            //expected_output
            const lang=language.toLowerCase();
            const language_id=getLanguageId(lang);
            if(!language_id)
                throw new Error(`Language ${language} not supported`);

            const submissions=visibleTestCases.map(({input,output})=>({
                language_id,
                source_code:completeCode,
                stdin:input,
                expected_output:output
            }));
            const submitResponse=await submitBatch(submissions);

            const resultToken = submitResponse.map(value => value.token);


            const testResult = await submitToken(resultToken);

            for (const test of testResult) {
        if (test.status_id === 4)
            throw new Error('Wrong Answer');
        else if (test.status_id === 5)
            throw new Error('Time Limit Exceeded');
        else if (test.status_id === 6)
            throw new Error('Compilation Error');
        else if (test.status_id === 13)
            throw new Error('Internal Error');
        else if (test.status_id === 14)
            throw new Error('Exec Format Error');
        else if (test.status_id !== 3) // 3 = Accepted
            throw new Error('Runtime Error');
    }
            

        }
        //now we can create the problem
        const problem= await Problem.create({
            ...req.body,
            problemCreator:req.user._id
        })

        res.status(201).send("Problem created successfully");


    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}


const updateProblemById=async(req,res)=>{
    const {id}=req.params;
    if(!id)
        throw new Error('Problem id not found');

    
    const {title,description,difficulty,tags,visibleTestCases,hiddenTestCases,startCode,referenceSolution}=req.body;
    try{

        const problem=await Problem.findById(id);
    if(!problem)
        throw new Error('Problem not found');
        for(const {language,completeCode} of referenceSolution){
            //language_id
            //source_code
            //stdin
            //expected_output
            const lang=language.toLowerCase();
            const language_id=getLanguageId(lang);
            if(!language_id)
                throw new Error(`Language ${language} not supported`);

            const submissions=visibleTestCases.map(({input,output})=>({
                language_id,
                source_code:completeCode,
                stdin:input,
                expected_output:output
            }));
            const submitResponse=await submitBatch(submissions);

            const resultToken = submitResponse.map(value => value.token);


            const testResult = await submitToken(resultToken);

            for (const test of testResult) {
        if (test.status_id === 4)
            throw new Error('Wrong Answer');
        else if (test.status_id === 5)
            throw new Error('Time Limit Exceeded');
        else if (test.status_id === 6)
            throw new Error('Compilation Error');
        else if (test.status_id === 13)
            throw new Error('Internal Error');
        else if (test.status_id === 14)
            throw new Error('Exec Format Error');
        else if (test.status_id !== 3) // 3 = Accepted
            throw new Error('Runtime Error');
    }
    
}
const updatedProblem=await Problem.findByIdAndUpdate(id,{...req.body},{runValidators:true,new:true});

        res.status(201).send(updatedProblem);




    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}

const deleteProblemById=async(req,res)=>{
    const {id}=req.params;
    if(!id)
        throw new Error('Problem id not found');

    

    try{
        const problem=await Problem.findById(id);
    if(!problem)
        throw new Error('Problem not found');
        await problem.deleteOne();
            res.status(201).send("Problem deleted successfully");

    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
    
}

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


const problemsFetchAll= async (req, res) => {
    try {
        const problems = await Problem.find({},'_id title difficulty tags');
        if (problems.length === 0) {
            throw new Error('No problems found');
        }

        res.status(200).json(problems);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

const totalProblemsSolved=async(req,res)=>{

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
export {createProblem,updateProblemById,deleteProblemById,problemFetchById,problemsFetchAll,totalProblemsSolved,submissionsByProblemId};