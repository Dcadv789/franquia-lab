import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const studies = sqliteTable('studies', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
