from django import forms
from .models import StudentProfile, MentorProfile, Message


class StudentProfileForm(forms.ModelForm):
    class Meta:
        model  = StudentProfile
        fields = ('bio', 'phone', 'linkedin_url', 'profile_picture')
        widgets = {
            'bio': forms.Textarea(attrs={'class': 'form-input', 'rows': 4, 'placeholder': 'Tell us about yourself…'}),
            'phone': forms.TextInput(attrs={'class': 'form-input', 'placeholder': '+1 234 567 8900'}),
            'linkedin_url': forms.URLInput(attrs={'class': 'form-input', 'placeholder': 'https://linkedin.com/in/…'}),
            'profile_picture': forms.ClearableFileInput(attrs={'class': 'form-input'}),
        }


class MentorProfileForm(forms.ModelForm):
    class Meta:
        model  = MentorProfile
        fields = ('bio', 'expertise', 'phone', 'linkedin_url', 'profile_picture')
        widgets = {
            'bio': forms.Textarea(attrs={'class': 'form-input', 'rows': 4, 'placeholder': 'Your background and approach…'}),
            'expertise': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'e.g. Web Development, Data Science'}),
            'phone': forms.TextInput(attrs={'class': 'form-input', 'placeholder': '+1 234 567 8900'}),
            'linkedin_url': forms.URLInput(attrs={'class': 'form-input', 'placeholder': 'https://linkedin.com/in/…'}),
            'profile_picture': forms.ClearableFileInput(attrs={'class': 'form-input'}),
        }


class MessageForm(forms.ModelForm):
    class Meta:
        model   = Message
        fields  = ('body',)
        widgets = {
            'body': forms.Textarea(attrs={
                'class': 'form-input',
                'rows': 3,
                'placeholder': 'Type your message…',
            }),
        }
        labels = {'body': ''}
