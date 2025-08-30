import { db } from '../db';
import { documentsTable } from '../db/schema';
import { type DocumentDownloadInput } from '../schema';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';

export async function downloadDocument(input: DocumentDownloadInput): Promise<{ filePath: string; fileName: string; mimeType: string }> {
  try {
    // Find document by download token
    const documents = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.download_token, input.token))
      .execute();

    if (documents.length === 0) {
      throw new Error('Invalid or expired download token');
    }

    const document = documents[0];

    // Check if file exists on disk
    if (!existsSync(document.file_path)) {
      throw new Error('Document file not found on disk');
    }

    // Return file information for download
    return {
      filePath: document.file_path,
      fileName: document.file_name,
      mimeType: document.mime_type || 'application/octet-stream'
    };
  } catch (error) {
    console.error('Document download failed:', error);
    throw error;
  }
}