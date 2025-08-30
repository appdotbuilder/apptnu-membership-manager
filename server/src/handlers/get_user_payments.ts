import { db } from '../db';
import { paymentsTable } from '../db/schema';
import { type Payment } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserPayments = async (userId: number): Promise<Payment[]> => {
  try {
    // Fetch all payment records for the specific user
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId))
      .orderBy(desc(paymentsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch user payments:', error);
    throw error;
  }
};