import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type UserListFilter } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export const getAllUsers = async (filter?: UserListFilter): Promise<User[]> => {
  try {
    // Handle zero limit case early
    if (filter?.limit !== undefined && filter.limit === 0) {
      return [];
    }

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Apply filters if provided
    if (filter) {
      if (filter.membership_status) {
        conditions.push(eq(usersTable.membership_status, filter.membership_status));
      }

      if (filter.provinsi) {
        conditions.push(eq(usersTable.provinsi, filter.provinsi));
      }

      if (filter.jenis_keanggotaan) {
        conditions.push(eq(usersTable.jenis_keanggotaan, filter.jenis_keanggotaan));
      }
    }

    // Build query step by step with type assertions
    let query: any = db.select().from(usersTable);
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition);
    }
    
    if (filter?.limit !== undefined && filter.limit > 0) {
      query = query.limit(filter.limit);
    }
    
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset);
    }

    const results = await query.execute();
    return results;

  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
};