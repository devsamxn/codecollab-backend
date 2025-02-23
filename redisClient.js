import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
  console.error(
    "❌ Missing Redis environment variables. Make sure UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN are set."
  );
  process.exit(1); // Prevents app from running without Redis
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Test connection
(async () => {
  try {
    await redis.set("test", "Hello from Railway!");
    console.log("✅ Redis Connected Successfully! Test value set.");
  } catch (error) {
    console.error("❌ Redis Connection Failed:", error);
  }
})();

export default redis;
