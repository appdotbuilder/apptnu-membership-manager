import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserProfile = async (userId: number): Promise<User> => {
  try {
    // Query user by ID
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (result.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Return the user data - the schema already omits sensitive fields for the API response
    const user = result[0];
    return {
      ...user,
      // No numeric conversions needed as all fields are already in correct types
      // jumlah_koleksi is integer, not numeric in the schema
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
};