import { google } from 'googleapis';
import { getAuthClient } from './auth';
import * as XLSX from 'xlsx';

export const getDriveFile = async (url: string, sheetName?: string): Promise<string> => {
  // 1. Extract File ID from URL
  // Format: https://docs.google.com/spreadsheets/d/FILE_ID/edit... or https://drive.google.com/file/d/FILE_ID/view...
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Invalid Google Drive URL. Could not extract File ID.");
  }
  const fileId = match[1];

  // 2. Get Auth Client
  const auth = getAuthClient();

  // 3. Download File
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });

    const buffer = Buffer.from(response.data as ArrayBuffer);

    // 4. Parse Excel File
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // 5. Determine which sheet to read
    let targetSheetName = sheetName;
    if (!targetSheetName) {
      if (workbook.SheetNames.length === 0) {
        throw new Error("No sheets found in the Excel file.");
      }
      targetSheetName = workbook.SheetNames[0];
    }

    // 6. Get the sheet
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
      throw new Error(`Sheet "${targetSheetName}" not found in the file.`);
    }

    // 7. Convert to CSV
    const csvData = XLSX.utils.sheet_to_csv(sheet);

    if (!csvData || csvData.trim().length === 0) {
      return 'No data found.';
    }

    return csvData;

  } catch (error: any) {
    console.error('Error fetching Drive file:', error);
    throw new Error(`Failed to fetch Drive file: ${error.message}`);
  }
};
