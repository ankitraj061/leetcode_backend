import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
import main from './config/db.js'
import cookieParser from 'cookie-parser';
import userAuth from './routes/userAuth.route.js';
import {redisClient} from './config/redis.js';
import problemCreatorRouter from './routes/problemCreator.route.js';
import submitRouter from './routes/submit.route.js';
import userDiscussionRouter from './routes/userDiscussion.route.js';
import adminDiscussionRouter from './routes/adminDiscussion.route.js';
import userProblemRouter from './routes/userProblem.route.js';
import themeRouter from './routes/theme.route.js';
import paymentRouter from './routes/payment.route.js';
import SubmissionRrouter from './routes/submission.route.js';
import draftRouter from './routes/draft.route.js';
import feedbackRouter from './routes/feedback.route.js';
import chatRouter from './routes/chat.route.js';
import profileRouter from './routes/profile.route.js';


app.use(cors({
    origin: [
        'http://localhost:3000',  // Your Next.js frontend
        'https://localhost:3000',  // If you use HTTPS locally
    ],
    credentials: true, // Allow cookies and credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Cookie',
        'Set-Cookie',
        'Access-Control-Allow-Credentials'
    ]
}));

app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => paymentRouter.handle(req, res) // or call controller directly
);



app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',userAuth);
app.use('/api/problem',problemCreatorRouter);
app.use('/api',submitRouter);
app.use('/api/user/discussion',userDiscussionRouter);
app.use('/api/admin/discussion',adminDiscussionRouter);
app.use('/api/user/problem',userProblemRouter);
app.use('/api',themeRouter);
app.use('/api/payments', paymentRouter);
app.use('/api',SubmissionRrouter);
app.use('/api',draftRouter);
app.use('/api/feedback',feedbackRouter);
app.use('/api/chat',chatRouter);
app.use('/api',profileRouter);
app.use('/health', (req, res) => res.send('OK'));

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

