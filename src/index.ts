import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupMcpServer } from './mcp';
import { setupAuthRoutes } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// app.use(express.json()); // Conflict with MCP SDK stream reading

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Setup Auth Routes
setupAuthRoutes(app);

// Setup MCP Server (SSE)
setupMcpServer(app);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
