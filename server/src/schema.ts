import { z } from 'zod';

// Enums for dropdown options
export const provinsiEnum = z.enum(['Jawa Timur', 'Jawa Barat', 'Jawa Tengah']);
export const repositoryStatusEnum = z.enum(['Belum', 'Sudah']);
export const statusAkreditasiEnum = z.enum(['Akreditasi A', 'Akreditasi B', 'Belum Akreditasi']);
export const jenisKeanggotaanEnum = z.enum(['Pendaftaran Baru', 'Perpanjangan']);
export const membershipStatusEnum = z.enum(['pending', 'active', 'expired', 'inactive']);
export const paymentStatusEnum = z.enum(['pending', 'paid', 'failed', 'expired']);
export const documentTypeEnum = z.enum(['transfer_proof', 'receipt', 'certificate']);
export const userRoleEnum = z.enum(['member', 'admin']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleEnum,
  nama_perguruan_tinggi: z.string(),
  nama_kepala_perpustakaan: z.string(),
  no_hp_kepala: z.string(),
  instansi: z.string(),
  nama_pic: z.string(),
  no_hp_pic: z.string(),
  alamat_lengkap: z.string(),
  provinsi: provinsiEnum,
  email_institusi: z.string().email(),
  url_website: z.string().url(),
  url_otomasi: z.string().url(),
  repository_status: repositoryStatusEnum,
  jumlah_koleksi: z.number().int().nonnegative(),
  status_akreditasi: statusAkreditasiEnum,
  jenis_keanggotaan: jenisKeanggotaanEnum,
  membership_status: membershipStatusEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Payment schema
export const paymentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  midtrans_order_id: z.string(),
  midtrans_transaction_id: z.string().nullable(),
  amount: z.number(),
  status: paymentStatusEnum,
  payment_type: z.string().nullable(),
  transaction_time: z.coerce.date().nullable(),
  settlement_time: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

// Document schema
export const documentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  document_type: documentTypeEnum,
  file_name: z.string(),
  file_path: z.string(),
  file_size: z.number().nullable(),
  mime_type: z.string().nullable(),
  download_token: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Document = z.infer<typeof documentSchema>;

// Input schemas for registration
export const registrationInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nama_perguruan_tinggi: z.string().min(1),
  nama_kepala_perpustakaan: z.string().min(1),
  no_hp_kepala: z.string().min(1),
  instansi: z.string().min(1),
  nama_pic: z.string().min(1),
  no_hp_pic: z.string().min(1),
  alamat_lengkap: z.string().min(1),
  provinsi: provinsiEnum,
  email_institusi: z.string().email(),
  url_website: z.string().url(),
  url_otomasi: z.string().url(),
  repository_status: repositoryStatusEnum,
  jumlah_koleksi: z.number().int().nonnegative(),
  status_akreditasi: statusAkreditasiEnum,
  jenis_keanggotaan: jenisKeanggotaanEnum
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;

// Login schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Update user schema for admin
export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  nama_perguruan_tinggi: z.string().min(1).optional(),
  nama_kepala_perpustakaan: z.string().min(1).optional(),
  no_hp_kepala: z.string().min(1).optional(),
  instansi: z.string().min(1).optional(),
  nama_pic: z.string().min(1).optional(),
  no_hp_pic: z.string().min(1).optional(),
  alamat_lengkap: z.string().min(1).optional(),
  provinsi: provinsiEnum.optional(),
  email_institusi: z.string().email().optional(),
  url_website: z.string().url().optional(),
  url_otomasi: z.string().url().optional(),
  repository_status: repositoryStatusEnum.optional(),
  jumlah_koleksi: z.number().int().nonnegative().optional(),
  status_akreditasi: statusAkreditasiEnum.optional(),
  jenis_keanggotaan: jenisKeanggotaanEnum.optional(),
  membership_status: membershipStatusEnum.optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Midtrans webhook schema
export const midtransWebhookSchema = z.object({
  order_id: z.string(),
  status_code: z.string(),
  gross_amount: z.string(),
  signature_key: z.string(),
  transaction_status: z.string(),
  transaction_id: z.string().optional(),
  payment_type: z.string().optional(),
  transaction_time: z.string().optional(),
  settlement_time: z.string().optional()
});

export type MidtransWebhook = z.infer<typeof midtransWebhookSchema>;

// File upload schema
export const fileUploadInputSchema = z.object({
  user_id: z.number(),
  document_type: documentTypeEnum,
  file_name: z.string(),
  file_path: z.string(),
  file_size: z.number().optional(),
  mime_type: z.string().optional()
});

export type FileUploadInput = z.infer<typeof fileUploadInputSchema>;

// Payment creation schema
export const createPaymentInputSchema = z.object({
  user_id: z.number(),
  amount: z.number().positive()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Document download schema
export const documentDownloadInputSchema = z.object({
  token: z.string()
});

export type DocumentDownloadInput = z.infer<typeof documentDownloadInputSchema>;

// User list filter schema for admin
export const userListFilterSchema = z.object({
  membership_status: membershipStatusEnum.optional(),
  provinsi: provinsiEnum.optional(),
  jenis_keanggotaan: jenisKeanggotaanEnum.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type UserListFilter = z.infer<typeof userListFilterSchema>;

// Additional input schemas for tRPC procedures
export const userIdInputSchema = z.object({
  userId: z.number()
});

export type UserIdInput = z.infer<typeof userIdInputSchema>;

export const generateReceiptInputSchema = z.object({
  userId: z.number(),
  paymentId: z.number()
});

export type GenerateReceiptInput = z.infer<typeof generateReceiptInputSchema>;

export const whatsappNotificationInputSchema = z.object({
  phoneNumber: z.string(),
  message: z.string()
});

export type WhatsAppNotificationInput = z.infer<typeof whatsappNotificationInputSchema>;