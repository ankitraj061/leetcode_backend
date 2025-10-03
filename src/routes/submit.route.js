import express from 'express';
const submitRouter = express.Router();
import { userMiddleware } from '../middlewares/userMiddleware.js';
import { submitProblem , runProblem} from '../controllers/submit.controller.js';
import  submitCodeWaitingTimeMiddleware from '../middlewares/submitCodeWaitingTimeMiddleware.js';


submitRouter.post('/submit/:problemId',userMiddleware, submitCodeWaitingTimeMiddleware, submitProblem); 
submitRouter.post('/run/:problemId',userMiddleware, runProblem);

export default submitRouter;
