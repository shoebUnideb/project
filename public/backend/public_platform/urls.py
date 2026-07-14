from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.views.static import serve


def health(request):
    return JsonResponse({'status': 'ok', 'service': 'public'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    path('health/', health),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
