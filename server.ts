import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDiscordBot } from "./src/bot/index.js";
import { adminApiRouter } from "./src/lib/admin-api.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add body parsers for JSON and urlencoded data
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
