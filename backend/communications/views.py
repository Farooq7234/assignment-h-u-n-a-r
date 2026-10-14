import json
import logging
import re
from collections.abc import Mapping

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from svix.webhooks import Webhook, WebhookVerificationError

from .errors import ProviderNotConfigured
from .models import Candidate, Communication, MessageTemplate, WebhookEvent
from .providers import DeliveryFailure, create_email_provider
from .serializers import (
    serialize_candidate,
    serialize_communication,
    serialize_template,
    validate_candidate,
    validate_send_request,
    validate_template,
)

logger = logging.getLogger(__name__)

_STATUS_RANK = {
    Communication.Status.SCHEDULED: -1,
    Communication.Status.SENT: 0,
    Communication.Status.DELIVERED: 1,
    Communication.Status.READ: 2,
    Communication.Status.FAILED: 3,
}
_EVENT_STATUS = {
    "email.sent": Communication.Status.SENT,
    "email.delivered": Communication.Status.DELIVERED,
    "email.opened": Communication.Status.READ,
    "email.bounced": Communication.Status.FAILED,
    "email.delivery_delayed": Communication.Status.SENT,
    "email.failed": Communication.Status.FAILED,
}
_TEMPLATE_TOKEN = re.compile(r"\{\{(name|phone|email)\}\}")


def _json_body(request: HttpRequest) -> object | None:
    try:
        return json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _json_error(errors: dict, status_code: int = 400) -> JsonResponse:
    return JsonResponse(errors, status=status_code)


def _provider_error(message: str, code: str, status_code: int) -> JsonResponse:
    return JsonResponse({"error": {"code": code, "message": message}}, status=status_code)


def _deliver_message(
    provider, candidate: Candidate, message: str, scheduled_at=None
) -> Communication:
    try:
        delivery = provider.send(
            email=candidate.email, message=message, scheduled_at=scheduled_at
        )
    except ProviderNotConfigured:
        return Communication.objects.create(
            candidate=candidate,
            message=message,
            status=Communication.Status.FAILED,
            failure_reason=ProviderNotConfigured.default_detail,
            retryable=True,
            scheduled_at=scheduled_at,
        )
    except DeliveryFailure as exc:
        return Communication.objects.create(
            candidate=candidate,
            message=message,
            status=Communication.Status.FAILED,
            failure_reason=str(exc),
            retryable=exc.retryable,
            scheduled_at=scheduled_at,
        )
    return Communication.objects.create(
        candidate=candidate,
        message=message,
        status=Communication.Status.SCHEDULED if scheduled_at else Communication.Status.SENT,
        provider_message_id=delivery.provider_message_id,
        scheduled_at=scheduled_at,
    )


def _render_template(template: MessageTemplate, candidate: Candidate) -> str:
    values = {
        "name": candidate.name,
        "phone": candidate.mobile,
        "email": candidate.email,
    }
    return _TEMPLATE_TOKEN.sub(lambda match: values[match.group(1)], template.body)


@require_http_methods(["GET", "POST"])
def candidates(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        queryset = Candidate.objects.prefetch_related(
            Prefetch(
                "communications",
                queryset=Communication.objects.order_by("-created_at"),
                to_attr="ordered_communications",
            )
        ).order_by("-created_at")
        search = request.GET.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(mobile__icontains=search)
                | Q(email__icontains=search)
                | Q(candidate_id__icontains=search)
            )
        return JsonResponse(
            [serialize_candidate(candidate) for candidate in queryset],
            safe=False,
        )

    data = _json_body(request)
    candidate_data, errors = validate_candidate(data)
    if errors:
        return _json_error(errors)
    candidate = Candidate.objects.create(**candidate_data)
    return JsonResponse(serialize_candidate(candidate), status=201)


@require_http_methods(["GET", "DELETE"])
def candidate_detail(request: HttpRequest, candidate_id) -> HttpResponse:
    candidate = get_object_or_404(Candidate, id=candidate_id)
    if request.method == "DELETE":
        candidate.delete()
        return HttpResponse(status=204)
    return JsonResponse(serialize_candidate(candidate))


@require_GET
def candidate_history(request: HttpRequest, candidate_id) -> JsonResponse:
    candidate = get_object_or_404(Candidate, id=candidate_id)
    history = candidate.communications.order_by("-created_at")
    return JsonResponse(
        [serialize_communication(item) for item in history],
        safe=False,
    )


