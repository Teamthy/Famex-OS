# Famex Super Admin: secure bootstrap and operational limits

Famex is a **single-school product**. Super Admin is an out-of-band operator for this Famex installation, not an EDUos or cross-school role. The account has the in-school ADMIN permission set, the separate DevOps workspace, and mandatory MFA. It is never created by school staff invitations, role-edit screens, or a public API.

## First-time bootstrap

1. Confirm this is the intended Famex database and that its migrations are current. Keep `DATABASE_URL` and `MFA_ENCRYPTION_KEY` in the operator's secret manager; do not put secrets in chat, source control, CI logs, or deployment logs. Use a dedicated MFA key of at least 32 characters.
2. On a secured operator workstation with repository dependencies installed, run the one-time CLI with explicit email/name, exact confirmation, and a private absolute output path **outside the repository**:

   ```sh
   SUPER_ADMIN_BOOTSTRAP_CONFIRM=CREATE_INITIAL_FAMEX_SUPER_ADMIN \
   SUPER_ADMIN_EMAIL='operator@example.com' \
   SUPER_ADMIN_NAME='Famex Platform Operator' \
   SUPER_ADMIN_BOOTSTRAP_OUTPUT='/tmp/famex-super-admin-setup.json' \
   DATABASE_URL="$DATABASE_URL" \
   MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY" \
   npm run db:bootstrap-super-admin
   ```

   The CLI only uses the school selected by `SCHOOL_SLUG` (default Famex slug). It refuses an absent/inactive school, an email already used in that school, or any existing Super Admin. A PostgreSQL advisory transaction lock protects against concurrent first-run attempts. It creates the role, random temporary password, already-enabled encrypted TOTP, hashed single-use recovery codes, forced password rotation, and an audit record atomically. It emits no credential material to stdout.
3. Securely transfer the setup file to the named operator, scan the TOTP URI/secret into an authenticator, change the temporary password at first sign-in, and keep recovery codes offline. Delete the setup file and verify that its secure temporary storage is cleared. Do not email or ticket the bundle.
4. If the setup file is unavailable after a successful DB transaction, **do not** rerun bootstrap or delete audit history. Suspend the operator and revoke sessions via the separately reviewed database-operator recovery procedure. There is deliberately no public account-recovery or MFA-disable endpoint for this role.

The one-time file is mode `0600`; choose a private filesystem, avoid shell tracing, and do not back it up to a shared or cloud-synced directory. The bootstrap command is not a deployment hook. Never point it at production from CI. The CI verification uses synthetic credentials and an isolated, disposable Postgres service only.

## Authentication and permissions

- Password login for a Super Admin without both `mfaEnabled` and an encrypted TOTP seed is denied and audited; no session cookie is issued.
- Correct password returns only a short-lived MFA challenge. TOTP or a single-use recovery code is required before a full session is minted.
- Current-session checks also fail closed if MFA is missing in the database, and web settings cannot disable Super Admin MFA.
- The role remains excluded from school staff provisioning. Do not add impersonation, school switching, or cross-school access.

## Available DevOps action

The dashboard presents school-scoped aggregate/deployment metadata and a redacted list of failed notification job identifiers, channel/kind and attempt counts. It does not return recipients, message bodies, or raw provider errors. A Super Admin may manually requeue one FAILED notification after choosing a reason. The conditional FAILED→PENDING transition and audit event commit together; a repeated/racing request cannot queue it twice. The dispatch worker performs the actual delivery. This is the only current mutating DevOps control; do not describe the page as a full deployment-control plane.

## Verification

CI applies the forward-only enum migration against clean Postgres, invokes the actual bootstrap CLI against synthetic data, verifies the encrypted MFA/recovery-code/audit state and duplicate-bootstrap refusal, and runs the real-Postgres grading verifier. Browser E2E additionally tests password→TOTP→session, protected MFA settings, the redacted overview, an audited single retry, an offline exam replay through server grading, and a released report card loaded/printed from stored server data.
