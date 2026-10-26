import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type Hotspot = {
  targetId: number;
  label: string;
  yaw: number; // derajat
  pitch: number; // derajat
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull().default("customer"), // admin | customer
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const tourScenes = pgTable("tour_scenes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Resort"),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  hotspots: jsonb("hotspots").$type<Hotspot[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("kamar"), // kamar | villa | meja | aula
  description: text("description").notNull().default(""),
  price: integer("price").notNull().default(0),
  capacity: integer("capacity").notNull().default(2),
  quantity: integer("quantity").notNull().default(1),
  imageUrl: text("image_url").notNull().default(""),
  facilities: jsonb("facilities").$type<string[]>().notNull().default([]),
  sceneId: integer("scene_id").references(() => tourScenes.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    arrivalTime: text("arrival_time").notNull().default(""),
    guests: integer("guests").notNull().default(1),
    qty: integer("qty").notNull().default(1),
    totalPrice: integer("total_price").notNull().default(0),
    status: text("status").notNull().default("menunggu_pembayaran"),
    notes: text("notes").notNull().default(""),
    adminNote: text("admin_note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reservations_user_idx").on(t.userId), index("reservations_unit_idx").on(t.unitId)],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    reservationId: integer("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    bank: text("bank").notNull(),
    senderName: text("sender_name").notNull(),
    amount: integer("amount").notNull(),
    paidAt: date("paid_at").notNull(),
    proofUrl: text("proof_url").notNull().default(""),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("menunggu"), // menunggu | diterima | ditolak
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payments_res_idx").on(t.reservationId)],
);
