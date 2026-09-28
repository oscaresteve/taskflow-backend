-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'COMMENT_EDITED';
ALTER TYPE "ActivityAction" ADD VALUE 'COMMENT_DELETED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'PROJECT_ARCHIVED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_DEACTIVATED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_MEMBER_INVITED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_MEMBER_ACTIVATED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_MEMBER_ROLE_CHANGED';
ALTER TYPE "ActivityAction" ADD VALUE 'WORKSPACE_MEMBER_REMOVED';

-- AlterTable
ALTER TABLE "ActivityEvent" ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ActivityEvent_workspaceId_createdAt_idx" ON "ActivityEvent"("workspaceId", "createdAt" DESC);
