import { google } from "googleapis";
import path from "node:path";
import { env } from "../config/environment";

export interface GoogleSheetsService {
  appendUser: (entries: string[][]) => Promise<void>;
}

const sheetsScopes = ["https://www.googleapis.com/auth/spreadsheets"];

const createEnvCredentialClient = async () => {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return null;
  }

  try {
    const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: sheetsScopes,
    });
    return google.sheets({ version: "v4", auth });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown environment auth error";
    console.error(`Environment credential auth failed: ${message}`);
    return null;
  }
};

const createFileCredentialClient = async () => {
  try {
    const keyFile = path.join(
      process.cwd(),
      "credentials",
      "sweetflips-7086906ae249.json"
    );
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: sheetsScopes,
    });
    return google.sheets({ version: "v4", auth });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown file auth error";
    console.error(`File-based Google auth failed: ${message}`);
    return null;
  }
};

export const createGoogleSheetsService =
  async (): Promise<GoogleSheetsService | null> => {
    if (!env.GOOGLE_SPREADSHEET_ID) {
      return null;
    }

    const client =
      (await createEnvCredentialClient()) ??
      (await createFileCredentialClient());

    if (!client) {
      return null;
    }

    const appendUser = async (entries: string[][]) => {
      await client.spreadsheets.values.append({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        range: "Sheet1!A:C",
        valueInputOption: "RAW",
        requestBody: { values: entries },
      });
    };

    return { appendUser };
  };