@require_http_methods(["GET", "POST"])
def templates(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return JsonResponse(
            [serialize_template(template) for template in MessageTemplate.objects.all()],
            safe=False,
        )

    template_data, errors = validate_template(_json_body(request))
    if errors:
        return _json_error(errors)
    try:
        with transaction.atomic():
            template = MessageTemplate.objects.create(**template_data)
    except IntegrityError:
        return _json_error({"name": ["A template with this name already exists."]})
    return JsonResponse(serialize_template(template), status=201)


@require_http_methods(["PUT", "DELETE"])
def template_detail(request: HttpRequest, template_id) -> HttpResponse:
    template = get_object_or_404(MessageTemplate, id=template_id)
    if request.method == "DELETE":
        template.delete()
        return HttpResponse(status=204)

    template_data, errors = validate_template(
        _json_body(request), template_id=template.id
    )
    if errors:
        return _json_error(errors)
    try:
        with transaction.atomic():
            for field, value in template_data.items():
                setattr(template, field, value)
            template.save(update_fields=(*template_data, "updated_at"))
    except IntegrityError:
        return _json_error({"name": ["A template with this name already exists."]})
    return JsonResponse(serialize_template(template))


@require_POST
def send_messages(request: HttpRequest) -> JsonResponse:
    candidate_ids, message, scheduled_at, template, errors = validate_send_request(
        _json_body(request)
    )
    if errors:
        return _json_error(errors)

    candidates_to_message = Candidate.objects.filter(id__in=candidate_ids).order_by("created_at")
    provider = create_email_provider()
    results = []
    for candidate in candidates_to_message:
        candidate_message = message
        if template is not None:
            candidate_message = _render_template(template, candidate)
        communication = _deliver_message(
            provider, candidate, candidate_message, scheduled_at
        )
        results.append(
            {
                "candidate_id": str(candidate.id),
                "candidate_name": candidate.name,
                "communication": serialize_communication(communication),
                "success": communication.status != Communication.Status.FAILED,
                "retryable": communication.retryable,
            }
        )

    succeeded = sum(result["success"] for result in results)
    return JsonResponse(
        {"results": results, "succeeded": succeeded, "failed": len(results) - succeeded}
    )


@require_POST
def retry_communication(request: HttpRequest, communication_id) -> JsonResponse:
    original = get_object_or_404(Communication, id=communication_id)
    if original.status != Communication.Status.FAILED or not original.retryable:
        return _provider_error(
            "This failed message cannot be retried.", "not_retryable", 400
        )

    communication = _deliver_message(
        create_email_provider(), original.candidate, original.message
    )
    return JsonResponse(
        {
            "communication": serialize_communication(communication),
            "success": communication.status != Communication.Status.FAILED,
            "retryable": communication.retryable,
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def resend_webhook(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return JsonResponse({"status": "ok"})

    if not settings.RESEND_WEBHOOK_SECRET:
        logger.error("Resend webhook rejected because its signing secret is not configured")
        return _provider_error(
            "Webhook verification is not configured.", "provider_not_configured", 503
        )
    try:
        event = Webhook(settings.RESEND_WEBHOOK_SECRET).verify(
            request.body,
            {
                "svix-id": request.headers.get("svix-id", ""),
                "svix-timestamp": request.headers.get("svix-timestamp", ""),
                "svix-signature": request.headers.get("svix-signature", ""),
            },
        )
    except WebhookVerificationError:
        logger.warning("Resend webhook signature verification failed")
        return _provider_error("Webhook signature is invalid.", "invalid_signature", 400)

    if not isinstance(event, Mapping):
        return JsonResponse({"received": True, "ignored": True})

    event_id = request.headers.get("svix-id")
    event_type = event.get("type")
    data = event.get("data", {})
    if not isinstance(event_id, str) or not isinstance(event_type, str) or not isinstance(data, Mapping):
        return _provider_error("Webhook event is incomplete.", "invalid_event", 400)

    new_status = _EVENT_STATUS.get(event_type)
    provider_message_id = data.get("email_id") or data.get("id")
    if not new_status or not isinstance(provider_message_id, str):
        return JsonResponse({"received": True, "ignored": True})

    communication = Communication.objects.filter(
        provider_message_id=provider_message_id
    ).first()
    if communication is None:
        logger.warning(
            "Resend webhook event could not be matched: event_id=%s event_type=%s",
            event_id,
            event_type,
        )
        return JsonResponse({"received": True, "matched": False})

    try:
        with transaction.atomic():
            WebhookEvent.objects.create(provider_event_id=event_id, event_type=event_type)
    except IntegrityError:
        return JsonResponse({"received": True, "duplicate": True})

    terminal = communication.status in (
        Communication.Status.READ,
        Communication.Status.FAILED,
    )
    if not terminal and _STATUS_RANK[new_status] >= _STATUS_RANK[communication.status]:
        communication.status = new_status
        if new_status == Communication.Status.FAILED:
            communication.failure_reason = "The email could not be delivered."
            communication.retryable = event_type == "email.delivery_delayed"
        communication.save(
            update_fields=("status", "failure_reason", "retryable", "updated_at")
        )
    logger.info(
        "Processed Resend webhook: event_id=%s event_type=%s communication_id=%s",
        event_id,
        event_type,
        communication.id,
    )
    return JsonResponse({"received": True, "matched": True})
