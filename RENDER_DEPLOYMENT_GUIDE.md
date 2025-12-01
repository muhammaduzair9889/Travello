# 🚀 Render Deployment Guide - Travello Backend

## Prerequisites
- GitHub account with your Travello repo
- Render account (free tier works): https://render.com

---

## Step-by-Step Deployment

### Step 1: Update Backend Settings for Production

**File: `backend/travello_backend/travello_backend/settings.py`**

Add this at the top (after imports):
```python
import dj_database_url
```

Update these settings:
```python
# DEBUG
DEBUG = config('DEBUG', default=False, cast=bool)

# ALLOWED_HOSTS
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Add Render host
if 'RENDER' in os.environ:
    ALLOWED_HOSTS.append(os.environ.get('RENDER_EXTERNAL_HOSTNAME'))

# DATABASES - Use PostgreSQL on Render
if 'DATABASE_URL' in os.environ:
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600
        )
    }
else:
    # Keep SQLite for local development
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR.parent / 'db.sqlite3',
        }
    }
```

---

### Step 2: Update requirements.txt

Add these packages:
```bash
cd backend
```

Add to `requirements.txt`:
```
gunicorn==21.2.0
dj-database-url==2.1.0
psycopg2-binary==2.9.9
whitenoise==6.6.0
```

Your complete `requirements.txt`:
```
Django==4.2.7
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.0
django-cors-headers==4.3.1
requests==2.31.0
python-decouple==3.8
openai==1.3.0
PyMySQL==1.1.0
cryptography==41.0.7
gunicorn==21.2.0
dj-database-url==2.1.0
psycopg2-binary==2.9.9
whitenoise==6.6.0
```

---

### Step 3: Create Build Script

**File: `backend/build.sh` (already created)**
```bash
#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
```

Make it executable:
```bash
git add backend/build.sh
git update-index --chmod=+x backend/build.sh
```

---

### Step 4: Enable WhiteNoise for Static Files

**File: `backend/travello_backend/travello_backend/settings.py`**

Update MIDDLEWARE (add WhiteNoise after SecurityMiddleware):
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add this
    'django.contrib.sessions.middleware.SessionMiddleware',
    # ... rest of middleware
]
```

Add at the end of settings.py:
```python
# Static files (WhiteNoise)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

---

### Step 5: Push to GitHub

```bash
cd "D:\Travello Project\Travello Project"
git add .
git commit -m "feat: configure backend for Render deployment"
git push origin main
```

---

## Step 6: Deploy on Render

### 6.1 Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Settings:
   - **Name**: `travello-db`
   - **Database**: `travello`
   - **User**: `travello`
   - **Region**: Choose closest to your users
   - **Plan**: Free
4. Click **"Create Database"**
5. **Wait 2-3 minutes** for database to be ready

---

### 6.2 Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (authorize if needed)
3. Select **"Travello"** repository

**Settings:**
- **Name**: `travello-backend`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: `backend`
- **Environment**: `Python 3`
- **Build Command**: `./build.sh`
- **Start Command**: `gunicorn travello_backend.travello_backend.wsgi:application`
- **Plan**: Free

---

### 6.3 Add Environment Variables

Click **"Environment"** tab and add:

```
DATABASE_URL = [Auto-filled from database connection]
SECRET_KEY = [Generate random string: use https://djecrety.ir/]
DEBUG = False
ALLOWED_HOSTS = your-app-name.onrender.com
PYTHON_VERSION = 3.11.0
RECAPTCHA_SECRET_KEY = 6Lc1nd0rAAAAAEGQ49HpLRq8kFj1CVPoC1-leNOd
OPENAI_API_KEY = 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
```

**To connect database:**
1. Scroll to **"Add Environment Variable"**
2. Click **"Add from database"**
3. Select `travello-db`
4. Choose `DATABASE_URL`

---

### 6.4 Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for first deployment
3. Watch build logs for errors

---

### Step 7: Create Superuser (Admin)

After deployment succeeds:

1. Go to your service → **"Shell"** tab
2. Run:
```bash
python manage.py createsuperuser
```

Follow prompts:
- Email: `admin@travello.com`
- Password: `admin123` (or your choice)

---

### Step 8: Update Frontend API URL

**File: `frontend/.env.production`**
```
REACT_APP_API_URL=https://your-app-name.onrender.com/api
```

Replace `your-app-name` with your actual Render URL.

---

### Step 9: Update CORS Settings

**File: `backend/travello_backend/travello_backend/settings.py`**

```python
# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-frontend-url.vercel.app",  # Add your Vercel URL
]

CORS_ALLOW_CREDENTIALS = True
```

Commit and push:
```bash
git add .
git commit -m "feat: add frontend URL to CORS"
git push origin main
```

Render will auto-deploy!

---

## Verification

Test your backend:
- **API Root**: https://your-app-name.onrender.com/api/
- **Admin Panel**: https://your-app-name.onrender.com/admin/
- **Hotels**: https://your-app-name.onrender.com/api/hotels/
- **Login**: https://your-app-name.onrender.com/api/login/

---

## Troubleshooting

### Build Fails

**Check logs in Render dashboard:**
- Click your service → **"Logs"** tab
- Look for errors

**Common issues:**
1. **Module not found**: Add missing package to `requirements.txt`
2. **Permission denied on build.sh**: Run `git update-index --chmod=+x backend/build.sh`
3. **Database connection fails**: Check `DATABASE_URL` is set correctly

---

### Static Files Not Loading

Run in Shell:
```bash
python manage.py collectstatic --no-input
```

---

### Database Migration Issues

Run in Shell:
```bash
python manage.py migrate --run-syncdb
```

---

### Service Won't Start

Check:
1. `ALLOWED_HOSTS` includes your Render hostname
2. `DEBUG = False` in environment variables
3. `gunicorn` is in requirements.txt

---

## Free Tier Limitations

- **Spins down after 15 minutes of inactivity**
- **First request after sleep takes 30-60 seconds**
- **750 hours/month free** (enough for 1 service)

**Solution**: Use cron job to keep alive or upgrade to paid plan ($7/month).

---

## Keep Alive (Optional)

Use cron-job.org or UptimeRobot to ping your backend every 10 minutes:
```
https://your-app-name.onrender.com/api/hotels/
```

---

## Your Backend URL

After deployment, your backend will be:
```
https://travello-backend.onrender.com
```

Use this URL in your frontend `.env.production`!

---

## Summary Checklist

- [ ] Updated `settings.py` for production
- [ ] Added production packages to `requirements.txt`
- [ ] Created `build.sh` script
- [ ] Enabled WhiteNoise for static files
- [ ] Pushed code to GitHub
- [ ] Created PostgreSQL database on Render
- [ ] Created Web Service on Render
- [ ] Added environment variables
- [ ] Created superuser via Shell
- [ ] Updated frontend API URL
- [ ] Updated CORS settings
- [ ] Tested all API endpoints

---

**Your Travello backend is now live on Render! 🎉**
