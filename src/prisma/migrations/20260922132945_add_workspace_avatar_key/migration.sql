/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `Workspace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "logoUrl",
ADD COLUMN     "avatarKey" TEXT;
