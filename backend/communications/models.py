import secrets
import string
import uuid

from django.db import models
from django.db.models.functions import Lower


def generate_candidate_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Candidate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate_id = models.CharField(
        max_length=6, unique=True, default=generate_candidate_id, editable=False
    )
    name = models.CharField(max_length=160)
    mobile = models.CharField(max_length=32)
    email = models.EmailField(max_length=254, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.name


class Communication(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "Scheduled", "Scheduled"
        SENT = "Sent", "Sent"
        DELIVERED = "Delivered", "Delivered"
        READ = "Read", "Read"
        FAILED = "Failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate, on_delete=models.CASCADE, related_name="communications"
    )
    message = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices)
    provider = models.CharField(max_length=32, default="resend")
    provider_message_id = models.CharField(
        max_length=255, null=True, blank=True, unique=True
    )
    failure_reason = models.CharField(max_length=500, blank=True)
    retryable = models.BooleanField(default=False)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.candidate.name}: {self.status}"


class MessageTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(Lower("name"), name="unique_message_template_name_ci")
        ]

    def __str__(self) -> str:
        return self.name


class WebhookEvent(models.Model):
    provider_event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=128)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.provider_event_id
