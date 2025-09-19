import express from "express";
import { createProblem, updateProblemById, deleteProblemById, problemFetchById, problemsFetchAll ,totalProblemsSolved,submissionsByProblemId} from "../controllers/problemCreator.js";
const problemCreatorRouter = express.Router();
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import { userMiddleware } from "../middleware/userMiddleware.js";

problemCreatorRouter.post('/create',adminMiddleware,createProblem);
problemCreatorRouter.patch('/:id',adminMiddleware,updateProblemById);
problemCreatorRouter.delete('/:id',adminMiddleware,deleteProblemById);

problemCreatorRouter.get('/:id',userMiddleware,problemFetchById);
problemCreatorRouter.get('/',userMiddleware,problemsFetchAll);
problemCreatorRouter.get('/total/solved',userMiddleware,totalProblemsSolved);
problemCreatorRouter.get('/submissions/:problemId',userMiddleware,submissionsByProblemId);

export default problemCreatorRouter;``