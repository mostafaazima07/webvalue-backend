# Bilingual Task Management System

A comprehensive task management system supporting both Arabic and English interfaces, designed for internal company use.

## Features

### User Management
- Admin-only user registration
- Company domain-restricted login (@thewebvalue.com)
- Role-based access control (Admin/Employee)
- JWT-based authentication with refresh tokens

### Task Management
- Create and assign tasks between employees
- Task status tracking (Not Started, In Progress, Completed)
- Deadline management with reminders
- Private task visibility (users can only see their own tasks)

### Calendar Integration
- Automatic Google Calendar integration
- Microsoft Calendar integration via Graph API
- Task deadline reminders
- Calendar event synchronization

### Email Notifications
- Task assignment notifications
- Deadline reminders
- Status update notifications

### Admin Features
- User management and analytics
- Task overview and monitoring
- Performance scoring system
- Data export capabilities (CSV/Excel)

### Bilingual Support
- Full Arabic and English interface
- RTL/LTR layout support
- Localized date and time formats

## Technical Stack

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- Email integration (Nodemailer)
- Calendar APIs (Google Calendar & Microsoft Graph)

### Security Features
- JWT-based authentication
- Role-based access control
- Rate limiting
- CORS protection
- Secure headers (Helmet)
- Input validation
- Domain-restricted registration

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Docker and Docker Compose
- PostgreSQL (if running locally)

### Environment Setup

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
cd task-management-system
\`\`\`

2. Install dependencies:
\`\`\`bash
cd backend
npm install
\`\`\`

3. Create environment files:
   - Copy \`.env.example\` to \`.env\`
   - Update the environment variables with your configurations

### Running with Docker

1. Start the services:
\`\`\`bash
docker-compose up -d
\`\`\`

2. Initialize the database:
\`\`\`bash
docker-compose exec backend npm run migrate
\`\`\`

### Running Locally

1. Start PostgreSQL database
2. Update environment variables in \`.env\`
3. Run the backend:
\`\`\`bash
npm run dev
\`\`\`

## API Documentation

### Authentication Endpoints
- POST /api/auth/login - User login
- POST /api/auth/refresh-token - Refresh access token
- GET /api/auth/profile - Get user profile

### Task Endpoints
- GET /api/tasks - Get user's tasks
- POST /api/tasks - Create new task
- GET /api/tasks/:id - Get task details
- PATCH /api/tasks/:id/status - Update task status

### Admin Endpoints
- GET /api/admin/users - Get all users
- POST /api/admin/users - Create new user
- GET /api/admin/analytics - Get system analytics
- GET /api/admin/export - Export data

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens with short expiration time
- Refresh token rotation
- Rate limiting on authentication endpoints
- Input validation and sanitization
- Secure HTTP headers
- CORS configuration
- Domain-restricted email validation

## Contributing

1. Create a feature branch
2. Commit your changes
3. Push to the branch
4. Create a Pull Request

## License

This project is proprietary and confidential.
Copyright © 2023 [Company Name]. All rights reserved.
