# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.0   | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately.

### How to Report

Do not open a public issue. Instead, send an email to the project maintainers or use GitHub's private vulnerability reporting feature:

1. Go to the [Security Advisories](https://github.com/your-username/bug-free-octo-sniffle-main/security/advisories) page
2. Click "Report a vulnerability"
3. Fill in the details

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if known)

### Response Time

We will respond within 48 hours and provide regular updates on the status of the vulnerability.

## Security Best Practices

### Environment Variables

Never commit `.env` files to the repository. Use `.env.example` as a template.

Required environment variables:
- `PORT` - Server port
- `DB_FILE` - Database file path (SQLite)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (optional)
- `DATABASE_URL` or `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database credentials

### Database Security

- Use strong passwords for database connections
- Enable SSL for PostgreSQL connections when possible (`DB_SSL=true`)
- Limit database user permissions to minimum required
- Regularly backup the database

### API Security

- Rate limiting is enabled via `express-rate-limit`
- Helmet middleware is enabled for security headers
- Validate all user inputs using Joi
- Never expose sensitive data in API responses

### Dependencies

- Regularly update dependencies with `npm update`
- Run `npm audit` to check for vulnerabilities
- Review security advisories for used packages

### Deployment

- Use HTTPS in production
- Keep the server and dependencies updated
- Monitor logs for suspicious activity
- Use environment-specific configurations

## Known Security Considerations

- The project currently uses a temporary user identification system (UUID) for Android devices
- No authentication system is currently implemented (planned for future releases)
- Telegram bot token should be kept secure
- Render API key should be stored as a GitHub Secret

## Future Security Improvements

Planned security enhancements:
- User authentication system
- Role-based access control
- Session management
- CSRF protection
- Enhanced input validation
- Security headers hardening
