// redis.js - FIXED & CLEAN
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST, // ✅ from .env
    port: Number(process.env.REDIS_PORT),
    tls: {}, // ✅ REQUIRED for Redis Cloud
    connectTimeout: 15000,
    keepAlive: 5000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.error("❌ Redis: Max reconnection attempts reached");
        return false;
      }
      const delay = Math.min(retries * 500, 2000);
      console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    }
  }
});

// ---- Event listeners ----
client.on("error", (err) => {
  console.error("❌ Redis Error:", err.message);
});

client.on("connect", () => {
  console.log("🔗 Redis: Connecting...");
});

client.on("ready", () => {
  console.log("✅ Redis: Connected successfully!");
});

client.on("end", () => {
  console.log("🔌 Redis: Connection closed");
});

// ---- Connection control ----
let connectionAttempted = false;

export const connectRedis = async () => {
  if (connectionAttempted) return;
  connectionAttempted = true;

  try {
    console.log("🚀 Attempting to connect to Redis...");
    await client.connect();
  } catch (err) {
    console.error("❌ Failed to connect to Redis:", err.message);
    console.log("⚠️ App will continue without cache");
  }
};

// Delay connection
setTimeout(connectRedis, 100);

// Graceful shutdown
const shutdown = async () => {
  try {
    if (client.isOpen) await client.quit();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export const redisClient = client;
