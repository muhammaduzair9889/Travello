import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

try:
    admin = User.objects.get(username='admin')
    admin.email = 'admin@travello.com'
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()
    
    print("=" * 60)
    print("✅ Admin account updated successfully!")
    print("=" * 60)
    print(f"Username: {admin.username}")
    print(f"Email: {admin.email}")
    print(f"Is Staff: {admin.is_staff}")
    print(f"Is Superuser: {admin.is_superuser}")
    print("=" * 60)
    print("\n🔐 Login Credentials:")
    print("Email: admin@travello.com")
    print("Password: admin123")
    print("=" * 60)
except User.DoesNotExist:
    print("❌ Admin user not found!")
