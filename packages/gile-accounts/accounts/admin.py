from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Admin configuration for CustomUser.
    Superadmin can create mentors here by setting role=mentor and is_approved=True.
    """

    # Columns shown in the list view
    list_display = ('username', 'email', 'role', 'is_approved', 'has_internal_access', 'is_active', 'date_joined')
    list_filter = ('role', 'is_approved', 'has_internal_access', 'is_active')
    search_fields = ('username', 'email')
    ordering = ('role', 'username')

    # Inline editing from the list
    list_editable = ('is_approved', 'has_internal_access')

    # Fieldsets for the change/edit form – extend base UserAdmin fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Role & Approval', {
            'fields': ('role', 'is_approved', 'has_internal_access'),
        }),
    )

    # Fieldsets for the add/create form
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role & Approval', {
            'fields': ('role', 'is_approved', 'has_internal_access'),
        }),
    )
