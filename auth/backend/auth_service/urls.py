from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({'status': 'ok', 'service': 'auth'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts_api.api_urls')),
    path('health/', health),
]
