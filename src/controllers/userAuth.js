import User from "../models/user.js";
import { validate } from "../utils/validator.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis.js";
import Submission from "../models/submission.js";


export const register = async (req, res) => {
    try {
        validate(req.body);

        const { firstName,lastName, emailId, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const role ='user';


        const user = await User.create({ firstName,lastName, emailId, password: hashedPassword, role });

        const token = jwt.sign({ _id: user._id, emailId:emailId,role }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token', token, { maxAge: 3600000 });
        res.status(201).json(  'User registered successfully' );
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const adminRegister = async (req, res) => {
    try {
        validate(req.body);

        const { firstName,lastName, emailId, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        let role ='user';
        if(req.body.role=='admin'){ 
            role = 'admin';
        }

        const user = await User.create({ firstName,lastName, emailId, password: hashedPassword, role });

        const token = jwt.sign({ _id: user._id, emailId:emailId,role }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token', token, { maxAge: 3600000 });
        res.status(201).json(  'Admin registered successfully' );
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { emailId, password } = req.body;
        if (!emailId || !password) {
            throw new Error('Missing mandatory fields');
        }

        const user = await User.findOne({ emailId });
        const isPasswordValid = await bcrypt.compare(password,user.password);
        if(!isPasswordValid){
            throw new Error('Invalid credentials');
        }

        const token = jwt.sign({ _id: user._id, emailId:emailId ,role:user.role}, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token', token, { maxAge: 3600000 });
        res.status(200).json({ message: 'User logged in successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}

export const logout =async (req, res) => {
    try{
        const {token}=req.cookies;
        const payload =jwt.decode(token)
        await redisClient.set(`token:${token}`,'Blocked');
        await redisClient.expireAt(`token:${token}`,payload.exp);
        res.cookie('token',null,{expires:new Date(Date.now())});
        res.status(200).json({ message: 'User logged out successfully' });

    }
    catch(err){
        res.status(400).json({ error: err.message });

    }
    
}

export const deleteUserAccount = async (req, res) => {
    try {
       const userId = req.user._id;

       await User.findByIdAndDelete(userId);
       await Submission.deleteMany({ userId });
        res.status(200).json({ message: 'User account deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};