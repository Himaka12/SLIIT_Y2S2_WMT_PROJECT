# Vehicle Express Backend

Express.js + MongoDB backend for the K.D. Auto Traders / Wheelzy vehicle rental and sales platform. This API supports the Expo mobile app in `../VehicleApp`.

## Main Features

- JWT authentication and role-based authorization
- Customer registration, login, profile management, premium upgrade, and account deletion
- Admin user and marketing manager management
- Vehicle CRUD with image uploads
- Rental booking creation, updates, cancellation, status management, and payment-slip handling
- Refund claim and processing workflow with proof upload
- Sales inquiries and inquiry status management
- Promotions with public active/showcase endpoints
- Wishlist management
- Reviews, moderation, admin responses, and AI sentiment helper support
- Health endpoint and MongoDB reconnect handling

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB with Mongoose |
| Authentication | JSON Web Tokens |
| Password hashing | bcryptjs |
| File uploads | Multer |
| Environment config | dotenv |
| Development runner | Nodemon |

## Project Structure

```text
vehicle-express/
|-- package.json
|-- README.md
|-- uploads/                 # Runtime upload storage, should not be committed
|-- src/
|   |-- server.js            # Express app entry point
|   |-- config/
|   |   |-- db.js            # MongoDB connection helpers
|   |-- middleware/
|   |   |-- auth.js          # JWT authentication and role guards
|   |-- models/              # Mongoose models
|   |   |-- Payment.js
|   |   |-- Promotion.js
|   |   |-- Refund.js
|   |   |-- RentalBooking.js
|   |   |-- Review.js
|   |   |-- SalesInquiry.js
|   |   |-- User.js
|   |   |-- Vehicle.js
|   |   |-- Wishlist.js
|   |-- routes/              # API route modules
|   |   |-- admin.js
|   |   |-- auth.js
|   |   |-- bookings.js
|   |   |-- customer.js
|   |   |-- inquiries.js
|   |   |-- promotions.js
|   |   |-- refunds.js
|   |   |-- reviews.js
|   |   |-- vehicles.js
|   |   |-- wishlist.js
|   |-- utils/               # JWT, uploads, seeding, and helper utilities
```

## Prerequisites

- Node.js and npm
- MongoDB Atlas database or local MongoDB instance
- Google Gemini API key if AI review sentiment analysis is enabled

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in `vehicle-express/` from the safe example file:

```bash
copy .env.example .env
```

3. Update the values in `.env`.

Example:

```env
PORT=8080
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.example.mongodb.net/vehicle-app
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRATION_MS=86400000

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
ADMIN_FULL_NAME=System Admin
ADMIN_CONTACT_NUMBER=0770000000

GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_MODEL=gemini-1.5-flash

ENABLE_TESTING_ROUTES=false
```

Use real values locally, but never commit the `.env` file to GitHub.

## Available Scripts

```bash
npm run dev    # Start with nodemon
npm start      # Start with node
```

The API listens on `0.0.0.0` and defaults to port `8080`. On startup it prints local and LAN URLs that can be used by the mobile app.

## Health Check

```http
GET /api/health
```

Returns `200` when the API and database are ready. Returns `503` when the API is running but MongoDB is unavailable.

## Authentication

Protected routes require a bearer token:

```http
Authorization: Bearer <jwt_token>
```

Supported roles:

- `CUSTOMER`
- `MARKETING_MANAGER`
- `ADMIN`

## API Overview

Base URL for local development:

```text
http://localhost:8080
```

### Auth - `/api/auth`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/register` | Public | Register a customer |
| POST | `/login` | Public | Login and receive JWT |
| POST | `/verify-admin-password` | Admin | Verify admin password before sensitive actions |
| POST | `/add-subadmin` | Admin | Create marketing manager |
| GET | `/subadmins` | Admin | List marketing managers |
| PUT | `/update-subadmin/:id` | Admin | Update marketing manager |
| DELETE | `/delete-subadmin/:id` | Admin | Delete marketing manager |
| GET | `/users` | Admin | List users |
| GET | `/delete-user-preview/:id` | Admin | Preview account deletion impact |
| DELETE | `/delete-user/:id` | Admin | Delete user |
| DELETE | `/hard-delete-user/:id` | Admin | Hard-delete user |

### Vehicles - `/api/vehicles`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/all` | Public | List vehicles |
| GET | `/:id` | Public | Get vehicle by ID |
| POST | `/add` | Admin | Add vehicle with `images` upload |
| PUT | `/update/:id` | Admin | Update vehicle with optional `images` upload |
| GET | `/delete-preview/:id` | Admin | Preview vehicle deletion impact |
| DELETE | `/delete/:id` | Admin | Delete vehicle |
| DELETE | `/hard-delete/:id` | Admin | Hard-delete vehicle |

### Bookings - `/api/bookings`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/check-availability` | Public | Check booking date availability |
| POST | `/rent` | Customer | Create rental booking with `paymentSlip` upload |
| PUT | `/update/:id` | Customer | Update own booking |
| DELETE | `/delete/:id` | Customer | Cancel own booking |
| GET | `/my-bookings` | Customer | List own bookings |
| GET | `/all` | Admin | List all bookings |
| PUT | `/status/:id` | Admin | Update booking status |
| POST | `/:id/view-slip` | Admin | Mark/view payment slip |
| DELETE | `/admin-delete/:id` | Admin | Delete booking as admin |

