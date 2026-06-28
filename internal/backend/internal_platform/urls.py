from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(request):
    return JsonResponse({'status': 'ok', 'service': 'internal'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('org_portal.api_urls')),
    path('health/', health),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
