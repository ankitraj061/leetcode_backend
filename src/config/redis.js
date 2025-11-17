// redis.js - CORRECTED VERSION
import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-11006.c262.us-east-1-3.ec2.redns.redis-cloud.com',
        port: 11006,
        // REMOVE TLS - your Redis instance doesn't use it!
        // tls: false, // explicitly no TLS
        connectTimeout: 15000,
        keepAlive: 5000,
        reconnectStrategy: (retries) => {
            if (retries > 3) { // Reduced to 3 attempts
                console.error('❌ Redis: Max reconnection attempts reached');
                return false; // Stop retrying
            }
            const delay = Math.min(retries * 500, 2000);
            console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
        }
    }
});

// CRITICAL: Add error handler BEFORE any connection attempt
client.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
    // Don't throw - prevents crash
});

client.on('connect', () => {
    console.log('🔗 Redis: Connecting...');
});

client.on('ready', () => {
    console.log('✅ Redis: Connected successfully!');
});

client.on('reconnecting', () => {
    console.log('🔄 Redis: Attempting to reconnect...');
});

client.on('end', () => {
    console.log('🔌 Redis: Connection closed');
});

// Track connection state
let isConnected = false;
let connectionAttempted = false;

// Connect asynchronously - don't block startup
const connectRedis = async () => {
    if (connectionAttempted) {
        console.log('⚠️  Redis connection already attempted');
        return;
    }
    
    connectionAttempted = true;
    
    try {
        console.log('🚀 Attempting to connect to Redis...');
        await client.connect();
        isConnected = true;
        console.log('✅ Redis connected and ready!');
    } catch (err) {
        console.error('❌ Failed to connect to Redis:', err.message);
        console.log('⚠️  App will continue without cache');
        console.log('\n📋 Troubleshooting checklist:');
        console.log('   ✓ Host:', 'redis-11006.c262.us-east-1-3.ec2.redns.redis-cloud.com');
        console.log('   ✓ Port:', 11006);
        console.log('   ✓ Password:', process.env.REDIS_PASSWORD ? 'Set' : '❌ MISSING');
        console.log('   ✓ TLS:', 'Disabled');
        console.log('\n💡 Check Redis Cloud dashboard for correct connection details\n');
    }
};

// Start connection after a small delay to avoid blocking
setTimeout(connectRedis, 100);

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n🛑 ${signal} received, shutting down...`);
    try {
        if (isConnected && client.isOpen) {
            await client.quit();
            console.log('✅ Redis: Disconnected gracefully');
        }
    } catch (err) {
        console.error('Error during shutdown:', err.message);
    }
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Helper to check connection status
export const isRedisConnected = () => {
    return isConnected && client && client.isOpen && client.isReady;
};

export const redisClient = client;
