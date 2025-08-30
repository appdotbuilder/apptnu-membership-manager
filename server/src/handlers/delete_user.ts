import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deleteUser = async (userId: number): Promise<{ success: boolean }> => {
  try {
    // Check if user exists before attempting to delete
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Delete user record - related payments and documents will be cascade deleted
    // due to foreign key constraints with onDelete: 'cascade'
    const result = await db.delete(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
};