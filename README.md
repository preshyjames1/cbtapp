### Online CBT Platform

This project is a comprehensive online platform for creating, managing, and taking computer-based tests (CBT). The application is built with React and uses Firebase as a backend for real-time data storage, authentication, and user management.

The platform is designed to support three distinct user roles: **Admin**, **Teacher**, and **Student**, each with specific functionalities.

-----

### Key Features

**For Students:**

  * **Student Dashboard:** View a list of available exams for their registered class.
  * **Exam Taking:** Take timed exams with features like question shuffling, option shuffling, and a live timer.
  * **Results Viewing:** See their score and performance on completed exams.

**For Teachers:**

  * **Exam Creation:** Easily create new exams with different question types (multiple-choice, true/false, short answer).
  * **Question Management:** Manually add questions, bulk upload from a CSV file, or select questions from a centralized question bank.
  * **Exam Status Control:** Manage the lifecycle of exams, including setting them as a `Draft` or submitting them for `Review` by an admin.
  * **View Results:** Access a detailed view of student submissions for their exams.

**For Admins:**

  * **User Management:** Create, edit, and delete user accounts and assign roles (Student, Teacher, Admin).
  * **Full Exam Control:** Publish or withdraw any exam on the platform.
  * **System-wide Reports:** Access analytics and reports on overall performance, total exams, and submissions.
  * **Notifications:** Receive real-time notifications for important events, such as when a teacher submits an exam for review.

-----

### Technology Stack

  * **Frontend:** React, React Router
  * **State Management:** React Context API for authentication
  * **Styling:** Tailwind CSS, PostCSS
  * **Backend:** Firebase (Authentication and Firestore Database)
  * **Icons:** Lucide React
  * **Charting:** Recharts
  * **Build Tool:** Create React App

-----

### Getting Started

To get a local copy up and running, follow these steps.

#### Prerequisites

  * Node.js (version 14 or later)
  * npm or Yarn
  * A Firebase project with Firestore and Authentication enabled. You will need to add your Firebase config to the project.

#### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/preshyjames1/cbtapp.git
    cd cbtapp
    ```

2.  Install NPM packages:

    ```bash
    npm install
    # or
    yarn install
    ```

3.  Configure Firebase:

      * In the Firebase console, create a new project.
      * Enable **Firestore Database** and **Authentication** (using email/password provider).
      * Copy your Firebase project configuration and paste it into `src/services/firebase.js`, replacing the placeholder config.

4.  Run the application:

    ```bash
    npm start
    # or
    yarn start
    ```

The application will be available at `http://localhost:3000`.

-----

### File Structure

The project follows a standard Create React App structure with a few key additions:

```
src/
├── components/          # Reusable components (e.g., Modals, Spinner)
│   ├── common/
│   └── exam/
├── context/             # React Contexts for global state (e.g., AuthContext)
├── pages/               # Main application pages for each route/view
│   ├── AdminDashboard.js
│   ├── AuthComponent.js
│   ├── CreateExam.js
│   ├── EditExam.js
│   ├── ExamManagement.js
│   ├── ExamInstructions.js
│   ├── QuestionBank.js
│   ├── Reports.js
│   ├── StudentDashboard.js
│   ├── TakeExam.js
│   ├── TeacherDashboard.js
│   ├── UserManagement.js
│   └── ViewResults.js
├── services/            # Firebase SDK initialization and utility functions
│   └── firebase.js
├── App.js               # Main App component that handles routing and layout
├── index.js             # Entry point
└── ...
```