-- DropIndex
DROP INDEX "ActivityEvent_workspaceId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_readAt_createdAt_idx";

-- CreateIndex
CREATE INDEX "ActivityEvent_workspaceId_taskId_createdAt_idx" ON "ActivityEvent"("workspaceId", "taskId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
