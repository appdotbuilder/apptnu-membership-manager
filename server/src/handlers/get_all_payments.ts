import { db } from '../db';
import { paymentsTable } from '../db/schema';
import { type Payment } from '../schema';
import { desc } from 'drizzle-orm';

export const getAllPayments = async (): Promise<Payment[]> => {
  try {
    // Fetch all payments ordered by created_at descending (newest first)
    const results = await db.select()
      .from(paymentsTable)
      .orderBy(desc(paymentsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers for all payments
    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to get all payments:', error);
    throw error;
  }
};