"""
Management command: send_task_reminders

Sends due-date reminder notifications to students whose task submissions are
approaching their deadline (48 h and 24 h windows).  Run via cron or a
scheduler (e.g. Render Cron Job, Heroku Scheduler) once per hour:

    python manage.py send_task_reminders

Each reminder is sent at most once per window (tracked by reminder_48h_sent /
reminder_24h_sent on WorkspaceTaskSubmission) so duplicate runs are safe.
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import WorkspaceTaskSubmission, Notification


class Command(BaseCommand):
    help = 'Send 48h and 24h due-date reminders for workspace tasks.'

    def handle(self, *args, **options):
        now   = timezone.now()
        today = now.date()

        # Incomplete submissions with a due date (task-level or per-submission override)
        active_qs = WorkspaceTaskSubmission.objects.select_related(
            'task__workspace', 'student__user',
        ).exclude(status__in=['completed'])

        sent_48 = sent_24 = 0

        for sub in active_qs:
            due = sub.effective_due_date  # uses property (override or task.due_date)
            if not due:
                continue

            days_left = (due - today).days

            if days_left == 2 and not sub.reminder_48h_sent:
                self._send(sub, '48 hours')
                sub.reminder_48h_sent = True
                sub.save(update_fields=['reminder_48h_sent'])
                sent_48 += 1

            elif days_left == 1 and not sub.reminder_24h_sent:
                self._send(sub, '24 hours')
                sub.reminder_24h_sent = True
                sub.save(update_fields=['reminder_24h_sent'])
                sent_24 += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done — 48h reminders: {sent_48}, 24h reminders: {sent_24}'
            )
        )

    def _send(self, submission, window: str):
        task = submission.task
        Notification.objects.create(
            recipient=submission.student.user,
            notif_type='task_reminder',
            title=f'Reminder: "{task.title}" is due in {window}',
            body=f'Your task in {task.workspace.name} is due soon. Make sure to submit on time.',
            link=f'/w/{task.workspace.slug}/tasks/{task.id}',
        )
