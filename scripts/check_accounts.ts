import { db } from '../src/lib/db';

async function main() {
  const accounts = await db.account.findMany();
  console.log(`Cuentas en DB: ${accounts.length}`);
  for (const a of accounts) {
    console.log(`ID: ${a.id} | Provider: ${a.provider} | UserID: ${a.userId} | Expires: ${a.expires_at} | Token preview: ${a.access_token?.slice(0, 30)}...`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
