import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'prisma', 'schema.prisma'),
  datasourceUrl: 'file:./dev.db',
  migrate: {
    async resolve() {
      return { url: 'file:./dev.db' };
    },
  },
});
