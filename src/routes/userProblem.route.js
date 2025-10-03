import { toggleSaveProblem, getAllProblemsForUser,getProblemForUserbyProblemId,getProblemStats,getAllCompaniesWithCount,getAllTopicsWithCount} from "../controllers/userProblem.controller.js";
import { userMiddleware } from "../middlewares/userMiddleware.js";
import express from "express";
import { requestLoggingMiddleware } from "../middlewares/requestLoggingMiddleware.js";
import { ipRateLimitMiddleware } from "../middlewares/ipRateLimitMiddleware.js";
import { activeAccountMiddleware } from "../middlewares/activeAccountMiddleware.js";
const userProblemRouter = express.Router();


userProblemRouter.get('/companies',
    getAllCompaniesWithCount
)

userProblemRouter.get('/topics', getAllTopicsWithCount);


// Save a problem by user to solve later
userProblemRouter.post('/save/:problemId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    toggleSaveProblem
);




// # Get all problems
// GET /api/user/problem/all?page=1&limit=20

// # Filter by difficulty
// GET /api/user/problem/all?difficulty=easy&page=1&limit=20

// # Filter by status
// GET /api/user/problem/all?status=solved&page=1&limit=20
// GET /api/user/problem/all?status=unsolved&page=1&limit=20

// # Filter by type
// GET /api/user/problem/all?type=premium&page=1&limit=20
// GET /api/user/problem/all?type=saved&page=1&limit=20
// GET /api/user/problem/all?type=free&page=1&limit=20

// # Search problems
// GET /api/user/problem/all?search=binary tree&page=1&limit=20

// # Sort options
// GET /api/user/problem/all?sortBy=difficulty&order=asc
// GET /api/user/problem/all?sortBy=acceptance&order=desc
// GET /api/user/problem/all?sortBy=created&order=desc
userProblemRouter.get('/all',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getAllProblemsForUser
);




userProblemRouter.get('/:problemId',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getProblemForUserbyProblemId
);



// {
//   "success": true,
//   "stats": {
//     "totalSubmissions": 15420,
//     "acceptedSubmissions": 7291,
//     "acceptanceRate": 47.32,
//     "totalSolvers": 6834,
//     "totalDiscussions": 127
//   }
// }

userProblemRouter.get('/:problemId/stats',
    ipRateLimitMiddleware,
    requestLoggingMiddleware,
    userMiddleware,
    activeAccountMiddleware,
    getProblemStats
);



export default userProblemRouter;