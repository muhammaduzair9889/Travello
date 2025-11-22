# Travello API Documentation

## Base URL
```
http://localhost:8000/api/
```

## Authentication
The API uses JWT (JSON Web Token) authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. User Registration

**POST** `/signup/`

Register a new user account.

#### Request Body
```json
{
  "username": "string (required)",
  "email": "string (required, unique)",
  "password": "string (required, min 8 characters)",
  "password_confirm": "string (required, must match password)",
  "recaptcha_token": "string (required)"
}
```

#### Response
**Success (201 Created)**
```json
{
  "message": "User created successfully",
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

**Error (400 Bad Request)**
```json
{
  "error": "User with this email already exists"
}
```

### 2. User Login

**POST** `/login/`

Authenticate user and return JWT tokens.

#### Request Body
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "recaptcha_token": "string (required)"
}
```

#### Response
**Success (200 OK)**
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

**Error (400 Bad Request)**
```json
{
  "error": "Invalid credentials"
}
```

### 3. reCAPTCHA Verification

**POST** `/verify-captcha/`

Verify reCAPTCHA token with Google's API.

#### Request Body
```json
{
  "token": "string (required)"
}
```

#### Response
**Success (200 OK)**
```json
{
  "valid": true
}
```

**Error (400 Bad Request)**
```json
{
  "error": "Token is required"
}
```

## Error Responses

### Common Error Codes

- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: Valid token but insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

### Error Response Format
```json
{
  "error": "Error message description",
  "field_errors": {
    "field_name": ["Specific field error message"]
  }
}
```

## JWT Token Details

### Access Token
- **Lifetime**: 60 minutes
- **Usage**: Include in Authorization header for authenticated requests
- **Format**: `Bearer <access_token>`

### Refresh Token
- **Lifetime**: 7 days
- **Usage**: Obtain new access tokens when current one expires
- **Endpoint**: `/api/token/refresh/` (provided by django-rest-framework-simplejwt)

### Token Refresh Example
```bash
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "your_refresh_token_here"
}
```

## Frontend Integration Examples

### JavaScript/React Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Login function
const login = async (email, password, recaptchaToken) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login/`, {
      email,
      password,
      recaptcha_token: recaptchaToken
    });
    
    // Store tokens
    localStorage.setItem('access_token', response.data.tokens.access);
    localStorage.setItem('refresh_token', response.data.tokens.refresh);
    
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Signup function
const signup = async (userData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/signup/`, userData);
    
    // Store tokens
    localStorage.setItem('access_token', response.data.tokens.access);
    localStorage.setItem('refresh_token', response.data.tokens.refresh);
    
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Authenticated request example
const getProfile = async () => {
  const token = localStorage.getItem('access_token');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/profile/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};
```

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:8000/api/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpassword123",
    "password_confirm": "testpassword123",
    "recaptcha_token": "test_token"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "recaptcha_token": "test_token"
  }'
```

### Authenticated Request
```bash
curl -X GET http://localhost:8000/api/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider implementing rate limiting to prevent abuse.

## CORS Configuration

The API is configured to accept requests from:
- `http://localhost:3000` (React development server)
- `http://127.0.0.1:3000`

For production, update the `CORS_ALLOWED_ORIGINS` setting in Django settings.




