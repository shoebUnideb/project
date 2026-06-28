from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from . import api_views

urlpatterns = [
    path('csrf/',            api_views.api_csrf,            name='api_csrf'),
    path('register/',        api_views.api_register,        name='api_register'),
    path('login/',           api_views.api_login,           name='api_login'),
    path('logout/',          api_views.api_logout,          name='api_logout'),
    path('me/',              api_views.api_me,              name='api_me'),
    path('settings/',        api_views.api_update_settings, name='api_update_settings'),
    path('change-password/', api_views.api_change_password, name='api_change_password'),
    path('users/',           api_views.api_users_list,      name='api_users_list'),
    path('users/<int:pk>/',  api_views.api_user_detail,     name='api_user_detail'),
    path('token/refresh/',   TokenRefreshView.as_view(),    name='token_refresh'),
    path('token/verify/',    TokenVerifyView.as_view(),     name='token_verify'),
    path('sso/init/',        api_views.api_sso_init,        name='api_sso_init'),
    path('sso/exchange/',    api_views.api_sso_exchange,    name='api_sso_exchange'),
]

