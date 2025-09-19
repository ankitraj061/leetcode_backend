import { redisClient } from "../config/redis.js";

const submitCodeWaitingTimeMiddleware = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const redisKey = `submit_cooldown:${userId}`;

    // check if cooldown exists
    const exists = await redisClient.exists(redisKey);
    if (exists) {
      return res
        .status(429)
        .json({ error: "Please wait 10 seconds before submitting again." });
    }

    // set cooldown period (10 seconds)
    await redisClient.set(redisKey, "cooldown_active", {
      EX: 10, // expiry 10 seconds
      NX: true, // only set if not already exists
    });

    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default submitCodeWaitingTimeMiddleware;
