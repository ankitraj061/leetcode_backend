import { redisClient } from "../config/redis.js";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
export const adminMiddleware = async (req, res, next) => {

    try{
        const {token} = req.cookies;
        if(!token)
            throw new Error('Token not found');

        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const {_id} = payload;
        if(!_id)
            throw new Error('Invalid token');

        const user = await User.findById(_id);
        if(!user)
            throw new Error('User not found');
        if(user.role !== 'admin')
            throw new Error('Access denied. Admins only');


        const isBlocked = await redisClient.exists(`token:${token}`);
        if(isBlocked)
            throw new Error('User is blocked');

        req.user = user;
        next();

    }
    catch(error){
        res.status(400).json({ error: error.message });
    }
}