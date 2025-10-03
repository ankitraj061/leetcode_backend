import express from "express";
import { register, login, logout, adminRegister, deleteUserAccount, checkAuthFunction,googleAuth,googleCallback } from "../controllers/userAuth.controller.js";
const authRouter = express.Router();
import { userMiddleware } from "../middlewares/userMiddleware.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import  { checkAuth } from "../middlewares/checkAuthMiddleware.js";

authRouter.post('/register',register);
authRouter.post('/login',login);
authRouter.get('/check',checkAuth,checkAuthFunction);
authRouter.post('/logout',userMiddleware,logout);
authRouter.post('/admin/register', adminMiddleware,adminRegister);
authRouter.delete('/user/profile',userMiddleware,deleteUserAccount);

// authRouter.get('/getProfile',getProfile);



authRouter.get('/google',googleAuth);
authRouter.get('/google/callback',googleCallback);


export default authRouter;