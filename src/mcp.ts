// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { getSheetData } from './sheets';
import { getDriveFile } from './drive';

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
        let data;
        if (url.includes('/file/d/')) {
          // It's explicitly a Drive file URL
          data = await getDriveFile(url, sheetName);
        } else {
          // Try as a Google Sheet first
          try {
            data = await getSheetData(url, sheetName);
          } catch (error: any) {
            // Check for the specific error indicating it's an Excel file in Office Editing mode
            if (error.message && error.message.includes("This operation is not supported for this document")) {
              console.error("Detected Excel file in Office Editing mode. Falling back to Drive API.");
              data = await getDriveFile(url, sheetName);
            } else {
              throw error; // Re-throw other errors
            }
          }
        }

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
