"""Outbound integrations: Gmail (smtplib), Gemini and Groq (REST via httpx).

Tools call these through the module (e.g. `email_service.send_email(...)`)
so the test-suite can monkeypatch them without any network access.
"""
