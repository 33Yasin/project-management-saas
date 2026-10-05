import { prisma } from '../src/lib/db/prisma';

async function main() {
  console.log('Cleaning mock data from PostgreSQL database...');

  // Delete in order to satisfy FK constraints or using transaction
  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log('Successfully wiped all mock workspaces, projects, tasks, comments, members, sessions, and users!');
}

main()
  .catch((err) => {
    console.error('Error cleaning database:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
