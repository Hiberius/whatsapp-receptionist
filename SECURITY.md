# Security Policy

## Supported Versions

This project is currently in early development (v0.1.x). Only the latest commit on `main` receives security fixes.

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | Yes |
| < 0.1.0 | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it by email to:

**christian@hiberius.com**

Include as much of the following as possible:

- Type of issue (e.g. SQL injection, XSS, authentication bypass, credential leak)
- Full paths of source file(s) related to the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Response Timeline

- **Acknowledgement**: within 48 hours of receiving your report
- **Initial assessment**: within 5 business days
- **Fix timeline**: depends on severity — critical issues will be patched as quickly as possible

## Scope

The following are in scope for responsible disclosure:

- Authentication and session management flaws
- Multi-tenant data isolation bypasses (RLS violations)
- Server-side injection vulnerabilities
- Credential or secret exposure in source code or build artifacts
- Insecure direct object references in API endpoints
- Webhook signature bypass
- Rate limit bypass on sensitive endpoints

The following are **out of scope**:

- Vulnerabilities requiring physical access to a server
- Social engineering attacks
- Denial of service attacks
- Issues in third-party dependencies without a clear exploit path in this codebase

## Disclosure Policy

We follow a **coordinated disclosure** process. We ask that you give us a reasonable amount of time to address a reported vulnerability before public disclosure. We will credit you in the release notes unless you prefer to remain anonymous.

## Security Hardening Notes

This codebase implements:

- Per-request CSP nonces (no `unsafe-inline`)
- Row-Level Security (RLS) on all Supabase tables
- Webhook signature verification (Stripe HMAC, WhatsApp secret header)
- Rate limiting on all public and internal endpoints (Upstash Redis with in-memory fallback)
- AES-256-GCM encryption for OAuth credentials stored in the database
- PII redaction in all log output
- GDPR Art.15/17 export and deletion endpoints

For questions about security architecture, open a GitHub Discussion.
