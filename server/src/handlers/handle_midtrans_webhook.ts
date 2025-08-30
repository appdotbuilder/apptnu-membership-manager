import { db } from '../db';
import { paymentsTable, usersTable } from '../db/schema';
import { type MidtransWebhook, type Payment } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const handleMidtransWebhook = async (input: MidtransWebhook): Promise<Payment> => {
  try {
    // 1. Verify Midtrans signature for security
    const serverKey = process.env['MIDTRANS_SERVER_KEY'] || 'test-server-key';
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${input.order_id}${input.status_code}${input.gross_amount}${serverKey}`)
      .digest('hex');

    if (expectedSignature !== input.signature_key) {
      throw new Error('Invalid signature');
    }

    // 2. Find payment record by order_id
    const existingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.midtrans_order_id, input.order_id))
      .execute();

    if (existingPayments.length === 0) {
      throw new Error(`Payment with order_id ${input.order_id} not found`);
    }

    const existingPayment = existingPayments[0];

    // 3. Update payment status based on transaction_status
    let paymentStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending';
    
    switch (input.transaction_status) {
      case 'settlement':
      case 'capture':
        paymentStatus = 'paid';
        break;
      case 'deny':
      case 'cancel':
      case 'failure':
        paymentStatus = 'failed';
        break;
      case 'expire':
        paymentStatus = 'expired';
        break;
      default:
        paymentStatus = 'pending';
    }

    // Update payment record
    const updatedPayments = await db.update(paymentsTable)
      .set({
        midtrans_transaction_id: input.transaction_id || null,
        status: paymentStatus,
        payment_type: input.payment_type || null,
        transaction_time: input.transaction_time ? new Date(input.transaction_time) : null,
        settlement_time: input.settlement_time ? new Date(input.settlement_time) : null,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, existingPayment.id))
      .returning()
      .execute();

    const updatedPayment = updatedPayments[0];

    // 4. Update membership_status if payment is successful
    if (paymentStatus === 'paid') {
      await db.update(usersTable)
        .set({
          membership_status: 'active',
          updated_at: new Date()
        })
        .where(eq(usersTable.id, existingPayment.user_id))
        .execute();

      // Note: Steps 5, 6, 7 (WhatsApp notification, PDF generation) would be 
      // handled by separate services in a real implementation
      console.log(`Payment successful for user ${existingPayment.user_id}, order ${input.order_id}`);
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...updatedPayment,
      amount: parseFloat(updatedPayment.amount)
    };

  } catch (error) {
    console.error('Midtrans webhook processing failed:', error);
    throw error;
  }
};