import express from 'express';
const submitRouter = express.Router();
import { userMiddleware } from '../middleware/userMiddleware.js';
import { submitProblem , runProblem} from '../controllers/submit.js';
import  submitCodeWaitingTimeMiddleware from '../middleware/submitCodeWaitingTimeMiddleware.js';


submitRouter.post('/submit/:problemId',userMiddleware, submitCodeWaitingTimeMiddleware, submitProblem); 
submitRouter.post('/run/:problemId',userMiddleware, runProblem);

export default submitRouter;
