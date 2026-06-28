from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('login/',              views.login_view,           name='login'),
    path('logout/',             views.logout_view,          name='logout'),
    path('register/',           views.register_student,     name='register'),
    path('dashboard/',          views.dashboard,            name='dashboard'),
    path('dashboard/admin/',    views.superadmin_dashboard, name='superadmin_dashboard'),
    path('dashboard/mentor/',   views.mentor_dashboard,     name='mentor_dashboard'),
    path('dashboard/student/',  views.student_dashboard,    name='student_dashboard'),
]
