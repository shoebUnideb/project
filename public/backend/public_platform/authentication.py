from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class RevokedTokenAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        validated = super().get_validated_token(raw_token)
        if cache.get(f'revoked:{validated["jti"]}'):
            raise InvalidToken('Token has been revoked.')
        return validated
