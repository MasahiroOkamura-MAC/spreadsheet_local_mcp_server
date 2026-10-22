import { setupMcpServer } from './mcp';
import { getAuthClient, setupAuthRoutes } from './auth';
import express from 'express';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../debug.log');
const log = (msg: string) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);

const startAuthServer = async () => {
  const app = express();
  const PORT = Number(process.env.PORT || 8080);

  setupAuthRoutes(app);

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1', async () => {
      const url = `http://localhost:${PORT}/auth/login`;
      log(`Auth Server is running on port ${PORT}`);
      log(`Opening browser: ${url}`);
      console.error(`Auth Server is running on port ${PORT}`);
      console.error(`Opening browser: ${url}`);
      try {
        await open(url);
        log('Browser opened successfully');
      } catch (e: any) {
        log('Server operation failed');
      }
      resolve();
    });
    server.on('error', (e) => {
      log('Server operation failed');
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
      log('Server operation failed');
      console.error("Failed to start auth server");
    });
  }

  // Always start MCP Server (Stdio)
  setupMcpServer().catch(err => {
    log('Server operation failed');
    console.error("MCP server failed");
  });
};

main();
