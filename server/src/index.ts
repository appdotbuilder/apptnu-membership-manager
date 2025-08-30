import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  registrationInputSchema,
  loginInputSchema,
  updateUserInputSchema,
  createPaymentInputSchema,
  midtransWebhookSchema,
  fileUploadInputSchema,
  documentDownloadInputSchema,
  userListFilterSchema,
  userIdInputSchema,
  generateReceiptInputSchema,
  whatsappNotificationInputSchema
} from './schema';
import { z } from 'zod';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { getUserProfile } from './handlers/get_user_profile';
import { getAllUsers } from './handlers/get_all_users';
import { updateUser } from './handlers/update_user';
import { deleteUser } from './handlers/delete_user';
import { createPayment } from './handlers/create_payment';
import { handleMidtransWebhook } from './handlers/handle_midtrans_webhook';
import { getUserPayments } from './handlers/get_user_payments';
import { getAllPayments } from './handlers/get_all_payments';
import { uploadDocument } from './handlers/upload_document';
import { generateReceiptPdf } from './handlers/generate_receipt_pdf';
import { generateCertificatePdf } from './handlers/generate_certificate_pdf';
import { downloadDocument } from './handlers/download_document';
import { getUserDocuments } from './handlers/get_user_documents';
import { sendWhatsAppNotification } from './handlers/send_whatsapp_notification';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User registration and authentication
  register: publicProcedure
    .input(registrationInputSchema)
    .mutation(({ input }) => registerUser(input)),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // User profile management
  getUserProfile: publicProcedure
    .input(userIdInputSchema)
    .query(({ input }) => getUserProfile(input.userId)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  // Admin user management
  getAllUsers: publicProcedure
    .input(userListFilterSchema.optional())
    .query(({ input }) => getAllUsers(input)),

  deleteUser: publicProcedure
    .input(userIdInputSchema)
    .mutation(({ input }) => deleteUser(input.userId)),

  // Payment management
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input)),

  handleMidtransWebhook: publicProcedure
    .input(midtransWebhookSchema)
    .mutation(({ input }) => handleMidtransWebhook(input)),

  getUserPayments: publicProcedure
    .input(userIdInputSchema)
    .query(({ input }) => getUserPayments(input.userId)),

  getAllPayments: publicProcedure
    .query(() => getAllPayments()),

  // Document management
  uploadDocument: publicProcedure
    .input(fileUploadInputSchema)
    .mutation(({ input }) => uploadDocument(input)),

  generateReceipt: publicProcedure
    .input(generateReceiptInputSchema)
    .mutation(({ input }) => generateReceiptPdf(input.userId, input.paymentId)),

  generateCertificate: publicProcedure
    .input(userIdInputSchema)
    .mutation(({ input }) => generateCertificatePdf(input.userId)),

  downloadDocument: publicProcedure
    .input(documentDownloadInputSchema)
    .query(({ input }) => downloadDocument(input)),

  getUserDocuments: publicProcedure
    .input(userIdInputSchema)
    .query(({ input }) => getUserDocuments(input.userId)),

  // WhatsApp notifications
  sendWhatsAppNotification: publicProcedure
    .input(whatsappNotificationInputSchema)
    .mutation(({ input }) => sendWhatsAppNotification(input.phoneNumber, input.message)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`APPTNU Membership Management Server listening at port: ${port}`);
}

start();