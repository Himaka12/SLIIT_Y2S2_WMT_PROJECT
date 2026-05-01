# Wheelzy Mobile App

React Native mobile application for the K.D. Auto Traders / Wheelzy vehicle rental and sales platform. This app is built with Expo and connects to the Express + MongoDB backend in `vehicle-express`.

## Main Features

- Vehicle browsing with rental and sales vehicle details
- Customer registration and login with JWT session storage
- Role-based navigation for guests, customers, admins, and marketing managers
- Vehicle wishlist, sales inquiries, rental bookings, and refund claims
- Admin vehicle, booking, refund, user, review, and marketing management screens
- Promotion banners and active promotion display
- Multipart image/file uploads for vehicle images, payment slips, promo images, profile images, and refund proof
- Review and rating flows with backend AI sentiment support

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Expo + React Native |
| Language | JavaScript |
| Navigation | React Navigation |
| API client | Axios |
| Session storage | AsyncStorage / Expo SecureStore |
| Media picker | Expo Image Picker |
| Styling | React Native StyleSheet |

## Project Structure

```text
VehicleApp/
|-- App.js
|-- app.json
|-- package.json
|-- .env.example
|-- assets/
|-- src/
|   |-- api/                 # Axios client and backend API functions
|   |-- components/          # Shared UI and feature components
|   |-- constants/           # Theme tokens
|   |-- context/             # Auth and app alert context providers
|   |-- navigation/          # Root navigator and role-based navigation
|   |-- screens/
|   |   |-- admin/           # Admin and marketing screens
|   |   |-- auth/            # Login, register, and password screens
|   |   |-- customer/        # Customer dashboard and account screens
|   |   |-- onboarding/      # App intro/onboarding
|   |   |-- shared/          # Home, inventory, and vehicle details
|   |-- utils/               # UI/helper utilities
```

## Prerequisites

- Node.js and npm
- Expo CLI through `npx`
- Expo Go app for physical-device testing, or an Android/iOS simulator
- Running backend API from `../vehicle-express`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the app environment file:

```bash
copy .env.example .env
```

3. Update `EXPO_PUBLIC_API_URL` in `.env` so it points to the backend.

Examples:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
```

Use your computer's LAN IP address when testing on a physical phone. The backend logs LAN URLs when it starts.

## Available Scripts

```bash
npm start      # Start Expo with cache clearing
npm run android
npm run ios
```

## Running the App

1. Start the backend first from `../vehicle-express`.
2. Start Expo:

```bash
npm start
```

3. Open the app using one of these options:

- Scan the QR code with Expo Go on a physical device.
- Press `a` in the Expo terminal for Android.
- Press `i` in the Expo terminal for iOS.

## Backend Connection Notes

The API client uses `EXPO_PUBLIC_API_URL` when provided. For local development:

- Android emulator can use `http://10.0.2.2:8080`.
- iOS simulator can use `http://localhost:8080`.
- Physical devices should use the backend computer's LAN URL, such as `http://192.168.1.100:8080`.

The backend serves uploaded files from `/uploads`, so vehicle, promotion, review, profile, payment-slip, and refund-proof images depend on the backend being reachable from the device.

## User Roles

| Role | Main Access |
| --- | --- |
| Guest | Browse vehicles, view vehicle details, view active promotions |
| Customer | Wishlist, bookings, inquiries, reviews, refunds, profile management |
| Marketing Manager | Promotion management, inquiry/review management views |
| Admin | Full dashboard, vehicles, bookings, refunds, users, sub-admins, reviews |

## Important Notes Before Pushing to GitHub

- This project includes `.gitignore` rules for local/generated files.
- Do not commit `.env`.
- Do not commit `node_modules`.
- Do not commit `.expo`, build output, logs, or local Android signing files such as `debug.keystore`.
- Do not commit accidental migration folders such as `.legacy_misplaced`.
- Keep `.env.example` committed so other developers know which variables are required.
- Make sure the backend URL in `.env` matches the machine or network where the API is running.
