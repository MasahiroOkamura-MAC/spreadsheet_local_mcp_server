// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getSheetData } from './sheets';

// Store active transports to route POST messages
// Map<sessionId, transport>
const transports = new Map<string, SSEServerTransport>();

export const setupMcpServer = (app: express.Application) => {

  // SSE Endpoint
  app.get('/sse', async (req: Request, res: Response) => {
    const sessionId = req.query.session_id as string;

    if (!sessionId) {
      res.status(401).send("Missing session_id");
      return;
    }

    // Create a new MCP server instance for this session
    // This allows us to close over the sessionId for the tools
    const server = new McpServer({
      name: "Google Sheets Remote MCP",
      version: "1.0.0"
    });

    // Define the tool with access to sessionId
    const toolSchema = {
      url: z.string().url().describe("The URL of the Google Spreadsheet to fetch data from."),
    };

    // @ts-ignore
    server.tool(
      "get_data",
      toolSchema,
      async (args: { url: string }) => {
        const { url } = args;
        try {
          const data = await getSheetData(url, sessionId);
          return {
            content: [{ type: "text" as const, text: data }]
          };
        } catch (error: any) {
          return {
            content: [{ type: "text" as const, text: `Error fetching data: ${error.message}` }],
            isError: true
          };
        }
      }
    );

    // Create transport
    // The client will post messages to /messages?session_id=...
    const transport = new SSEServerTransport(`/messages?session_id=${sessionId}`, res);

    // Store transport for the POST handler
    transports.set(sessionId, transport);

    // Clean up on close
    res.on('close', () => {
      transports.delete(sessionId);
      // console.log(`Session ${sessionId} closed`);
    });

    await server.connect(transport);
  });

  // Message Endpoint
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.session_id as string;
    console.log(`[POST /messages] Received message for session: ${sessionId}`);

    if (!sessionId) {
      res.status(400).send("Missing session_id");
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      console.log(`[POST /messages] Session not found or inactive: ${sessionId}`);
      res.status(404).send("Session not found or inactive");
      return;
    }

    console.log(`[POST /messages] Handling message for session: ${sessionId}`);
    await transport.handlePostMessage(req, res);
  });
};
