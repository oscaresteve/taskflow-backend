-- CreateTable
CREATE TABLE "WorkspaceFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceFavorite_userId_idx" ON "WorkspaceFavorite"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceFavorite_workspaceId_idx" ON "WorkspaceFavorite"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceFavorite_userId_workspaceId_key" ON "WorkspaceFavorite"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "ProjectFavorite_userId_idx" ON "ProjectFavorite"("userId");

-- CreateIndex
CREATE INDEX "ProjectFavorite_projectId_idx" ON "ProjectFavorite"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFavorite_userId_projectId_key" ON "ProjectFavorite"("userId", "projectId");

-- CreateIndex
CREATE INDEX "TaskFavorite_userId_idx" ON "TaskFavorite"("userId");

-- CreateIndex
CREATE INDEX "TaskFavorite_taskId_idx" ON "TaskFavorite"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFavorite_userId_taskId_key" ON "TaskFavorite"("userId", "taskId");

-- AddForeignKey
ALTER TABLE "WorkspaceFavorite" ADD CONSTRAINT "WorkspaceFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceFavorite" ADD CONSTRAINT "WorkspaceFavorite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFavorite" ADD CONSTRAINT "ProjectFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFavorite" ADD CONSTRAINT "ProjectFavorite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFavorite" ADD CONSTRAINT "TaskFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFavorite" ADD CONSTRAINT "TaskFavorite_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
