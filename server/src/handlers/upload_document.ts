import { db } from '../db';
import { documentsTable, usersTable } from '../db/schema';
import { type FileUploadInput, type Document } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function uploadDocument(input: FileUploadInput): Promise<Document> {
  try {
    // Validate that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Generate secure download token
    const downloadToken = crypto.randomBytes(32).toString('hex');

    // Insert document record
    const result = await db.insert(documentsTable)
      .values({
        user_id: input.user_id,
        document_type: input.document_type,
        file_name: input.file_name,
        file_path: input.file_path,
        file_size: input.file_size || null,
        mime_type: input.mime_type || null,
        download_token: downloadToken
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Document upload failed:', error);
    throw error;
  }
}