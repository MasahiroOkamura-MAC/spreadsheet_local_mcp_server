import { google } from 'googleapis';
import { getAuthClient } from './auth';

export const getSheetData = async (url: string, sheetName?: string): Promise<string> => {
  // 1. Parse URL to get Spreadsheet ID
  // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Invalid Google Sheets URL. Could not extract Spreadsheet ID.");
  }
  const spreadsheetId = match[1];

  // 2. Get Auth Client
  const auth = getAuthClient();

  // 3. Fetch Data
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    let range = sheetName;

    // If no sheet name is provided, fetch metadata to find the first sheet's title
    if (!range) {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId
      });

      const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title;
      if (!firstSheetTitle) {
        throw new Error("No sheets found in the spreadsheet.");
      }
      range = firstSheetTitle;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range!, // Fetch the whole sheet
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return 'No data found.';
    }

    // Convert to CSV for simple text representation
    return rows.map(row => row.join(',')).join('\n');

  } catch (error: any) {
    console.error('Error fetching sheet data:', error);
    if (error.response) {
      console.error('Google API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(`Failed to fetch sheet data: ${error.message}`);
  }
};
