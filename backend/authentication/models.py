from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta


class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def __str__(self):
        return self.email
    
    class Meta:
        ordering = ['-created_at']


class OTP(models.Model):
    """OTP model for email verification and login"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='otp')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    purpose = models.CharField(
        max_length=20,
        choices=[
            ('signup', 'Sign Up'),
            ('login', 'Login'),
            ('password_reset', 'Password Reset'),
        ],
        default='signup'
    )
    
    def __str__(self):
        return f"OTP for {self.user.email} - {self.purpose}"
    
    def is_expired(self):
        """Check if OTP has expired"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Check if OTP is valid (not expired, not used, attempts < 5)"""
        return not self.is_expired() and not self.is_used and self.attempts < 5
    
    def increment_attempts(self):
        """Increment failed attempts"""
        self.attempts += 1
        self.save()
    
    def mark_as_used(self):
        """Mark OTP as used"""
        self.is_used = True
        self.save()
    
    class Meta:
        ordering = ['-created_at']




