import { createClient } from 'redis';
import  dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-11006.c262.us-east-1-3.ec2.redns.redis-cloud.com',
        port: 11006
    }
});

export const redisClient = client;