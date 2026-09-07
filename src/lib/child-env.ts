import "server-only";

/**
 * The environment a spawned child is allowed to see.
 *
 * Node's default is to hand a child `process.env` entire. For this application
 * that meant the storefront's build, the server it starts, and the Playwright
 * run all inherited Parikshan's own credentials: the Neon connection string
 * and password, the token-encryption key, the Clerk secret, the Browser Use
 * key, a Vercel OIDC token. None of them are needed to build a web page or
 * drive a browser, and one malicious postinstall script in an imported
 * repository is all it would take to read them.
 *
 * So the child gets an allowlist rather than an inheritance. The list holds
 * what a process needs to *be a process* on this machine - where to find
 * binaries, where its home and temp directories are, what locale to use - and
 * nothing about what Parikshan is connected to.
 *
 * An allowlist fails closed: a variable nobody thought of is absent rather
 * than leaked, and the failure is a build that cannot find something, which is
 * visible. A denylist fails open, and its failure is silent.
 */

/**
 * Present for the child to run at all.
 *
 * HOME earns its place twice over: npm caches under it, and Playwright finds
 * its browsers there (~/Library/Caches/ms-playwright). Dropping it does not
 * fail loudly - it re-downloads Chromium, or cannot find it.
 */
const BASE_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "TERM",
  // Windows needs these to spawn anything at all.
  "SystemRoot",
  "COMSPEC",
  "PATHEXT",
] as const;

/**
 * Refused even if something adds them to the allowlist later.
 *
 * The allowlist above is the actual control; this is a second latch on the
 * same door. It exists because the list will be edited by someone in a hurry
 * who needs "just one more variable" to make a build work, and the cost of
 * being wrong is a leaked credential rather than a failed build.
 */
const NEVER = /(SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|_KEY$|^KEY$|API_?KEY|DATABASE_URL|POSTGRES|^PG[A-Z]|NEON|CLERK|OIDC|SESSION)/i;

/**
 * Environment for a spawned child: the base set, plus whatever the caller
 * declares it needs.
 *
 * Explicit values win over the base set, so a caller can pin NODE_ENV or pass
 * a BASE_URL. They are still checked against NEVER - passing a secret has to
 * be a deliberate change to this file, not an argument at a call site.
 */
export function childEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  // NODE_ENV is always set. A child that inherits nothing still has to be told
  // which mode to run in, and leaving it undefined makes a Node build behave
  // as though it were development.
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV ?? "production" };

  for (const key of BASE_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    if (NEVER.test(key)) {
      // Silently dropping it would produce a build that fails for reasons
      // nobody can see. This is a programming error, so it says so.
      throw new Error(
        `Refusing to pass "${key}" to a child process: it matches the pattern for a credential. ` +
          `If a child genuinely needs it, that belongs in the project's own declared configuration, not in Parikshan's environment.`,
      );
    }
    env[key] = value;
  }

  return env;
}

/** Exported for the test that proves the scrub actually holds. */
export const CHILD_ENV_INTERNALS = { BASE_KEYS, NEVER };
