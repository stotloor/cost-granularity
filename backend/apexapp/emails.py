"""Transactional email sender (SMTP or Resend)."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@example.com")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")

APP_NAME = "Project Cost Granularity Controller"
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")

TEMPLATES = {
    "welcome": {"subject": 'Welcome to Project Cost Granularity Controller!', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Welcome to Project Cost Granularity Controller!</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Welcome aboard! 🎉</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>Thank you for signing up. We\'re excited to have you with us.</p><p>Your account has been created successfully and you can now access all features.</p>\n              </div>\n              \n        <table role="presentation" style="margin: 32px 0;">\n          <tr>\n            <td style="background: #0f172a; border-radius: 6px; padding: 14px 28px;">\n              <a href="{{BASE_URL}}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">Get Started</a>\n            </td>\n          </tr>\n        </table>\n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
    "verify_email": {"subject": 'Verify your email address', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Verify your email address</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Verify your email</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>Please verify your email address to complete your registration.</p><p>Click the button below to verify your account. This link will expire in 24 hours.</p>\n              </div>\n              \n        <table role="presentation" style="margin: 32px 0;">\n          <tr>\n            <td style="background: #0f172a; border-radius: 6px; padding: 14px 28px;">\n              <a href="{{VERIFY_URL}}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">Verify Email</a>\n            </td>\n          </tr>\n        </table>\n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
    "reset_password": {"subject": 'Reset your password', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Reset your password</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Password reset requested</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>We received a request to reset your password.</p><p>Click the button below to choose a new password. This link will expire in 1 hour.</p><p>If you didn\'t request a password reset, please ignore this email or contact support if you have concerns.</p>\n              </div>\n              \n        <table role="presentation" style="margin: 32px 0;">\n          <tr>\n            <td style="background: #0f172a; border-radius: 6px; padding: 14px 28px;">\n              <a href="{{RESET_URL}}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">Reset Password</a>\n            </td>\n          </tr>\n        </table>\n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
    "password_changed": {"subject": 'Your password has been changed', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Your password has been changed</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Password changed successfully</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>This is a confirmation that your password was changed successfully.</p><p>If you made this change, no further action is needed.</p><p><strong>If you didn\'t make this change, please contact support immediately.</strong></p>\n              </div>\n              \n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
    "login_alert": {"subject": 'New login to your account', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>New login to your account</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">New login detected</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>We detected a new login to your account.</p><p><strong>Time:</strong> {{LOGIN_TIME}}<br><strong>Location:</strong> {{LOGIN_LOCATION}}<br><strong>Device:</strong> {{LOGIN_DEVICE}}</p><p>If this was you, you can safely ignore this email.</p><p>If you don\'t recognize this activity, please change your password immediately.</p>\n              </div>\n              \n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
    "account_deleted": {"subject": 'Your account has been deleted', "html": '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Your account has been deleted</title>\n</head>\n<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #f8fafc; color: #334155;">\n  <table role="presentation" style="width: 100%; border-collapse: collapse;">\n    <tr>\n      <td align="center" style="padding: 40px 20px;">\n        <table role="presentation" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\n          <tr>\n            <td style="padding: 40px 32px;">\n              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #0f172a;">Project Cost Granularity Controller</h1>\n              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">Account deleted</h2>\n              <div style="line-height: 1.6; color: #475569; font-size: 15px;">\n                <p>Your account has been permanently deleted as requested.</p><p>All your data has been removed from our systems.</p><p>We\'re sorry to see you go. If you change your mind, you can always create a new account.</p>\n              </div>\n              \n              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8;">\n                <p style="margin: 0;">If you didn\'t request this, you can safely ignore this email.</p>\n                <p style="margin: 12px 0 0 0;">This email was sent by Project Cost Granularity Controller (<a href="{{BASE_URL}}" style="color: #3b82f6;">{{BASE_URL}}</a>)</p>\n              </div>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>'},
}


def _render(template: str, **vars) -> str:
    """Replace {{VAR}} placeholders with provided values."""
    rendered = template
    defaults = {"APP_NAME": APP_NAME, "BASE_URL": BASE_URL}
    for key, val in {**defaults, **vars}.items():
        rendered = rendered.replace("{{" + key + "}}", str(val))
    return rendered


def send_email(to: str, template_name: str, **variables) -> bool:
    """Send email via SMTP or Resend. Non-blocking: logs errors but doesn't raise."""
    if template_name not in TEMPLATES:
        print(f"[email] Unknown template: {template_name}")
        return False

    template = TEMPLATES[template_name]
    subject = _render(template["subject"], **variables)
    html = _render(template["html"], **variables)

    try:
        if RESEND_API_KEY:
            return _send_via_resend(to, subject, html)
        elif SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
            return _send_via_smtp(to, subject, html)
        else:
            print(f"[email] No email provider configured. Would send to {to}: {subject}")
            return True  # Dev mode: pretend success
    except Exception as e:
        print(f"[email] Failed to send {template_name} to {to}: {e}")
        return False


def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["From"] = FROM_EMAIL
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
    print(f"[email] Sent via SMTP to {to}: {subject}")
    return True


def _send_via_resend(to: str, subject: str, html: str) -> bool:
    import json
    try:
        import httpx
    except ImportError:
        print("[email] httpx not installed; can't use Resend")
        return False

    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
        timeout=10,
    )
    resp.raise_for_status()
    print(f"[email] Sent via Resend to {to}: {subject}")
    return True
