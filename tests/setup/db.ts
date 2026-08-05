import { beforeEach } from "vitest";
import { prisma } from "../../src/config/prisma.ts";

// Deletes in FK-dependency order so the test database starts empty before every test.
async function resetDatabase() {
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await resetDatabase();
});
