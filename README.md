# Travello Project

A full-stack travel application built with React (frontend) and Django REST Framework (backend).

## Features

### Frontend (React)
- **Landing Page**: Beautiful landing page with Travello branding and call-to-action
- **Authentication**: Login and Signup pages with form validation
- **reCAPTCHA Integration**: Spam protection using Google reCAPTCHA v2
- **Responsive Design**: Built with Tailwind CSS for modern, responsive UI
- **JWT Authentication**: Secure token-based authentication
- **React Router**: Client-side routing between pages

### Backend (Django + DRF)
- **JWT Authentication**: Using django-rest-framework-simplejwt
- **User Management**: Custom User model with email as username
- **reCAPTCHA Validation**: Server-side verification with Google's API
- **CORS Support**: Configured for React frontend communication
- **RESTful APIs**: Clean API endpoints for authentication

## Project Structure

```
Travello Project/
├── backend/
│   ├── travello_backend/
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── authentication/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── views.py
│   │   └── tests.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/
│   │   ├── components/
│   │   │   ├── Landing.js
│   │   │   ├── Login.js
│   │   │   └── Signup.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd "Travello Project/backend"
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run database migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

4. Create a superuser (optional):
   ```bash
   python manage.py createsuperuser
   ```

5. Start the Django development server:
   ```bash
   python manage.py runserver
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd "Travello Project/frontend"
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

### reCAPTCHA Configuration

1. Go to [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Create a new site with reCAPTCHA v2
3. Add your domain (localhost for development)
4. Update the following files with your keys:

**Backend** (`travello_backend/settings.py`):
```python
RECAPTCHA_SECRET_KEY = 'your-secret-key-here'
RECAPTCHA_SITE_KEY = 'your-site-key-here'
```

**Frontend** (`src/components/Login.js` and `src/components/Signup.js`):
```javascript
<ReCAPTCHA
  sitekey="your-site-key-here"
  onChange={handleRecaptchaChange}
/>
```

## API Endpoints

### Authentication
- `POST /api/signup/` - User registration
- `POST /api/login/` - User login
- `POST /api/verify-captcha/` - reCAPTCHA verification

### Request/Response Examples

#### Signup
```bash
POST /api/signup/
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123",
  "recaptcha_token": "recaptcha_token_here"
}
```

#### Login
```bash
POST /api/login/
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123",
  "recaptcha_token": "recaptcha_token_here"
}
```

#### Response (Both endpoints)
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "first_name": "",
    "last_name": "",
    "date_joined": "2023-01-01T00:00:00Z"
  },
  "tokens": {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }
}
```

## Development Notes

### Security Considerations
- Change the `SECRET_KEY` in production
- Use environment variables for sensitive data
- Enable HTTPS in production
- Configure proper CORS origins for production

### Environment Variables
Create a `.env` file in the backend directory:
```
SECRET_KEY=your-secret-key-here
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
RECAPTCHA_SITE_KEY=your-recaptcha-site-key
DEBUG=True
```

### Database
The project uses SQLite by default. For production, consider using PostgreSQL or MySQL.

## Next Steps (Phase 2)

- User dashboard
- Trip planning features
- Destination management
- Social features
- Payment integration
- Mobile app development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.




