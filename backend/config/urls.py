from django.urls import path

from communications import views

urlpatterns = [
    path("api/candidates/", views.candidates, name="candidates"),
    path(
        "api/candidates/<uuid:candidate_id>/",
        views.candidate_detail,
        name="candidate-detail",
    ),
    path(
        "api/candidates/<uuid:candidate_id>/history/",
        views.candidate_history,
        name="candidate-history",
    ),
    path("api/templates/", views.templates, name="templates"),
    path(
        "api/templates/<uuid:template_id>/",
        views.template_detail,
        name="template-detail",
    ),
    path("api/communications/send/", views.send_messages, name="send-messages"),
    path(
        "api/communications/<uuid:communication_id>/retry/",
        views.retry_communication,
        name="retry-communication",
    ),
    path("api/webhooks/resend/", views.resend_webhook, name="resend-webhook"),
]
