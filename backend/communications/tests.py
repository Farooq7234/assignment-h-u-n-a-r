import json
from datetime import timedelta
from unittest.mock import patch

from django.test import Client, TestCase, override_settings
from django.utils import timezone
from svix.webhooks import WebhookVerificationError

from .models import Candidate, Communication, MessageTemplate, WebhookEvent
from .providers import Delivery, DeliveryFailure, ResendEmailProvider


class JsonClient(Client):
    def _attach_data(self, response):
        response.data = json.loads(response.content) if response.content else None
        return response

    def get(self, path, **extra):
        return self._attach_data(super().get(path, **extra))

    def post(self, path, data=None, format=None, content_type="application/json", **extra):
        if isinstance(data, (dict, list)):
            data = json.dumps(data)
        return self._attach_data(
            super().post(path, data=data, content_type=content_type, **extra)
        )

    def put(self, path, data=None, format=None, content_type="application/json", **extra):
        if isinstance(data, (dict, list)):
            data = json.dumps(data)
        return self._attach_data(
            super().put(path, data=data, content_type=content_type, **extra)
        )

    def delete(self, path, **extra):
        return self._attach_data(super().delete(path, **extra))


class CandidateApiTests(TestCase):
    def setUp(self):
        self.client = JsonClient()

    def make_candidate(self, **overrides):
        values = {
            "name": "Priya Shah",
            "mobile": "+91 9876543210",
            "email": "priya@example.com",
        }
        values.update(overrides)
        return Candidate.objects.create(**values)

    def test_candidate_create_search_delete_and_empty_history(self):
        response = self.client.post(
            "/api/candidates/",
            {
                "name": "Rahul Sharma",
                "mobile": "+91 9000000000",
                "email": "rahul@example.com",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        candidate_id = response.data["id"]
        self.assertEqual(len(response.data["candidate_id"]), 6)
        self.assertIsNone(response.data["last_message"])

        search = self.client.get("/api/candidates/?search=rahul")
        self.assertEqual(len(search.data), 1)
        self.assertEqual(search.data[0]["id"], candidate_id)
        self.assertEqual(
            self.client.get(f"/api/candidates/{candidate_id}/history/").data,
            [],
        )

        self.assertEqual(self.client.delete(f"/api/candidates/{candidate_id}/").status_code, 204)
        self.assertFalse(Candidate.objects.filter(id=candidate_id).exists())

    def test_candidate_validation_returns_field_errors(self):
        response = self.client.post(
            "/api/candidates/",
            {"name": "", "mobile": "+1", "email": "not-an-email"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertIn("name", response.data)

    def test_history_is_newest_first(self):
        candidate = self.make_candidate()
        older = Communication.objects.create(
            candidate=candidate, message="First", status=Communication.Status.SENT
        )
        newer = Communication.objects.create(
            candidate=candidate, message="Second", status=Communication.Status.DELIVERED
        )
        response = self.client.get(f"/api/candidates/{candidate.id}/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data],
            [str(newer.id), str(older.id)],
        )

    @patch("communications.views.create_email_provider")
    def test_bulk_send_tracks_each_recipient_independently(self, create_provider):
        first = self.make_candidate(email="first@example.com")
        second = self.make_candidate(email="second@example.com", name="Amit Kumar")
        provider = create_provider.return_value
        provider.send.side_effect = [
            Delivery(provider_message_id="email-1"),
            DeliveryFailure("Recipient email could not be accepted.", retryable=False),
        ]

        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(first.id), str(second.id), str(first.id)],
                "message": "Interview details",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["succeeded"], 1)
        self.assertEqual(response.data["failed"], 1)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(
            list(
                Communication.objects.order_by("candidate__email").values_list(
                    "status", flat=True
                )
            ),
            [Communication.Status.SENT, Communication.Status.FAILED],
        )
        self.assertEqual(provider.send.call_count, 2)

    @patch("communications.views.create_email_provider")
    def test_bulk_send_schedules_message_for_future_time(self, create_provider):
        candidate = self.make_candidate()
        scheduled_at = timezone.now() + timedelta(hours=1)
        provider = create_provider.return_value
        provider.send.return_value = Delivery(provider_message_id="scheduled-email-1")

        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(candidate.id)],
                "message": "Interview reminder",
                "scheduled_at": scheduled_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        communication = Communication.objects.get()
        self.assertEqual(communication.status, Communication.Status.SCHEDULED)
        self.assertEqual(communication.scheduled_at, scheduled_at)
        self.assertEqual(response.data["results"][0]["communication"]["status"], "Scheduled")
        provider.send.assert_called_once_with(
            email=candidate.email,
            message="Interview reminder",
            scheduled_at=scheduled_at,
        )

    @patch("communications.views.create_email_provider")
    def test_past_schedule_is_rejected_before_provider_is_created(self, create_provider):
        candidate = self.make_candidate()
        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(candidate.id)],
                "message": "Interview reminder",
                "scheduled_at": (timezone.now() - timedelta(minutes=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("scheduled_at", response.data)
        create_provider.assert_not_called()
        self.assertFalse(Communication.objects.exists())

    @patch("communications.views.create_email_provider")
    def test_unknown_recipient_rejects_request_before_any_send(self, create_provider):
        candidate = self.make_candidate()
        response = self.client.post(
            "/api/communications/send/",
            {"candidate_ids": [str(candidate.id), "00000000-0000-0000-0000-000000000000"], "message": "Hi"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        create_provider.assert_not_called()
        self.assertEqual(Communication.objects.count(), 0)

    @patch("communications.views.create_email_provider")
    def test_retryable_failure_creates_a_separate_attempt(self, create_provider):
        candidate = self.make_candidate()
        provider = create_provider.return_value
        provider.send.side_effect = [
            DeliveryFailure("Temporary email service issue.", retryable=True),
            Delivery(provider_message_id="email-retry-1"),
        ]
        sent = self.client.post(
            "/api/communications/send/",
            {"candidate_ids": [str(candidate.id)], "message": "Interview details"},
            format="json",
        )
        original_id = sent.data["results"][0]["communication"]["id"]

        retried = self.client.post(
            f"/api/communications/{original_id}/retry/", {}, format="json"
        )
        self.assertEqual(retried.status_code, 201)
        self.assertTrue(retried.data["success"])
        self.assertNotEqual(retried.data["communication"]["id"], original_id)
        self.assertEqual(
            list(
                Communication.objects.order_by("created_at").values_list(
                    "status", flat=True
                )
            ),
            [Communication.Status.FAILED, Communication.Status.SENT],
        )

    @patch("communications.views.create_email_provider")
    def test_non_retryable_failure_cannot_be_retried(self, create_provider):
        candidate = self.make_candidate()
        failed = Communication.objects.create(
            candidate=candidate,
            message="Invalid address",
            status=Communication.Status.FAILED,
            failure_reason="Verify the email address.",
            retryable=False,
        )
        response = self.client.post(
            f"/api/communications/{failed.id}/retry/", {}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        create_provider.assert_not_called()

    @override_settings(RESEND_API_KEY="", RESEND_FROM_EMAIL="")
    def test_missing_email_provider_configuration_is_a_visible_delivery_failure(self):
        candidate = self.make_candidate()
        response = self.client.post(
            "/api/communications/send/",
            {"candidate_ids": [str(candidate.id)], "message": "Interview details"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        outcome = response.data["results"][0]
        self.assertFalse(outcome["success"])
        self.assertTrue(outcome["retryable"])
        self.assertIn("not configured", outcome["communication"]["failure_reason"])


class MessageTemplateApiTests(TestCase):
    def setUp(self):
        self.client = JsonClient()

    def make_candidate(self, **overrides):
        values = {
            "name": "Priya Shah",
            "mobile": "+91 9876543210",
            "email": "priya@example.com",
        }
        values.update(overrides)
        return Candidate.objects.create(**values)

    def test_template_crud_and_case_insensitive_name_uniqueness(self):
        created = self.client.post(
            "/api/templates/",
            {"name": "Interview", "body": "Hi {{name}}, call {{phone}}"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        template_id = created.data["id"]
        self.assertEqual(self.client.get("/api/templates/").data[0]["id"], template_id)

        duplicate = self.client.post(
            "/api/templates/",
            {"name": "INTERVIEW", "body": "Hi {{name}}"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("name", duplicate.data)

        updated = self.client.put(
            f"/api/templates/{template_id}/",
            {"name": "Follow-up", "body": "Hi {{name}} at {{email}}"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["name"], "Follow-up")
        self.assertEqual(
            self.client.delete(f"/api/templates/{template_id}/").status_code, 204
        )
        self.assertFalse(MessageTemplate.objects.exists())

    def test_template_rejects_unknown_placeholders(self):
        response = self.client.post(
            "/api/templates/",
            {"name": "Invalid", "body": "Hi {{first_name}}"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("body", response.data)
        self.assertFalse(MessageTemplate.objects.exists())

    @patch("communications.views.create_email_provider")
    def test_template_can_be_scheduled(self, create_provider):
        candidate = self.make_candidate()
        template = MessageTemplate.objects.create(
            name="Reminder", body="Hello {{name}}"
        )
        scheduled_at = timezone.now() + timedelta(hours=1)
        provider = create_provider.return_value
        provider.send.return_value = Delivery(provider_message_id="scheduled-template")

        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(candidate.id)],
                "template_id": str(template.id),
                "scheduled_at": scheduled_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        communication = Communication.objects.get()
        self.assertEqual(communication.status, Communication.Status.SCHEDULED)
        self.assertEqual(communication.message, "Hello Priya Shah")
        provider.send.assert_called_once_with(
            email=candidate.email,
            message="Hello Priya Shah",
            scheduled_at=scheduled_at,
        )

    @patch("communications.views.create_email_provider")
    def test_template_send_personalizes_each_candidate_and_retry_reuses_rendered_message(
        self, create_provider
    ):
        first = self.make_candidate()
        second = self.make_candidate(
            name="Amit Kumar", mobile="+91 9000000000", email="amit@example.com"
        )
        template = MessageTemplate.objects.create(
            name="Interview", body="Hello {{name}} at {{email}}; call {{phone}}."
        )
        provider = create_provider.return_value
        provider.send.side_effect = [
            DeliveryFailure("Temporary issue.", retryable=True),
            Delivery(provider_message_id="email-2"),
            Delivery(provider_message_id="email-retry"),
        ]

        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(first.id), str(second.id)],
                "template_id": str(template.id),
            },
            format="json",
        )

        expected_messages = [
            "Hello Priya Shah at priya@example.com; call +91 9876543210.",
            "Hello Amit Kumar at amit@example.com; call +91 9000000000.",
        ]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [call.kwargs["message"] for call in provider.send.call_args_list],
            expected_messages,
        )
        self.assertEqual(
            dict(
                Communication.objects.values_list("candidate__email", "message")
            ),
            {
                first.email: expected_messages[0],
                second.email: expected_messages[1],
            },
        )

        failed_communication = Communication.objects.get(
            candidate=first, status=Communication.Status.FAILED
        )
        retried = self.client.post(
            f"/api/communications/{failed_communication.id}/retry/", {}, format="json"
        )
        self.assertEqual(retried.status_code, 201)
        self.assertEqual(provider.send.call_args_list[2].kwargs["message"], expected_messages[0])

    @patch("communications.views.create_email_provider")
    def test_unknown_template_is_rejected_before_sending(self, create_provider):
        candidate = self.make_candidate()
        response = self.client.post(
            "/api/communications/send/",
            {
                "candidate_ids": [str(candidate.id)],
                "template_id": "00000000-0000-0000-0000-000000000000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("template_id", response.data)
        create_provider.assert_not_called()


class ResendProviderTests(TestCase):
    @override_settings(
        RESEND_API_KEY="re_test_key",
        RESEND_FROM_EMAIL="Recruiting <recruiting@example.test>",
    )
    @patch("communications.providers.requests.post")
    def test_provider_rejection_is_logged_with_sanitized_detail(self, post):
        response = post.return_value
        response.status_code = 403
        response.ok = False
        response.json.return_value = {
            "name": "validation_error",
            "message": "Sender sender@example.test is not verified.",
        }
        with self.assertLogs("communications.providers", level="ERROR") as logs:
            with self.assertRaises(DeliveryFailure) as raised:
                ResendEmailProvider().send(
                    email="candidate@example.test",
                    message="Private message content",
                )

        self.assertFalse(raised.exception.retryable)
        self.assertTrue(any("HTTP status=403 error_type=validation_error" in entry for entry in logs.output))
        self.assertTrue(
            any("sender [email] is not verified" in entry.lower() for entry in logs.output)
        )
        self.assertFalse(any("Private message content" in entry for entry in logs.output))
        self.assertFalse(any("sender@example.test" in entry for entry in logs.output))
        self.assertEqual(
            raised.exception.args[0],
            "Resend rejected the API key or sender address. Check the Resend account and verify the sender.",
        )

    @override_settings(
        RESEND_API_KEY="re_test_key",
        RESEND_FROM_EMAIL="Recruiting <recruiting@example.test>",
    )
    @patch("communications.providers.requests.post")
    def test_provider_sends_html_and_records_provider_message_id(self, post):
        response = post.return_value
        response.status_code = 200
        response.ok = True
        response.json.return_value = {"id": "resend-message-1"}

        delivery = ResendEmailProvider().send(
            email="candidate@example.test",
            message="<script>alert('hello')</script>\nInterview details",
        )

        self.assertEqual(delivery, Delivery(provider_message_id="resend-message-1"))
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer re_test_key")
        self.assertEqual(kwargs["json"]["to"], ["candidate@example.test"])
        self.assertEqual(
            kwargs["json"]["html"],
            "<p>&lt;script&gt;alert(&#x27;hello&#x27;)&lt;/script&gt;<br>Interview details</p>",
        )
        self.assertEqual(kwargs["timeout"], 20)

    @override_settings(
        RESEND_API_KEY="re_test_key",
        RESEND_FROM_EMAIL="Recruiting <recruiting@example.test>",
    )
    @patch("communications.providers.requests.post")
    def test_provider_includes_scheduled_at_for_resend(self, post):
        response = post.return_value
        response.status_code = 200
        response.ok = True
        response.json.return_value = {"id": "resend-scheduled-message"}
        scheduled_at = timezone.now() + timedelta(hours=1)

        ResendEmailProvider().send(
            email="candidate@example.test",
            message="Interview details",
            scheduled_at=scheduled_at,
        )

        self.assertEqual(post.call_args.kwargs["json"]["scheduled_at"], scheduled_at.isoformat())


@override_settings(RESEND_WEBHOOK_SECRET="whsec_test")
class ResendWebhookTests(TestCase):
    def setUp(self):
        self.client = JsonClient()
        self.candidate = Candidate.objects.create(
            name="Priya Shah", mobile="+91 9876543210", email="priya@example.com"
        )
        self.communication = Communication.objects.create(
            candidate=self.candidate,
            message="Hello",
            status=Communication.Status.SENT,
            provider_message_id="resend-message-1",
        )

    def test_health_check_confirms_webhook_route_is_reachable(self):
        response = self.client.get("/api/webhooks/resend/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"status": "ok"})

    @patch("communications.views.Webhook")
    def test_scheduled_communication_moves_to_sent_when_resend_sends_it(self, webhook_class):
        scheduled_at = timezone.now() + timedelta(hours=1)
        self.communication.status = Communication.Status.SCHEDULED
        self.communication.scheduled_at = scheduled_at
        self.communication.save(update_fields=("status", "scheduled_at"))
        webhook_class.return_value.verify.return_value = {
            "type": "email.sent",
            "data": {"email_id": "resend-message-1"},
        }

        response = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-scheduled"
        )

        self.assertTrue(response.data["matched"])
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.SENT)
        self.assertEqual(self.communication.scheduled_at, scheduled_at)

    @patch("communications.views.Webhook")
    def test_events_are_verified_deduplicated_and_never_regress_status(self, webhook_class):
        event = {
            "type": "email.delivered",
            "data": {"email_id": "resend-message-1"},
        }
        webhook_class.return_value.verify.return_value = event
        delivered = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-1"
        )
        self.assertEqual(delivered.status_code, 200)
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.DELIVERED)

        duplicate = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-1"
        )
        self.assertTrue(duplicate.data["duplicate"])
        self.assertEqual(WebhookEvent.objects.count(), 1)

        webhook_class.return_value.verify.return_value = {
            "type": "email.sent",
            "data": {"email_id": "resend-message-1"},
        }
        stale = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-2"
        )
        self.assertTrue(stale.data["matched"])
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.DELIVERED)

        webhook_class.return_value.verify.return_value = {
            "type": "email.opened",
            "data": {"email_id": "resend-message-1"},
        }
        opened = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-3"
        )
        self.assertTrue(opened.data["matched"])
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.READ)

        webhook_class.return_value.verify.return_value = {
            "type": "email.bounced",
            "data": {"email_id": "resend-message-1"},
        }
        late_failure = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-4"
        )
        self.assertTrue(late_failure.data["matched"])
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.READ)

    @patch("communications.views.Webhook")
    def test_invalid_signature_is_rejected(self, webhook_class):
        webhook_class.return_value.verify.side_effect = WebhookVerificationError("invalid")
        response = self.client.post("/api/webhooks/resend/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "invalid_signature")
        self.assertEqual(WebhookEvent.objects.count(), 0)

    @patch("communications.views.Webhook")
    def test_unmatched_event_is_not_marked_processed_before_it_can_be_replayed(self, webhook_class):
        event = {
            "type": "email.delivered",
            "data": {"email_id": "resend-message-late"},
        }
        webhook_class.return_value.verify.return_value = event
        first = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-late"
        )
        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.data["matched"])
        self.assertFalse(WebhookEvent.objects.filter(provider_event_id="evt-late").exists())

        self.communication.provider_message_id = "resend-message-late"
        self.communication.save(update_fields=("provider_message_id",))
        replay = self.client.post(
            "/api/webhooks/resend/", {}, format="json", HTTP_SVIX_ID="evt-late"
        )
        self.assertTrue(replay.data["matched"])
        self.communication.refresh_from_db()
        self.assertEqual(self.communication.status, Communication.Status.DELIVERED)
