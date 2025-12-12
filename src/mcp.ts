// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { getSheetData } from './sheets';

export const setupMcpServer = async () => {

  // Create a new MCP server instance
  const server = new McpServer({
    name: "Google Sheets Local MCP",
    version: "1.0.0"
  });

  // Define the tool
  const toolSchema = {
    url: z.string().url().describe("The URL of the Google Spreadsheet to fetch data from."),
    sheetName: z.string().optional().describe("The name of the sheet to fetch data from. If omitted, the first sheet will be used."),
  };

  // @ts-ignore
  server.tool(
    "get_data",
    "Fetch data from a Google Spreadsheet URL",
    toolSchema,
    async (args: { url: string; sheetName?: string }) => {
      const { url, sheetName } = args;
      try {
        const data = await getSheetData(url, sheetName);
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

  // Connect to stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // console.error("Local MCP Server running on stdio");
};
