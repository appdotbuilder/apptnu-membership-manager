import { db } from '../db';
import { documentsTable } from '../db/schema';
import { type Document } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserDocuments = async (userId: number): Promise<Document[]> => {
  try {
    // Fetch all documents for the specific user, ordered by newest first
    const results = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.user_id, userId))
      .orderBy(desc(documentsTable.created_at))
      .execute();

    // Return documents (no numeric conversion needed as no numeric fields)
    return results;
  } catch (error) {
    console.error('Failed to fetch user documents:', error);
    throw error;
  }
};