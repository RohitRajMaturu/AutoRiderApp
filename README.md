# AutoConnect - Ride Connection Platform

A lightweight auto-rickshaw ride connection platform for India.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: Node.js (Serverless Functions)
- **Database**: PostgreSQL (Neon)
- **Authentication**: Built-in system with Email/Password + Role-based Onboarding

## Core Features
- **Passengers**: Request rides, see driver details, track ride history.
- **Drivers**: Register vehicle/license, toggle online/offline status, accept nearby rides.
- **Admin**: Approve/Reject driver applications, manage subscriptions.
- **Subscription Model**: Drivers need an active subscription to go online.

## Getting Started

### 1. Database Setup
The database schema has been automatically created in your Postgres instance.

### 2. Admin Setup
To become an admin for testing:
1. Sign up as a regular user in the app.
2. Call the setup endpoint: `POST /api/admin/setup`.
3. Restart the app to see the Admin Panel.

### 3. Environment Variables
The platform handles core environment variables like `DATABASE_URL`.

## Project Structure
- `/apps/mobile/src`: Expo application code.
- `/apps/web/src/app/api`: Backend serverless functions.
- `/apps/web/src/app/account`: Web-based authentication pages used by the mobile app.

## Design Philosophy
This app follows a "High-Fidelity SaaS" design system, focusing on structural clarity through micro-details, ghost borders, and a clean typographic hierarchy.
