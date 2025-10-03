import express from "express";
import { createProblem, updateProblemById, deleteProblemById, problemFetchById,solvedProblems,submissionsByProblemId} from "../controllers/problemCreator.controller.js";
const problemCreatorRouter = express.Router();
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import { userMiddleware } from "../middlewares/userMiddleware.js";
import { activeAccountMiddleware } from "../middlewares/activeAccountMiddleware.js";
import { requestLoggingMiddleware } from "../middlewares/requestLoggingMiddleware.js";
import { ipRateLimitMiddleware } from "../middlewares/ipRateLimitMiddleware.js";
import { validateInput } from "../middlewares/inputValidationMiddleware.js";
import { problemCreationSchema, problemUpdateSchema } from "../middlewares/inputValidationMiddleware.js";

problemCreatorRouter.post('/create',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    adminMiddleware,
    activeAccountMiddleware,
    validateInput(problemCreationSchema),
    createProblem
);

problemCreatorRouter.patch('/:id',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    adminMiddleware,
    activeAccountMiddleware,
    validateInput(problemUpdateSchema), // Use update schema
    updateProblemById
);
problemCreatorRouter.delete('/:id',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    adminMiddleware,
    activeAccountMiddleware,
    deleteProblemById
);












// User routes



problemCreatorRouter.get('/:id',userMiddleware,problemFetchById);


/**
 * @route /api/problem/total/solved
 * @method GET68cdb743b0667cf75209967d
 * 
 * @returns [
    {
        "_id": "68cb18c289c5e198a04341c6",
        "title": "Add Two Numbers",
        "difficulty": "Easy",
        "tags": [
            "Math",
            "Basics"
        ]
    }
]
 * 
 */
problemCreatorRouter.get('/total/solved',userMiddleware,solvedProblems);
problemCreatorRouter.get('/submissions/:problemId',userMiddleware,submissionsByProblemId);

export default problemCreatorRouter;