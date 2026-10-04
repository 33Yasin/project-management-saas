# Team Project Management SaaS

Takımların workspace oluşturarak projelerini, görevlerini ve yorumlarını yönettiği web tabanlı SaaS uygulaması.

## Tech Stack

**Frontend:** React + TypeScript + Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS + shadcn/ui

**Backend:** Node.js + TypeScript + Express, Prisma ORM, PostgreSQL, express-session

## Getting Started

### Prerequisites

- Node.js (LTS)
- PostgreSQL
- npm

### Server

```bash
cd server
npm install
cp .env.example .env   # Düzenle
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## Project Structure

```
project-management-saas/
├── client/          # React frontend
├── server/          # Express backend
├── docs/            # Documentation
├── README.md
├── AI_PROJECT_GUIDE.md
└── .gitignore
```
