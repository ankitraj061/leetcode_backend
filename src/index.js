import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
import main from './config/db.js'
import cookieParser from 'cookie-parser';
import userAuth from './routes/userAuth.js';
import {redisClient} from './config/redis.js';
import problemCreatorRouter from './routes/problemCreator.js';
import submitRouter from './routes/submit.js';



app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',userAuth);
app.use('/api/problem',problemCreatorRouter);
app.use('/api',submitRouter);

const InitializeConnection = async()=>{
    try{
        await Promise.all([main(),redisClient.connect()]);
        console.log('Database and Redis connected');
        app.listen(process.env.PORT , () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });


    }
    catch(err){
        console.log(err);
    }
}

InitializeConnection();

