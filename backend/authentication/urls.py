from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('admin/login/', views.admin_login, name='admin_login'),
    path('verify-captcha/', views.verify_captcha, name='verify_captcha'),
    path('chat/', views.chat, name='chat'),
]




