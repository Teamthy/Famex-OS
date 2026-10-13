# Admin & Super Admin access

Credentials are **not stored in git**. They live in your local/host `.env` and are applied by seed scripts.

## School admin
```powershell
npm run db:seed-admin
```
Env vars:
- `INITIAL_ADMIN_EMAIL` (example in `.env.example`: `admin@ykaycollege.com`)
- `INITIAL_ADMIN_PASSWORD` (you choose — min 12 chars)
- `INITIAL_ADMIN_NAME`

Sign in: `/login` → `/admin`

## Super admin
```powershell
npm run db:seed-super-admin
```
Env vars:
- `SUPER_ADMIN_EMAIL` (default `developer@ykaycollege.com`)
- `SUPER_ADMIN_PASSWORD` (optional; if empty, a strong password is printed **once**)
- `SUPER_ADMIN_NAME`

Sign in: `/login` → `/super-admin`

## Retrieve on your PC
Open:
`C:\Users\USER\Desktop\PROJECTS\ykay_edu\envoys-site\.env`

Look for `INITIAL_ADMIN_*` and `SUPER_ADMIN_*`.  
If the password was generated and lost, set a new `SUPER_ADMIN_PASSWORD` / `INITIAL_ADMIN_PASSWORD` and re-run the seed, or use Super Admin → **Reset Password** / **Create staff / admin**.
