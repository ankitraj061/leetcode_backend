import { checkAuth } from "../middlewares/checkAuthMiddleware.js";
import { updateTheme as changeTheme } from "../controllers/theme.controller.js";
import express from "express";
import { formatCode,getLastSubmission } from "../controllers/code.controller.js";
import { userMiddleware } from "../middlewares/userMiddleware.js";




const themeRouter = express.Router();
themeRouter.post('/theme',checkAuth,changeTheme);


themeRouter.post('/format', 
   
    userMiddleware, // Ensure user is authenticated
    formatCode
);


themeRouter.get('/last/:problemId', 
    userMiddleware,
    getLastSubmission
);


export default themeRouter;