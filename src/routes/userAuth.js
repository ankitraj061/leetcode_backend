import express from "express";
import { register, login, logout, adminRegister, deleteUserAccount } from "../controllers/userAuth.js";
const authRouter = express.Router();
import { userMiddleware } from "../middleware/userMiddleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

authRouter.post('/register',register);
authRouter.post('/login',login);
authRouter.post('/logout',userMiddleware,logout);
authRouter.post('/admin/register', adminMiddleware,adminRegister);
authRouter.delete('/profile',userMiddleware,deleteUserAccount);
// authRouter.get('/getProfile',getProfile);


export default authRouter;