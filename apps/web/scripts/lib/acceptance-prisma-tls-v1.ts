/**
 * Why the Prisma migrate path is closed, and why nothing here tries to open it.
 *
 * The canonical acceptance contract is `sslmode=verify-full`: Node's `pg` reads
 * that as "encrypt, check the chain, check the hostname", and the guard in
 * `acceptance-db-target-v1.ts` accepts nothing weaker. The migrate path does not
 * go through `pg`. It hands the URL to a Rust schema engine, and what that
 * engine does with `sslmode=verify-full` cannot be established from here:
 *
 *  - the engine binary carries quaint's `Unsupported SSL mode, defaulting to
 *    \`prefer\`` message, which would mean TLS becomes OPTIONAL on the one path
 *    that writes schema;
 *  - it also carries tokio-postgres's own parameter table and an error string
 *    that names `verify-full` as a valid value, which would mean the canonical
 *    URL is already correct;
 *  - which of the two parses this URL at runtime is decided inside the engine.
 *
 * An earlier version of this module searched the binary for parameter names and
 * treated a missing name as proof the engine lacked the parameter. That method
 * is wrong: `pgbouncer` — a parameter Prisma plainly supports, and one this
 * harness itself allows — is likewise absent from the binary as bytes, because
 * short string comparisons are compiled inline rather than into the data
 * section. Absence of bytes is not absence of support, so no capability claim
 * can be built that way.
 *
 * That leaves exactly one honest position, and it is the one this module takes:
 * **verification on the Prisma path is NOT MEASURED, so the path is closed.**
 *
 * Deliberately not done here:
 *  - No translation of the URL into `sslmode=require`. `require` encrypts
 *    without proving who answered; emitting it to buy a working migrate command
 *    would be the downgrade this whole boundary exists to prevent, and it would
 *    be worse than the status quo if the engine understands `verify-full`
 *    already.
 *  - No `sslaccept`, `rejectUnauthorized: false` or `accept_invalid_certs`
 *    fallback of any kind.
 *  - No claim that the connection is or is not verified. Only a handshake can
 *    answer that, and this module never opens one.
 *
 * Reopening the path needs a measurement this module cannot make: either an
 * observed handshake against the acceptance server, or a version-pinned
 * statement of the engine's TLS semantics. Both are decisions, not code.
 *
 * Pure module: no filesystem, no network, no process.env mutation.
 */

/** The single reason the migrate path refuses to run. */
export const PRISMA_TLS_UNAVAILABLE_REASON = "PRISMA_TLS_VERIFICATION_UNAVAILABLE";

export type PrismaTlsStatus = {
  /** Never true today: no measurement available here can establish it. */
  verificationProven: false;
  /** Why, in one line the operator can act on. */
  detail: string;
};

/**
 * The migrate path's TLS status.
 *
 * Constant by construction. It reports NOT MEASURED rather than "unsupported",
 * because the two are different claims and only the first one is true: nothing
 * here has established what the engine does, and a status must never be stronger
 * than the measurement behind it.
 */
export function prismaTlsStatus(): PrismaTlsStatus {
  return {
    verificationProven: false,
    detail:
      "the schema engine's reading of sslmode=verify-full is NOT MEASURED; " +
      "proving it needs an observed handshake, and no weaker mode is substituted",
  };
}
