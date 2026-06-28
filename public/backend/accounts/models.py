from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from django.utils import timezone
from datetime import timedelta


class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('superadmin', 'Superadmin'),
        ('mentor', 'Mentor'),
        ('student', 'Student'),
    )
    MSG_OPEN    = 'open'
    MSG_REQUEST = 'request_required'
    MSG_CHOICES = [
        (MSG_OPEN,    'Anyone can message me'),
        (MSG_REQUEST, 'Contact request required'),
    ]

    role                = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    is_approved         = models.BooleanField(default=False)
    onboarding_complete = models.BooleanField(default=False)
    is_deleted         = models.BooleanField(default=False)
    deleted_at         = models.DateTimeField(null=True, blank=True)
    message_permission = models.CharField(max_length=20, choices=MSG_CHOICES, default=MSG_OPEN)
    theme_color           = models.CharField(max_length=30, default='aubergine')
    font_style            = models.CharField(max_length=50, default='lato')
    has_internal_access   = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_superadmin(self):
        return self.role == 'superadmin'

    @property
    def is_mentor(self):
        return self.role == 'mentor'

    @property
    def is_student(self):
        return self.role == 'student'


class SSOCode(models.Model):
    """Single-use, short-lived code for cross-portal SSO handoff."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sso_codes')
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    TTL_SECONDS = 30

    class Meta:
        indexes = [models.Index(fields=['expires_at'])]

    @classmethod
    def create_for(cls, user):
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(seconds=cls.TTL_SECONDS),
        )

    @property
    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at
