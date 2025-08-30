import { db } from '../db';
import { usersTable, paymentsTable, documentsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { type Document } from '../schema';
import { mkdirSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

export async function generateReceiptPdf(userId: number, paymentId: number): Promise<Document> {
  try {
    // Fetch user and payment data with join
    const results = await db.select()
      .from(paymentsTable)
      .innerJoin(usersTable, eq(paymentsTable.user_id, usersTable.id))
      .where(
        and(
          eq(paymentsTable.id, paymentId),
          eq(paymentsTable.user_id, userId),
          eq(paymentsTable.status, 'paid')
        )
      )
      .execute();

    if (results.length === 0) {
      throw new Error('Payment not found or not paid');
    }

    const result = results[0];
    const payment = result.payments;
    const user = result.users;

    // Generate unique filename and token
    const timestamp = Date.now();
    const fileName = `receipt_${userId}_${paymentId}_${timestamp}.pdf`;
    const downloadToken = crypto.randomUUID();

    // Create directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'receipts');
    mkdirSync(uploadsDir, { recursive: true });

    // Generate PDF content (simple text-based PDF for this implementation)
    const filePath = join(uploadsDir, fileName);
    const pdfContent = generateSimplePdfContent(user, {
      ...payment,
      amount: parseFloat(payment.amount) // Convert numeric field
    });
    
    writeFileSync(filePath, pdfContent);
    
    // Get file size
    const stats = statSync(filePath);
    const fileSize = stats.size;

    // Store document record in database
    const documentResult = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'receipt',
        file_name: fileName,
        file_path: `/documents/receipts/${fileName}`,
        file_size: fileSize,
        mime_type: 'application/pdf',
        download_token: downloadToken
      })
      .returning()
      .execute();

    const document = documentResult[0];

    return {
      ...document,
      // No numeric fields to convert in documents table
    };
  } catch (error) {
    console.error('Receipt PDF generation failed:', error);
    throw error;
  }
}

// Simple PDF content generator (in a real implementation, use PDFKit or similar)
function generateSimplePdfContent(
  user: typeof usersTable.$inferSelect,
  payment: { id: number; amount: number; midtrans_order_id: string; transaction_time: Date | null; settlement_time: Date | null }
): Buffer {
  const content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 800
>>
stream
BT
/F1 12 Tf
50 750 Td
(APPTNU - Receipt) Tj
0 -30 Td
(===========================) Tj
0 -30 Td
(Institution: ${user.nama_perguruan_tinggi}) Tj
0 -20 Td
(Contact Person: ${user.nama_pic}) Tj
0 -20 Td
(Email: ${user.email}) Tj
0 -20 Td
(Province: ${user.provinsi}) Tj
0 -30 Td
(Payment Details:) Tj
0 -20 Td
(Order ID: ${payment.midtrans_order_id}) Tj
0 -20 Td
(Amount: Rp ${payment.amount.toLocaleString('id-ID')}) Tj
0 -20 Td
(Payment Date: ${payment.settlement_time?.toLocaleDateString('id-ID') || 'N/A'}) Tj
0 -30 Td
(Thank you for your membership!) Tj
0 -20 Td
(Generated: ${new Date().toLocaleDateString('id-ID')}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
0000001200 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
1299
%%EOF`;

  return Buffer.from(content);
}