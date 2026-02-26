import type { PrismaClient as PostgresPrismaClient } from "@/generated/prisma-postgres";
import type { PrismaClient as SqlitePrismaClient } from "@/generated/prisma-sqlite";
import { prisma } from "@/persistence/db/prisma";

export interface DbContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppDbClient {
  contact: {
    findMany(args: { orderBy: { createdAt: "desc" } }): Promise<DbContact[]>;
    findUnique(args: { where: { id: string } }): Promise<DbContact | null>;
    create(args: {
      data: { name: string; email: string; phone: string };
    }): Promise<DbContact>;
    update(args: {
      where: { id: string };
      data: { name: string; email: string; phone: string };
    }): Promise<DbContact>;
    deleteMany(args: { where: { id: string } }): Promise<{ count: number }>;
  };
}

const client = prisma as unknown as SqlitePrismaClient | PostgresPrismaClient;

export const db = client as unknown as AppDbClient;
