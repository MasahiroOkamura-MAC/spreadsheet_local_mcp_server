import { setupMcpServer } from './mcp';
import { getAuthClient, setupAuthRoutes } from './auth';
import express from 'express';
import cors from 'cors';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../debug.log');
const log = (msg: string) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);

const startAuthServer = async () => {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(cors());
  setupAuthRoutes(app);

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, async () => {
      const url = `http://localhost:${PORT}/auth/login`;
      log(`Auth Server is running on port ${PORT}`);
      log(`Opening browser: ${url}`);
      console.error(`Auth Server is running on port ${PORT}`);
      console.error(`Opening browser: ${url}`);
      try {
        await open(url);
        log('Browser opened successfully');
      } catch (e: any) {
        log(`Failed to open browser: ${e.message}`);
      }
      resolve();
    });
    server.on('error', (e) => {
      log(`Server error: ${e.message}`);
      reject(e);
    });
  });
};

const main = async () => {
  log('Starting MCP Server...');
  try {
    // Check if we have valid credentials
    getAuthClient();
    log('Credentials found.');
  } catch (error) {
    // If auth fails, start the auth server
    log("Authentication required. Starting auth server...");
    console.error("Authentication required. Starting auth server...");
    // We don't await this because we want to start the MCP server concurrently
    startAuthServer().catch(err => {
      log(`Failed to start auth server: ${err.message}`);
      console.error("Failed to start auth server:", err);
    });
  }

  // Always start MCP Server (Stdio)
  setupMcpServer().catch(err => {
    log(`MCP Server error: ${err.message}`);
    console.error(err);
  });
};

main();
