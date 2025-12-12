import { setupMcpServer } from './mcp';
import { getAuthClient, setupAuthRoutes } from './auth';
import express from 'express';
import cors from 'cors';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const startAuthServer = async () => {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(cors());
  setupAuthRoutes(app);

  return new Promise<void>((resolve) => {
    app.listen(PORT, async () => {
      const url = `http://localhost:${PORT}/auth/login`;
      console.error(`Auth Server is running on port ${PORT}`);
      console.error(`Opening browser: ${url}`);
      await open(url);
      resolve();
    });
  });
};

const main = async () => {
  try {
    // Check if we have valid credentials
    getAuthClient();
  } catch (error) {
    // If auth fails, start the auth server
    console.error("Authentication required. Starting auth server...");
    // We don't await this because we want to start the MCP server concurrently
    startAuthServer().catch(err => console.error("Failed to start auth server:", err));
  }

  // Always start MCP Server (Stdio)
  setupMcpServer().catch(console.error);
};

main();
