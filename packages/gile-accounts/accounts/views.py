from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages

from .forms import StudentRegistrationForm, LoginForm
from .decorators import superadmin_required, mentor_required, student_required, approved_required


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def login_view(request):
    """Login for all roles. Redirects based on role after success."""
    if request.user.is_authenticated:
        return redirect('accounts:dashboard')

    form = LoginForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        username = form.cleaned_data['username']
        password = form.cleaned_data['password']
        user = authenticate(request, username=username, password=password)

        if user is not None:
            # Block unapproved mentors from logging in
            if user.is_mentor and not user.is_approved:
                messages.error(
                    request,
                    "Your mentor account is pending approval. "
                    "Please contact the administrator."
                )
                return render(request, 'accounts/login.html', {'form': form})

            login(request, user)
            messages.success(request, f"Welcome back, {user.username}!")
            return redirect('accounts:dashboard')
        else:
            messages.error(request, "Invalid username or password.")

    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    """Log out any authenticated user."""
    if request.method == 'POST':
        logout(request)
        messages.info(request, "You have been logged out.")
    return redirect('accounts:login')


def register_student(request):
    """Student self-registration. Mentors/admins cannot use this form."""
    if request.user.is_authenticated:
        return redirect('accounts:dashboard')

    form = StudentRegistrationForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, f"Welcome, {user.username}! Your account has been created.")
        return redirect('accounts:dashboard')

    return render(request, 'accounts/register.html', {'form': form})


# ---------------------------------------------------------------------------
# Role-based dashboard dispatcher
# ---------------------------------------------------------------------------

@login_required
@approved_required
def dashboard(request):
    """Redirect to the correct dashboard based on the user's role."""
    user = request.user
    if user.is_superadmin:
        return redirect('accounts:superadmin_dashboard')
    elif user.is_mentor:
        return redirect('accounts:mentor_dashboard')
    else:
        return redirect('accounts:student_dashboard')


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------

@login_required
@approved_required
@superadmin_required
def superadmin_dashboard(request):
    from .models import CustomUser
    from core.models import Assignment
    all_users = CustomUser.objects.all().order_by('role', 'username')
    context = {
        'user': request.user,
        'all_users': all_users,
        'total_students':     all_users.filter(role='student').count(),
        'total_mentors':      all_users.filter(role='mentor').count(),
        'total_assignments':  Assignment.objects.filter(is_active=True).count(),
    }
    return render(request, 'accounts/dashboard_superadmin.html', context)


@login_required
@approved_required
@mentor_required
def mentor_dashboard(request):
    from core.models import MentorProfile, Assignment
    try:
        mentor_profile = request.user.mentor_profile
    except MentorProfile.DoesNotExist:
        mentor_profile = None

    assigned_students = []
    if mentor_profile:
        assigned_students = Assignment.objects.filter(
            mentor=mentor_profile, is_active=True
        ).select_related('student__user')

    context = {
        'user': request.user,
        'mentor_profile': mentor_profile,
        'assigned_students': assigned_students,
    }
    return render(request, 'accounts/dashboard_mentor.html', context)


@login_required
@approved_required
@student_required
def student_dashboard(request):
    from core.models import StudentProfile, Assignment
    try:
        student_profile = request.user.student_profile
    except StudentProfile.DoesNotExist:
        student_profile = None

    assignment = getattr(student_profile, 'assignment', None) if student_profile else None

    context = {
        'user': request.user,
        'student_profile': student_profile,
        'assignment': assignment,
    }
    return render(request, 'accounts/dashboard_student.html', context)
