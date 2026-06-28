from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import CustomUser, SSOCode
from .serializers import UserSerializer, UserAdminSerializer, CustomTokenObtainPairSerializer


def _issue_tokens(user):
    """Return {access, refresh, user} dict for a given user."""
    refresh = CustomTokenObtainPairSerializer.get_token(user)
    return {
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user':    UserSerializer(user).data,
    }


# ── Auth ──────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    data       = request.data
    username   = data.get('username', '').strip()
    email      = data.get('email', '').strip()
    password   = data.get('password', '')
    password2  = data.get('password2', '')
    first_name = data.get('first_name', '').strip()
    last_name  = data.get('last_name', '').strip()

    errors = {}

    if not username:
        errors['username'] = 'Username is required.'
    elif CustomUser.objects.filter(username__iexact=username).exists():
        errors['username'] = 'That username is already taken.'

    if not email:
        errors['email'] = 'Email is required.'
    elif CustomUser.objects.filter(email__iexact=email).exists():
        errors['email'] = 'An account with that email already exists.'

    if not password:
        errors['password'] = 'Password is required.'
    elif password != password2:
        errors['password2'] = 'Passwords do not match.'
    else:
        try:
            validate_password(password)
        except ValidationError as e:
            errors['password'] = list(e.messages)

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    user = CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role='student',
        is_approved=True,
    )
    return Response(_issue_tokens(user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)

    if user.role == 'mentor' and not user.is_approved:
        return Response(
            {'detail': 'Your mentor account is pending approval.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(_issue_tokens(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_logout(request):
    refresh_token = request.data.get('refresh')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_me(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_update_settings(request):
    allowed = {'message_permission', 'theme_color', 'font_style'}
    data = {k: v for k, v in request.data.items() if k in allowed}
    valid_perms = {CustomUser.MSG_OPEN, CustomUser.MSG_REQUEST}
    if 'message_permission' in data and data['message_permission'] not in valid_perms:
        return Response({'detail': 'Invalid message_permission value.'}, status=status.HTTP_400_BAD_REQUEST)
    for attr, value in data.items():
        setattr(request.user, attr, value)
    request.user.save(update_fields=list(data.keys()))
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_change_password(request):
    current_password = request.data.get('current_password', '').strip()
    new_password     = request.data.get('new_password', '').strip()

    if not current_password or not new_password:
        return Response(
            {'detail': 'Both current_password and new_password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not request.user.check_password(current_password):
        return Response(
            {'detail': 'Current password is incorrect.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        validate_password(new_password, request.user)
    except ValidationError as e:
        return Response({'detail': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    # Re-issue tokens so the caller stays logged in with fresh credentials
    return Response(_issue_tokens(request.user))


# ── User management (superadmin only) ─────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_users_list(request):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        users = CustomUser.objects.all().order_by('role', 'username')
        return Response(UserAdminSerializer(users, many=True).data)

    data       = request.data
    username   = data.get('username', '').strip()
    email      = data.get('email', '').strip()
    password   = data.get('password', '')
    first_name = data.get('first_name', '').strip()
    last_name  = data.get('last_name', '').strip()

    errors = {}
    if not username:
        errors['username'] = 'Username is required.'
    elif CustomUser.objects.filter(username__iexact=username).exists():
        errors['username'] = 'That username is already taken.'

    if not email:
        errors['email'] = 'Email is required.'
    elif CustomUser.objects.filter(email__iexact=email).exists():
        errors['email'] = 'An account with that email already exists.'

    if not password:
        errors['password'] = 'Password is required.'
    else:
        try:
            validate_password(password)
        except ValidationError as e:
            errors['password'] = list(e.messages)

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    mentor = CustomUser.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role='mentor',
        is_approved=False,
    )
    return Response(UserAdminSerializer(mentor).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_user_detail(request, pk):
    if request.user.role != 'superadmin':
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
    user = get_object_or_404(CustomUser, pk=pk)
    serializer = UserAdminSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ── CSRF stub (kept for backwards compat, now a no-op) ────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def api_csrf(request):
    return Response({'detail': 'ok.'})


# ── SSO ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_sso_init(request):
    """
    Issue a single-use, 30-second SSO code for the authenticated user.
    Called by the public portal before redirecting to the internal portal.
    """
    user = request.user
    if not (user.has_internal_access or user.role == 'superadmin'):
        return Response({'detail': 'No internal portal access.'}, status=status.HTTP_403_FORBIDDEN)

    code = SSOCode.create_for(user)
    return Response({'code': str(code.id)})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_sso_exchange(request):
    """
    Exchange a single-use SSO code for a fresh access + refresh token pair.
    Called by the internal portal's callback page.
    """
    code_str = request.data.get('code', '').strip()
    if not code_str:
        return Response({'detail': 'code is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        code = SSOCode.objects.select_related('user').get(pk=code_str)
    except (SSOCode.DoesNotExist, ValueError):
        return Response({'detail': 'Invalid SSO code.'}, status=status.HTTP_400_BAD_REQUEST)

    if not code.is_valid:
        return Response({'detail': 'SSO code has expired or already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    # Mark used before issuing tokens — prevents race-condition double-use
    code.used = True
    code.save(update_fields=['used'])

    return Response(_issue_tokens(code.user))
