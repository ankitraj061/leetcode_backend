import { checkAuth } from "../middlewares/checkAuthMiddleware.js";
import { updateTheme as changeTheme } from "../controllers/theme.controller.js";
import express from "express";


const themeRouter = express.Router();
themeRouter.post('/theme',checkAuth,changeTheme);
export default themeRouter;