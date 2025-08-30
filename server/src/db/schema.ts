import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  pgEnum,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const provinsiEnum = pgEnum('provinsi', ['Jawa Timur', 'Jawa Barat', 'Jawa Tengah']);
export const repositoryStatusEnum = pgEnum('repository_status', ['Belum', 'Sudah']);
export const statusAkreditasiEnum = pgEnum('status_akreditasi', ['Akreditasi A', 'Akreditasi B', 'Belum Akreditasi']);
export const jenisKeanggotaanEnum = pgEnum('jenis_keanggotaan', ['Pendaftaran Baru', 'Perpanjangan']);
export const membershipStatusEnum = pgEnum('membership_status', ['pending', 'active', 'expired', 'inactive']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'expired']);
export const documentTypeEnum = pgEnum('document_type', ['transfer_proof', 'receipt', 'certificate']);
export const userRoleEnum = pgEnum('user_role', ['member', 'admin']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('member'),
  nama_perguruan_tinggi: text('nama_perguruan_tinggi').notNull(),
  nama_kepala_perpustakaan: text('nama_kepala_perpustakaan').notNull(),
  no_hp_kepala: varchar('no_hp_kepala', { length: 20 }).notNull(),
  instansi: text('instansi').notNull(),
  nama_pic: text('nama_pic').notNull(),
  no_hp_pic: varchar('no_hp_pic', { length: 20 }).notNull(),
  alamat_lengkap: text('alamat_lengkap').notNull(),
  provinsi: provinsiEnum('provinsi').notNull(),
  email_institusi: varchar('email_institusi', { length: 255 }).notNull(),
  url_website: text('url_website').notNull(),
  url_otomasi: text('url_otomasi').notNull(),
  repository_status: repositoryStatusEnum('repository_status').notNull(),
  jumlah_koleksi: integer('jumlah_koleksi').notNull(),
  status_akreditasi: statusAkreditasiEnum('status_akreditasi').notNull(),
  jenis_keanggotaan: jenisKeanggotaanEnum('jenis_keanggotaan').notNull(),
  membership_status: membershipStatusEnum('membership_status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  midtrans_order_id: varchar('midtrans_order_id', { length: 255 }).notNull().unique(),
  midtrans_transaction_id: varchar('midtrans_transaction_id', { length: 255 }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  payment_type: varchar('payment_type', { length: 100 }),
  transaction_time: timestamp('transaction_time'),
  settlement_time: timestamp('settlement_time'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Documents table
export const documentsTable = pgTable('documents', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  document_type: documentTypeEnum('document_type').notNull(),
  file_name: varchar('file_name', { length: 255 }).notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'),
  mime_type: varchar('mime_type', { length: 100 }),
  download_token: varchar('download_token', { length: 255 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  payments: many(paymentsTable),
  documents: many(documentsTable),
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [paymentsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const documentsRelations = relations(documentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [documentsTable.user_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;
export type Document = typeof documentsTable.$inferSelect;
export type NewDocument = typeof documentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  payments: paymentsTable,
  documents: documentsTable,
};

export const schema = {
  ...tables,
  usersRelations,
  paymentsRelations,
  documentsRelations,
};