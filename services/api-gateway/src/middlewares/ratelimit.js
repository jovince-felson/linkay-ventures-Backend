import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    // Key by IP + authenticated user ID so users on a shared IP (office NAT, same
    // proxy) each get their own 1000-req budget instead of sharing one counter.
    keyGenerator: (req) => {
        const userId = req.headers["x-user-id"] || "";
        return `gateway:${req.ip}:${userId}`;
    },
    message: {
        success: false,
        message: "Too many requests, please try later"
    },
    standardHeaders: true,
    legacyHeaders: false
});





// import rateLimit from "express-rate-limit";

// export const apiLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 1000,
//     message: {
//         success: false,
//         message: "Too many requests, please try later"
//     },
//     standardHeaders: true,
//     legacyHeaders: false
// });