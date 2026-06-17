# edu-guide: An Intelligent Educational Platform with Real-Time Chat and AI-Powered Prompts

## Overview

edu-guide is a modern web application designed to provide users with an intelligent, interactive educational experience. The platform allows users to engage with AI-powered prompts, participate in real-time chat sessions, and access educational resources through a seamless interface.

The system integrates user authentication, real-time messaging, and cloud-based storage to deliver a secure and responsive learning environment. edu-guide is designed for educators, students, and learners seeking an efficient and modern approach to online education.

---

## Key Features

### User Authentication

* Secure user registration and sign-in
* User account and session management
* Personalized user profiles

### AI-Powered Prompts

* Access interactive educational prompts
* Real-time prompt responses
* Customizable learning paths

### Real-Time Chat

* Instantaneous messaging between users
* Chat session management
* Message history and retrieval

### Session Management

* Create and manage chat sessions
* Track conversation history
* Organize learning sessions

### File Upload & Storage

* Upload educational resources
* Secure file management
* Cloud-based storage integration

---

## Technology Stack

### Frontend

* Next.js
* React
* JavaScript (JSConfig)
* CSS (PostCSS, Tailwind)

### Backend

* Next.js API Routes
* Node.js

### Authentication & Database

* Supabase Authentication
* Supabase Firestore
* Supabase Cloud Functions

### Development Tools

* VS Code
* Git & GitHub
* ESLint
* Node Package Manager (npm)

---

## System Workflow

User Registration → Authentication → Access Dashboard → Select Prompts or Chat → Interact with AI → View History → Manage Sessions

The platform automatically synchronizes user data and chat history in real time to ensure consistent experience across sessions.

---

## Installation Guide

### Clone the Repository

```bash
git clone https://github.com/MTFrontera/edu-guide-ph.git
cd edu-guide-ph
```

### Install Dependencies

```bash
npm install
```

### Configure Supabase

Add your Supabase credentials to `lib/supabase.js`:

```javascript
const supabaseUrl = 'your-supabase-url'
const supabaseAnonKey = 'your-supabase-anon-key'
```

For guided setup, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

### Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## User Roles

### Student/Learner

The user can:

* Register and sign in securely
* Access AI-powered educational prompts
* Participate in real-time chat sessions
* Upload and manage educational files
* View chat and session history
* Track learning progress

---

## Application Structure

### Pages

* `/` - Home page
* `/register` - User registration
* `/login` - User login
* `/prompt` - AI prompt interface

### API Routes

* `/api/chat` - Chat message handling
* `/api/chat/messages` - Message retrieval and storage
* `/api/chat/sessions` - Session management

### Libraries

* `lib/supabase.js` - Supabase client configuration
* `lib/serverAuth.js` - Server-side authentication
* `lib/apiSupabase.js` - Supabase API utilities

---

## Database Collections

### users

Stores user account information and authentication details.

### chat_sessions

Stores chat session records, timestamps, and session metadata.

### chat_messages

Stores individual messages, sender information, and message timestamps.

### prompts

Stores AI prompts, categories, and response data.

---

## Future Enhancements

* Advanced analytics dashboard
* User progress tracking
* Multiple AI model support
* Video integration for lessons
* Community forums
* Mobile application
* Offline mode support
* Advanced reporting features

---

## Developers

Project Contributors - Elijah Drex, Garri B. Nakano, Mark Tristan B. Fronteras

Educational Technology Development

2026