### Refunds - `/api/refunds`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/claim/:bookingId` | Customer | Claim refund for cancelled booking |
| GET | `/my` | Customer | List own refunds |
| POST | `/process/:refundId` | Admin | Process refund with `refundProof` upload |
| POST | `/mark-viewed` | Admin | Mark refund notifications viewed |
| GET | `/pending` | Admin | List pending refunds |
| GET | `/all` | Admin | List all refunds |
| DELETE | `/admin-delete/:id` | Admin | Delete refund |

### Reviews - `/api/reviews`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/all` | Public | List visible reviews |
| GET | `/vehicle/:vehicleId` | Public | List visible reviews for a vehicle |
| GET | `/eligibility/:vehicleId` | Customer | Check review eligibility |
| GET | `/can-review/:vehicleId` | Customer | Legacy eligibility endpoint |
| GET | `/my` | Customer | List own reviews |
| GET | `/my-reviews` | Customer | Legacy own reviews endpoint |
| POST | `/` or `/add` | Customer | Create review with optional `images` upload |
| PUT | `/:reviewId` or `/update/:reviewId` | Customer | Update own review |
| DELETE | `/:reviewId` or `/delete/:reviewId` | Customer | Delete own review |
| GET | `/admin`, `/moderation`, or related admin list paths | Admin/Marketing | List reviews for moderation |
| PUT | `/admin-delete/:reviewId` | Admin | Soft-delete review |
| DELETE | `/admin-purge/:reviewId` | Admin | Permanently delete review |
| PUT | `/admin-respond/:reviewId` | Admin | Add admin response |

### Inquiries - `/api/inquiries`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/add` | Customer | Submit sales inquiry |
| GET | `/all` | Admin/Marketing | List all inquiries |
| PUT | `/update-status/:id` | Admin/Marketing | Update inquiry status |
| GET | `/my-inquiries` | Customer | List own inquiries |
| GET | `/check/:vehicleId` | Customer | Check if customer already inquired |
| DELETE | `/admin-delete/:id` | Admin | Delete inquiry |

### Promotions - `/api/promotions`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/active` | Public | List active promotions |
| GET | `/showcase` | Public | List showcase promotions |
| POST | `/add` | Admin/Marketing | Create promotion with `image` upload |
| GET | `/all` | Admin/Marketing | List all promotions |
| PUT | `/status/:id` | Admin/Marketing | Update promotion status |
| PUT | `/update/:id` | Admin/Marketing | Update promotion |
| DELETE | `/:id` | Admin/Marketing | Delete promotion |

### Customer - `/api/customer`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/profile` | Customer | Get own profile |
| PUT | `/update` | Customer | Update profile with optional `profileImage` upload |
| PUT | `/security-question` | Customer | Update security question |
| PUT | `/change-password` | Customer | Change password |
| POST | `/premium-upgrade` | Customer | Upgrade to premium |
| GET | `/notifications` | Customer | List customer notifications |
| POST | `/notifications/mark-viewed` | Customer | Mark notifications viewed |
| POST | `/add-card` | Customer | Add payment card |
| DELETE | `/remove-card` | Customer | Remove payment card |
| POST | `/delete-preview` | Customer | Preview account deletion impact |
| DELETE | `/delete` | Customer | Delete own account |

### Admin - `/api/admin`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/stats` | Admin | Dashboard statistics |
| GET | `/notifications` | Admin | List admin notifications |
| POST | `/notifications/mark-viewed` | Admin | Mark admin notifications viewed |
| GET | `/reviews` | Admin | List reviews for admin tools |
| PATCH | `/reviews/:reviewId/hide` | Admin | Hide review |
| PATCH | `/reviews/:reviewId/show` | Admin | Show review |
| DELETE | `/reviews/:reviewId` | Admin | Delete review |

Testing cleanup routes are available under `/api/admin/testing/...` only when testing routes are enabled in environment configuration.

### Wishlist - `/api/wishlist`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/toggle/:vehicleId` | Customer | Add or remove vehicle from wishlist |
| GET | `/my-wishlist` | Customer | List wishlist with vehicle details |
| GET | `/my-wishlist-ids` | Customer | List wishlisted vehicle IDs |

## File Uploads

Uploaded files are stored inside `uploads/` and served publicly from:

```text
http://localhost:8080/uploads/<file-path>
```

Common multipart field names:

| Feature | Field |
| --- | --- |
| Vehicle images | `images` |
| Review images | `images` |
| Payment slip | `paymentSlip` |
| Refund proof | `refundProof` |
| Promotion image | `image` |
| Profile image | `profileImage` |

## Important Notes Before Pushing to GitHub

- This project includes `.gitignore` rules for local/generated files.
- Do not commit `.env`.
- Do not commit `node_modules`.
- Do not commit runtime files in `uploads/`.
- Do not commit logs, build output, cache folders, or accidental migration folders such as `.legacy_misplaced` and `home`.
- Keep `.env.example` committed so other developers know which variables are required without exposing secrets.
- Confirm MongoDB Atlas network access allows your development machine before testing.
