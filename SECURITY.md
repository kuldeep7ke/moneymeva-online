# Security Policy

## Data Storage

Money Meva is a **local-first** application. All your financial data is stored in your browser's IndexedDB and localStorage. No data is transmitted to any server unless you explicitly export it or use the optional Supabase Google OAuth sign-in.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by opening an issue on GitHub or contacting the maintainers directly. Do not disclose it publicly until it has been addressed.

## Supported Versions

| Version | Supported |
|---|---|
| 5.x | ✅ |
| < 5.0 | ❌ |

## Best Practices

- Use a strong password for your local account
- Set up PIN security in Settings for sensitive operations
- Enable session auto-lock to protect data when idle
- Export backups regularly via Settings > Data Backup
- Clear browser data if using a shared device
