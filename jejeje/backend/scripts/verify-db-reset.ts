import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    { Field: string; Type: string; Key: string }[]
  >`SHOW COLUMNS FROM password_reset_tokens`;
  const fieldNames = new Set(rows.map((r) => r.Field));
  const need = ['token_hash', 'requested_ip', 'user_agent', 'expires_at', 'used_at'];
  const ok = need.every((f) => fieldNames.has(f));
  if (!ok) {
    console.error('Faltan columnas', { fieldNames: [...fieldNames] });
    process.exit(1);
  }
  const [idx] = await prisma.$queryRaw<{ possible_keys: string }[]>`SHOW INDEX FROM password_reset_tokens WHERE Key_name = 'password_reset_tokens_token_hash_key'`;
  if (!idx) {
    console.error('Falta índice único en token_hash');
    process.exit(1);
  }
  console.log('OK: password_reset_tokens tiene columnas e índice único en token_hash');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
