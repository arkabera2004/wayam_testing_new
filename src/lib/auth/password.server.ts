import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Computed once at module load so a login attempt against a nonexistent
// email still runs a real bcrypt compare instead of short-circuiting —
// otherwise the response-time difference would let an attacker enumerate
// which emails have accounts.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(
  hash: string | null | undefined,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_PASSWORD_HASH);
}
