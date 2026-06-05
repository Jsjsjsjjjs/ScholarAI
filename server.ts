import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDiscordBot } from "./src/bot/index.js";
import { adminApiRouter } from "./src/lib/admin-api.js";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy is required when the app runs behind reverse proxies (like Cloud Run or nginx)
  // to allow express-rate-limit to read IP addresses from X-Forwarded-For header accurately.
  app.set("trust proxy", 1);

  app.use(helmet({
    contentSecurityPolicy: false, // Disabling CSP for Vite HMR and dev
  }));

  // Basic CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === "production" ? ["https://your-production-app.com"] : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }));

  // Add body parsers for JSON and urlencoded data
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, 
    legacyHeaders: false, 
    message: { error: "Too many requests from this IP, please try again after 15 minutes" }
  });

  // Apply rate limiter to /api
  app.use("/api/", apiLimiter);

  // Mount Secure RBAC Admin APIs
  app.use("/api/admin", adminApiRouter);

  // Initialize Discord Bot (non-blocking to ensure rapid server startup)
  initDiscordBot().catch(error => {
    console.error("Critical error during background Discord bot initialization:", error);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
