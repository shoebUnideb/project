"""
Management command to send deadline reminder notifications for workspace tasks.
Run via cron: ./venv/bin/python manage.py send_deadline_reminders
Recommended schedule: once daily (e.g. 8am).
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from core.models import WorkspaceTask, WorkspaceTaskSubmission, Notification


class Command(BaseCommand):
    help = 'Send in-app notifications for workspace tasks due in 1 or 3 days'

    def handle(self, *args, **options):
        today = timezone.localdate()
        remind_on = {today + timedelta(days=1), today + timedelta(days=3)}

        tasks = WorkspaceTask.objects.filter(
            due_date__in=remind_on,
            status='published',
        ).select_related('workspace')

        created = 0
        for task in tasks:
            days_left = (task.due_date - today).days
            label = 'tomorrow' if days_left == 1 else 'in 3 days'

            submissions = WorkspaceTaskSubmission.objects.filter(
                task=task,
                status__in=['not_started', 'in_progress'],
            ).select_related('student__user')

            for sub in submissions:
                student = sub.student.user
                already = Notification.objects.filter(
                    recipient=student,
                    notif_type=Notification.TYPE_DEADLINE,
                    link=f'/w/{task.workspace.slug}/tasks/{task.id}',
                    created_at__date=today,
                ).exists()
                if already:
                    continue

                Notification.objects.create(
                    recipient=student,
                    notif_type=Notification.TYPE_DEADLINE,
                    title=f'Deadline {label}: {task.title}',
                    body=task.workspace.name,
                    link=f'/w/{task.workspace.slug}/tasks/{task.id}',
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} deadline reminder notification(s).'))
