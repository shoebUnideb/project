from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # ── Profiles
    path('profile/student/',                  views.student_profile_view,      name='student_profile'),
    path('profile/mentor/',                   views.mentor_profile_view,       name='mentor_profile'),
    path('students/<int:student_id>/profile/', views.mentor_view_student,      name='view_student_profile'),

    # ── Chat (Mentor ↔ Admin)
    path('chat/',                             views.chat_with_admin,           name='chat_with_admin'),
    path('chat/inbox/',                       views.chat_inbox,                name='chat_inbox'),
    path('chat/<int:mentor_id>/',             views.chat_thread_admin,         name='chat_thread_admin'),
]
