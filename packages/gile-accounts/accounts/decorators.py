from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages


def superadmin_required(view_func):
    """Restrict access to superadmin users only."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        if not request.user.is_superadmin:
            messages.error(request, "Access denied. Superadmin only.")
            return redirect('accounts:dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper


def mentor_required(view_func):
    """Restrict access to mentor users only."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        if not request.user.is_mentor:
            messages.error(request, "Access denied. Mentors only.")
            return redirect('accounts:dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper


def student_required(view_func):
    """Restrict access to student users only."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        if not request.user.is_student:
            messages.error(request, "Access denied. Students only.")
            return redirect('accounts:dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper


def approved_required(view_func):
    """Block unapproved users (mainly unapproved mentors)."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        if not request.user.is_approved:
            messages.error(request, "Your account is pending approval. Please contact the administrator.")
            return redirect('accounts:login')
        return view_func(request, *args, **kwargs)
    return wrapper
