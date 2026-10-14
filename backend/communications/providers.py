import html
import logging
from dataclasses import dataclass
from datetime import datetime
import re

import requests
from django.conf import settings

from .errors import ProviderNotConfigured

logger = logging.getLogger(__name__)
RESEND_EMAILS_URL = "https://api.resend.com/emails"


@dataclass(frozen=True)
class Delivery:
    provider_message_id: str


class ResendEmailProvider:
    def send(
        self, *, email: str, message: str, scheduled_at: datetime | None = None
    ) -> Delivery:
        if not settings.RESEND_API_KEY or not settings.RESEND_FROM_EMAIL:
            raise ProviderNotConfigured()

        try:
            response = requests.post(
                RESEND_EMAILS_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [email],
                    "subject": "A message from your recruiting team",
                    "html": f"<p>{html.escape(message).replace(chr(10), '<br>')}</p>",
                    **({"scheduled_at": scheduled_at.isoformat()} if scheduled_at else {}),
                },
                timeout=20,
            )
        except requests.RequestException as exc:
            logger.warning("Resend network request failed: %s", type(exc).__name__)
            raise DeliveryFailure(
                "The email service is temporarily unavailable. Please try again.",
                retryable=True,
            ) from exc

        try:
            result = response.json()
        except requests.exceptions.JSONDecodeError:
            result = {}

        if not response.ok:
            error_type = str(result.get("name", "unknown_error"))
            provider_message = str(result.get("message", "No error detail returned."))
            safe_message = self._sanitize_log_message(provider_message)
            logger.error(
                "Resend rejected email: HTTP status=%s error_type=%s detail=%s",
                response.status_code,
                error_type,
                safe_message,
            )
            raise self._safe_error(response.status_code, error_type) from None

        provider_id = result.get("id") if isinstance(result, dict) else None
        if not provider_id:
            logger.error("Resend returned a response without a message ID")
            raise DeliveryFailure(
                "The email service did not confirm the message. Please try again.",
                retryable=True,
            )
        return Delivery(provider_message_id=str(provider_id))

    @staticmethod
    def _safe_error(status_code: int, error_type: str) -> "DeliveryFailure":
        if status_code == 429 or status_code >= 500:
            return DeliveryFailure(
                "The email service is temporarily unavailable. Please try again.",
                retryable=True,
            )
        if status_code in (401, 403):
            return DeliveryFailure(
                "Resend rejected the API key or sender address. Check the Resend account and verify the sender.",
                retryable=False,
            )
        if "email" in error_type.lower() or "recipient" in error_type.lower():
            return DeliveryFailure(
                "The candidate email address could not be accepted. Verify it and try again.",
                retryable=False,
            )
        return DeliveryFailure(
            "The email service could not accept this message. Verify the details and try again.",
            retryable=False,
        )

    @staticmethod
    def _sanitize_log_message(message: str) -> str:
        message = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email]", message, flags=re.I)
        return re.sub(r"\bre_[A-Za-z0-9_-]+\b", "[api-key]", message)


class DeliveryFailure(Exception):
    def __init__(self, message: str, *, retryable: bool):
        super().__init__(message)
        self.retryable = retryable


def create_email_provider() -> ResendEmailProvider:
    return ResendEmailProvider()
