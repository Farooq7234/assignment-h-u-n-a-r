from collections.abc import Mapping
from datetime import datetime, timedelta
from uuid import UUID

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware, now

from .models import Candidate, Communication, MessageTemplate

_TEMPLATE_PLACEHOLDERS = ("{{name}}", "{{phone}}", "{{email}}")


def serialize_candidate(candidate: Candidate) -> dict:
    communications = getattr(candidate, "ordered_communications", None)
    latest = communications[0] if communications is not None and communications else None
    if communications is None:
        latest = candidate.communications.order_by("-created_at").first()
    return {
        "id": str(candidate.id),
        "candidate_id": candidate.candidate_id,
        "name": candidate.name,
        "mobile": candidate.mobile,
        "email": candidate.email,
        "last_message": latest.created_at.isoformat() if latest else None,
        "status": latest.status if latest else None,
        "created_at": candidate.created_at.isoformat(),
    }


def serialize_communication(communication: Communication) -> dict:
    return {
        "id": str(communication.id),
        "message": communication.message,
        "sent_at": communication.created_at.isoformat(),
        "status": communication.status,
        "failure_reason": communication.failure_reason,
        "retryable": communication.retryable,
        "scheduled_at": communication.scheduled_at.isoformat() if communication.scheduled_at else None,
    }


def serialize_template(template: MessageTemplate) -> dict:
    return {
        "id": str(template.id),
        "name": template.name,
        "body": template.body,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat(),
    }


def validate_template(
    data: object, *, template_id: UUID | None = None
) -> tuple[dict[str, str], dict[str, list[str]]]:
    if not isinstance(data, Mapping):
        return {}, {"non_field_errors": ["Expected an object."]}

    errors: dict[str, list[str]] = {}
    cleaned: dict[str, str] = {}
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        errors["name"] = ["This field may not be blank."]
    else:
        name = name.strip()
        if len(name) > 160:
            errors["name"] = ["Ensure this field has no more than 160 characters."]
        elif MessageTemplate.objects.filter(name__iexact=name).exclude(
            id=template_id
        ).exists():
            errors["name"] = ["A template with this name already exists."]
        cleaned["name"] = name

    body = data.get("body")
    if not isinstance(body, str) or not body.strip():
        errors["body"] = ["This field may not be blank."]
    else:
        body = body.strip()
        if len(body) > 10000:
            errors["body"] = ["Ensure this field has no more than 10000 characters."]
        else:
            remaining = body
            for placeholder in _TEMPLATE_PLACEHOLDERS:
                remaining = remaining.replace(placeholder, "")
            if "{{" in remaining or "}}" in remaining:
                errors["body"] = [
                    "Use only the supported placeholders: {{name}}, {{phone}}, and {{email}}."
                ]
        cleaned["body"] = body

    return cleaned, errors


def validate_candidate(data: object) -> tuple[dict[str, str], dict[str, list[str]]]:
    errors: dict[str, list[str]] = {}
    if not isinstance(data, Mapping):
        return {}, {"non_field_errors": ["Expected an object."]}

    cleaned = {}
    for field, max_length in (("name", 160), ("mobile", 32), ("email", 254)):
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            errors[field] = ["This field may not be blank."]
            continue
        value = value.strip()
        if len(value) > max_length:
            errors[field] = [f"Ensure this field has no more than {max_length} characters."]
            continue
        if field == "email":
            try:
                validate_email(value)
            except ValidationError:
                errors[field] = ["Enter a valid email address."]
            if Candidate.objects.filter(email__iexact=value).exists():
                errors[field] = ["candidate with this email already exists."]
        cleaned[field] = value
    return cleaned, errors


def validate_send_request(
    data: object,
) -> tuple[list[UUID], str, datetime | None, MessageTemplate | None, dict[str, object]]:
    if not isinstance(data, Mapping):
        return [], "", None, None, {"non_field_errors": ["Expected an object."]}

    errors: dict[str, object] = {}
    raw_ids = data.get("candidate_ids")
    candidate_ids: list[UUID] = []
    if not isinstance(raw_ids, list) or not raw_ids:
        errors["candidate_ids"] = ["This list may not be empty."]
    elif len(raw_ids) > 100:
        errors["candidate_ids"] = ["Ensure this field has no more than 100 elements."]
    else:
        for index, value in enumerate(raw_ids):
            try:
                candidate_ids.append(UUID(str(value)))
            except (ValueError, TypeError, AttributeError):
                errors.setdefault("candidate_ids", {})[index] = ["Must be a valid UUID."]
        candidate_ids = list(dict.fromkeys(candidate_ids))
        existing = set(Candidate.objects.filter(id__in=candidate_ids).values_list("id", flat=True))
        unknown = [str(candidate_id) for candidate_id in candidate_ids if candidate_id not in existing]
        if unknown:
            errors["candidate_ids"] = {
                "unknown_ids": unknown,
                "detail": "One or more candidates do not exist.",
            }

    template = None
    raw_template_id = data.get("template_id")
    if raw_template_id is not None:
        try:
            template_id = UUID(str(raw_template_id))
            template = MessageTemplate.objects.filter(id=template_id).first()
            if template is None:
                errors["template_id"] = ["A valid template is required."]
        except (ValueError, TypeError, AttributeError):
            errors["template_id"] = ["Must be a valid UUID."]

    message = data.get("message")
    if template is None:
        if not isinstance(message, str) or not message.strip():
            errors["message"] = ["This field may not be blank."]
            message = ""
        else:
            message = message.strip()
            if len(message) > 10000:
                errors["message"] = ["Ensure this field has no more than 10000 characters."]
    else:
        message = ""

    scheduled_at = None
    raw_scheduled_at = data.get("scheduled_at")
    if raw_scheduled_at is not None:
        scheduled_at = parse_datetime(raw_scheduled_at) if isinstance(raw_scheduled_at, str) else None
        if not scheduled_at or not is_aware(scheduled_at):
            errors["scheduled_at"] = ["Enter a valid ISO 8601 date/time with a timezone."]
        elif scheduled_at < now() + timedelta(minutes=1):
            errors["scheduled_at"] = ["Choose a time at least one minute in the future."]
        elif scheduled_at > now() + timedelta(days=30):
            errors["scheduled_at"] = ["Emails can only be scheduled up to 30 days ahead."]

    return candidate_ids, message, scheduled_at, template, errors
