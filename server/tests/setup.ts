import prisma, { pool } from '../src/lib/db/prisma';

export async function clearDatabase() {
  // Clear tables in reverse dependency order
  await prisma.session.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

export async function teardown() {
  await clearDatabase();
  await prisma.$disconnect();
  await pool.end();
}
