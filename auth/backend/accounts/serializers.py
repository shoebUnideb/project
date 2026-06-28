from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import CustomUser


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username']            = user.username
        token['email']               = user.email
        token['first_name']          = user.first_name
        token['last_name']           = user.last_name
        token['role']                = user.role
        token['is_approved']         = user.is_approved
        token['has_internal_access'] = user.has_internal_access
        token['onboarding_complete'] = user.onboarding_complete
        token['message_permission']  = user.message_permission
        token['theme_color']         = user.theme_color
        token['font_style']          = user.font_style
        return token


class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'is_approved', 'onboarding_complete', 'first_name', 'last_name', 'message_permission', 'theme_color', 'font_style', 'profile_picture', 'has_internal_access']
        read_only_fields = ['id', 'role', 'is_approved', 'onboarding_complete', 'has_internal_access']

    def get_profile_picture(self, obj):
        pic = None
        if obj.role == 'student' and hasattr(obj, 'student_profile'):
            pic = obj.student_profile.profile_picture
        elif obj.role == 'mentor' and hasattr(obj, 'mentor_profile'):
            pic = obj.mentor_profile.profile_picture
        return pic.url if pic else None


class UserAdminSerializer(serializers.ModelSerializer):
    """Full serializer for superadmin use."""
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'role', 'is_approved', 'first_name', 'last_name',
                  'is_active', 'date_joined', 'message_permission']
