import { db } from '../db';
import { paymentsTable, usersTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export async function createPayment(input: CreatePaymentInput): Promise<{ payment: Payment; redirect_url: string }> {
  try {
    // 1. Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // 2. Generate unique order ID for Midtrans
    const orderId = `ORDER-${Date.now()}-${input.user_id}`;

    // 3. Create payment record in database with 'pending' status
    const result = await db.insert(paymentsTable)
      .values({
        user_id: input.user_id,
        midtrans_order_id: orderId,
        midtrans_transaction_id: null,
        amount: input.amount.toString(), // Convert number to string for numeric column
        status: 'pending',
        payment_type: null,
        transaction_time: null,
        settlement_time: null
      })
      .returning()
      .execute();

    const paymentRecord = result[0];

    // 4. Prepare Midtrans Snap API request
    const snapTransaction = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(input.amount) // Midtrans expects integer
      },
      customer_details: {
        email: users[0].email,
        first_name: users[0].nama_pic,
        phone: users[0].no_hp_pic
      },
      item_details: [{
        id: 'membership',
        price: Math.round(input.amount),
        quantity: 1,
        name: `Membership - ${users[0].nama_perguruan_tinggi}`
      }]
    };

    // 5. Call Midtrans Snap API to create payment token
    const midtransServerKey = process.env['MIDTRANS_SERVER_KEY'];
    const midtransUrl = process.env['MIDTRANS_ENVIRONMENT'] === 'production' 
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    if (!midtransServerKey) {
      throw new Error('Midtrans server key not configured');
    }

    const response = await fetch(midtransUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(midtransServerKey + ':').toString('base64')}`
      },
      body: JSON.stringify(snapTransaction)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Midtrans API error:', errorData);
      throw new Error(`Midtrans API error: ${response.status} ${response.statusText}`);
    }

    const snapResponse = await response.json() as { redirect_url: string; token: string };

    // 6. Return payment data and Midtrans redirect URL
    const payment: Payment = {
      ...paymentRecord,
      amount: parseFloat(paymentRecord.amount) // Convert string back to number
    };

    return {
      payment,
      redirect_url: snapResponse.redirect_url
    };

  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}