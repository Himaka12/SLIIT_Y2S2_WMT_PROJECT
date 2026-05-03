I inspected the project again. It is a full-stack mobile vehicle sales/rental system with:

- Frontend: `VehicleApp` using Expo React Native
- Backend: `vehicle-express` using Express.js
- Database: MongoDB with Mongoose models
- Deployment backend URL: `https://sliit-y2s2-wmt-project.onrender.com`
- GitHub remote: `https://github.com/Himaka12/SLIIT_Y2S2_WMT_PROJECT.git`

Here is a clean full `README.md` content you can use in GitHub:

```md
# Vehicle Sales & Rental Mobile App

A full-stack mobile application for vehicle sales and rental management. The system includes an Expo React Native mobile app, an Express.js backend API, and a MongoDB database. It supports customer vehicle browsing, rental bookings, refund claims, sales inquiries, reviews, promotions, wishlist management, and admin/marketing management workflows.

## GitHub Repository

https://github.com/Himaka12/SLIIT_Y2S2_WMT_PROJECT.git

## Deployment

Backend URL:

```text
https://sliit-y2s2-wmt-project.onrender.com
```

Health Check:

```text
https://sliit-y2s2-wmt-project.onrender.com/api/health
```

## Project Overview

This project is developed for the SE2020 / WMT module as a mobile-based vehicle sales and rental platform. The application allows customers to browse available vehicles, view rental and sale details, create rental bookings, submit inquiries for sale vehicles, manage wishlists, claim refunds, and submit reviews.

Administrators can manage vehicles, customers, bookings, refunds, reviews, users, and dashboard statistics. Marketing managers can manage promotions, offers, inquiries, and review-related workflows.

## Main Features

### Customer Features

- Customer registration and login
- JWT-based authentication
- Browse sale and rental vehicles
- View detailed vehicle information
- Search and filter vehicles
- Add/remove vehicles from wishlist
- Create rental bookings
- Upload payment slip for rental booking
- View and manage customer bookings
- Claim refunds for eligible cancelled bookings
- Submit sales inquiries for sale vehicles
- Submit, edit, and delete reviews
- View active promotions and offers
- Manage customer profile
- Change password and security question
- Upgrade to premium membership
- Delete/anonymize customer account
- View customer notifications

### Admin Features

- Admin dashboard with statistics
- Manage vehicles
- Add, update, soft delete, and hard delete vehicles
- Upload vehicle images
- Manage rental bookings
- Approve, reject, cancel, and delete bookings
- View uploaded payment slips
- Manage refund requests
- Process refunds with proof upload
- Manage users and sub-admins
- Manage reviews and moderation actions
- Hide, show, respond to, or delete reviews
- View admin notifications

### Marketing Manager Features

- Create promotions and offers
- Update promotion details
- Enable/disable promotions
- Manage active and showcase promotions
- Target promotions by vehicle, brand, model, category, or listing type
- Support inquiry and review management workflows

## Tech Stack

### Frontend

| Area | Technology |
| --- | --- |
| Framework | Expo React Native |
| Language | JavaScript |
| Navigation | React Navigation |
| API Client | Axios |
| Storage | AsyncStorage / Expo SecureStore |
| Image Picker | Expo Image Picker |
| Styling | React Native StyleSheet |

### Backend

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JSON Web Token |
| Password Hashing | bcryptjs |
| File Uploads | Multer |
| Cloud Storage Support | Cloudinary |
| Environment Config | dotenv |
| Development Runner | Nodemon |

## Project Structure

```text
SLIIT_Y2S2_WMT_PROJECT/
│
├── README.md
│
├── VehicleApp/
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   ├── .env.example
│   ├── assets/
│   │   ├── images/
│   │   └── logos/
│   ├── android/
│   └── src/
│       ├── api/
│       │   └── index.js
│       ├── components/
│       ├── constants/
│       ├── context/
│       ├── navigation/
│       ├── screens/
│       │   ├── admin/
│       │   ├── auth/
│       │   ├── customer/
│       │   ├── onboarding/
│       │   └── shared/
│       └── utils/
│
└── vehicle-express/
    ├── package.json
    ├── .env.example
    ├── README.md
    └── src/
        ├── server.js
        ├── config/
        ├── middleware/
        ├── models/
        ├── routes/
        └── utils/
```

## Frontend Structure

The frontend is located in:

```text
VehicleApp/
```

Important folders:

```text
VehicleApp/src/api
```

Contains Axios API configuration and frontend API service functions.

```text
VehicleApp/src/navigation
```

Contains the root navigator and role-based navigation logic.

```text
VehicleApp/src/context
```

Contains authentication and application alert context providers.

```text
VehicleApp/src/screens/auth
```

Contains login, register, and agreement screens.

```text
VehicleApp/src/screens/customer
```

Contains customer dashboard, booking, refund, wishlist, profile, inquiry, promotion, and review screens.

```text
VehicleApp/src/screens/admin
```

Contains admin dashboard, vehicle management, refund processing, and marketing dashboard screens.

```text
VehicleApp/src/screens/shared
```

Contains shared screens such as home, inventory, and vehicle detail screens.

```text
VehicleApp/src/components
```

Contains reusable UI components, vehicle cards, review modals, promotion sheets, tab bars, and shared interface elements.

## Backend Structure

The backend is located in:

```text
vehicle-express/
```

Important folders:

```text
vehicle-express/src/server.js
```

Main Express server entry point.

```text
vehicle-express/src/config/db.js
```

MongoDB connection configuration.

```text
vehicle-express/src/middleware/auth.js
```

JWT authentication and role-based authorization middleware.

```text
vehicle-express/src/models
```

Mongoose database models.

```text
vehicle-express/src/routes
```

Express route modules for each API feature.

```text
vehicle-express/src/utils
```

Helper utilities for JWT, uploads, admin seeding, refunds, promotions, reviews, and account deletion.

## Database Models

The backend uses MongoDB with Mongoose. Main collections/models include:

| Model | Purpose |
| --- | --- |
| User | Stores customer, admin, and marketing manager accounts |
| Vehicle | Stores sale/rental vehicle details |
| RentalBooking | Stores vehicle rental booking records |
| Refund | Stores refund claims and refund processing details |
| Review | Stores customer reviews and moderation details |
| SalesInquiry | Stores customer inquiries for sale vehicles |
| Promotion | Stores promotions and offer details |
| Wishlist | Stores customer wishlist items |
| Payment | Stores payment-related records |

## API Routes

Base URL:

```text
https://sliit-y2s2-wmt-project.onrender.com
```

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Check API and database status |

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register customer |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/verify-admin-password` | Verify admin password |
| POST | `/api/auth/add-subadmin` | Add marketing manager |
| GET | `/api/auth/subadmins` | List marketing managers |
| PUT | `/api/auth/update-subadmin/:id` | Update marketing manager |
| DELETE | `/api/auth/delete-subadmin/:id` | Delete marketing manager |
| GET | `/api/auth/users` | List users |
| GET | `/api/auth/delete-user-preview/:id` | Preview user deletion |
| DELETE | `/api/auth/delete-user/:id` | Delete user |
| DELETE | `/api/auth/hard-delete-user/:id` | Permanently delete user |

### Vehicles

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/vehicles/all` | Get all vehicles |
| GET | `/api/vehicles/:id` | Get vehicle by ID |
| POST | `/api/vehicles/add` | Add vehicle |
| PUT | `/api/vehicles/update/:id` | Update vehicle |
| GET | `/api/vehicles/delete-preview/:id` | Preview vehicle deletion |
| DELETE | `/api/vehicles/delete/:id` | Delete vehicle |
| DELETE | `/api/vehicles/hard-delete/:id` | Permanently delete vehicle |

### Bookings

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/bookings/check-availability` | Check rental availability |
| POST | `/api/bookings/rent` | Create rental booking |
| PUT | `/api/bookings/update/:id` | Update booking |
| DELETE | `/api/bookings/delete/:id` | Cancel booking |
| GET | `/api/bookings/my-bookings` | Get customer bookings |
| GET | `/api/bookings/all` | Get all bookings |
| PUT | `/api/bookings/status/:id` | Update booking status |
| POST | `/api/bookings/:id/view-slip` | Mark payment slip viewed |
| DELETE | `/api/bookings/admin-delete/:id` | Delete booking as admin |

### Refunds

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/refunds/claim/:bookingId` | Claim refund |
| GET | `/api/refunds/my` | Get customer refunds |
| POST | `/api/refunds/process/:refundId` | Process refund |
| POST | `/api/refunds/mark-viewed` | Mark refund viewed |
| GET | `/api/refunds/pending` | Get pending refunds |
| GET | `/api/refunds/all` | Get all refunds |
| DELETE | `/api/refunds/admin-delete/:id` | Delete refund |

### Reviews

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/reviews/all` | Get visible reviews |
| GET | `/api/reviews/vehicle/:vehicleId` | Get vehicle reviews |
| GET | `/api/reviews/eligibility/:vehicleId` | Check review eligibility |
| POST | `/api/reviews` | Create review |
| PUT | `/api/reviews/:reviewId` | Update review |
| DELETE | `/api/reviews/:reviewId` | Delete review |
| GET | `/api/admin/reviews` | Admin review list |
| PATCH | `/api/admin/reviews/:reviewId/hide` | Hide review |
| PATCH | `/api/admin/reviews/:reviewId/show` | Show review |
| DELETE | `/api/admin/reviews/:reviewId` | Delete review as admin |

### Inquiries

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/inquiries/add` | Submit inquiry |
| GET | `/api/inquiries/all` | Get all inquiries |
| PUT | `/api/inquiries/update-status/:id` | Update inquiry status |
| GET | `/api/inquiries/my-inquiries` | Get customer inquiries |
| GET | `/api/inquiries/check/:vehicleId` | Check existing inquiry |
| DELETE | `/api/inquiries/admin-delete/:id` | Delete inquiry |

### Promotions

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/promotions/active` | Get active promotions |
| GET | `/api/promotions/showcase` | Get showcase promotions |
| POST | `/api/promotions/add` | Add promotion |
| GET | `/api/promotions/all` | Get all promotions |
| PUT | `/api/promotions/status/:id` | Update promotion status |
| PUT | `/api/promotions/update/:id` | Update promotion |
| DELETE | `/api/promotions/:id` | Delete promotion |

### Customer

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/customer/profile` | Get customer profile |
| PUT | `/api/customer/update` | Update profile |
| PUT | `/api/customer/security-question` | Update security question |
| PUT | `/api/customer/change-password` | Change password |
| POST | `/api/customer/premium-upgrade` | Upgrade to premium |
| GET | `/api/customer/notifications` | Get notifications |
| POST | `/api/customer/notifications/mark-viewed` | Mark notification viewed |
| POST | `/api/customer/add-card` | Add payment card |
| DELETE | `/api/customer/remove-card` | Remove payment card |
| POST | `/api/customer/delete-preview` | Preview account deletion |
| DELETE | `/api/customer/delete` | Delete own account |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/stats` | Get dashboard statistics |
| GET | `/api/admin/notifications` | Get admin notifications |
| POST | `/api/admin/notifications/mark-viewed` | Mark notifications viewed |

### Wishlist

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/wishlist/toggle/:vehicleId` | Add/remove wishlist item |
| GET | `/api/wishlist/my-wishlist` | Get customer wishlist |
| GET | `/api/wishlist/my-wishlist-ids` | Get wishlist vehicle IDs |

## User Roles

| Role | Access |
| --- | --- |
| Guest | Browse vehicles and promotions |
| Customer | Bookings, refunds, inquiries, reviews, wishlist, profile |
| Marketing Manager | Promotions, inquiries, review-related workflows |
| Admin | Full system management |

## Installation and Setup

### Prerequisites

Install the following:

- Node.js
- npm
- Expo Go mobile app or Android/iOS emulator
- MongoDB Atlas database or local MongoDB instance

## Backend Setup

Go to the backend folder:

```bash
cd vehicle-express
```

Install dependencies:

```bash
npm install
```

Create `.env` using `.env.example`:

```bash
copy .env.example .env
```

Example backend environment variables:

```env
PORT=8080
APP_TIME_ZONE=Asia/Colombo
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.example.mongodb.net/vehicle-app
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRATION_MS=86400000

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123
ADMIN_FULL_NAME=System Admin
ADMIN_CONTACT_NUMBER=0770000000

GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_MODEL=gemini-1.5-flash

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_ROOT_FOLDER=sliit-wmt

ENABLE_TESTING_ROUTES=false
```

Start backend in development mode:

```bash
npm run dev
```

Start backend in production mode:

```bash
npm start
```

The backend runs by default on:

```text
http://localhost:8080
```

## Frontend Setup

Go to the frontend folder:

```bash
cd VehicleApp
```

Install dependencies:

```bash
npm install
```

Create `.env` using `.env.example`:

```bash
copy .env.example .env
```

Example frontend environment variable:

```env
EXPO_PUBLIC_API_URL=https://sliit-y2s2-wmt-project.onrender.com
```

Start Expo:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

## Backend Connection Notes

The mobile app uses `EXPO_PUBLIC_API_URL` when available. If the environment variable is not set, the app uses the deployed Render backend:

```text
https://sliit-y2s2-wmt-project.onrender.com
```

For local mobile testing:

- Android emulator can use `http://10.0.2.2:8080`
- iOS simulator can use `http://localhost:8080`
- Physical device should use the computer LAN IP, for example `http://192.168.1.100:8080`

## File Uploads

The system supports multipart uploads for:

| Feature | Upload Field |
| --- | --- |
| Vehicle images | `images` |
| Review images | `images` |
| Payment slip | `paymentSlip` |
| Refund proof | `refundProof` |
| Promotion image | `image` |
| Profile image | `profileImage` |

Uploaded media is handled by backend upload utilities and Cloudinary configuration when enabled.

## Team Members and Contributions

| ID | Name | Module | Contribution |
| --- | --- | --- | --- |
| IT24100444 | Fikry M.A.A | Vehicle Management | 18% |
| IT24100889 | Henarangoda M.P | Booking and Refund Management | 18% |
| IT24103099 | Uthpala P.B.H | Review and Feedback Management | 17% |
| IT24103303 | Warakapola A.A.M | Admin Management | 15% |
| IT24101110 | De Silva T.R.S | Customer Management | 16% |
| IT24101147 | Gajanayake H.K.D.W.R | Promotion and Offer Management | 16% |

## Contribution Details

### IT24100444 - Fikry M.A.A

Developed the Vehicle Management module for the mobile app, including vehicle listing, add/edit vehicle screens, vehicle deletion controls, vehicle image upload handling, validation support, admin vehicle catalog, and customer-facing vehicle browsing/detail screens for sale and rental vehicles.

Related files include:

```text
AdminVehicleCatalogScreen.js
AddEditVehicleScreen.js
InventoryScreen.js
VehicleDetailScreen.js
SaleVehicleDetailsScreen.js
RentVehicleDetailsScreen.js
VehicleCard.js
InventoryVehicleCard.js
VehicleDetailsShared.js
Vehicle.js
vehicles.js
```

### IT24100889 - Henarangoda M.P

Developed Booking and Refund Management features for the mobile app, including rental availability checking, rental booking creation, customer booking management, admin booking status updates, refund eligibility flow, refund claim submission, refund processing screens, and payment/refund slip upload integration.

Related files include:

```text
BookVehicleScreen.js
CustomerBookingsScreen.js
ClaimRefundScreen.js
ProcessRefundScreen.js
RentVehicleDetailsScreen.js
AvailabilityStatusBox.js
CalendarDateField.js
RentalBooking.js
Refund.js
bookings.js
refunds.js
```

### IT24103099 - Uthpala P.B.H

Developed Review and Feedback Management for the mobile app, including customer review submission, review eligibility checks based on approved bookings, review editing/deletion, review display on vehicle detail pages, admin review moderation, AI-assisted sentiment support integration, and admin response handling.

Related files include:

```text
CustomerReviewsScreen.js
ReviewComposerModal.js
ReviewShared.js
RentVehicleDetailsScreen.js
VehicleDetailsShared.js
MarketingDashboardScreen.js
Review.js
reviews.js
reviewHelpers.js
```

### IT24103303 - Warakapola A.A.M

Developed Admin Management features for the mobile app, including admin dashboard statistics, admin navigation, user and sub-admin management support, protected admin workflows, role-based access handling, admin notifications, and integration of admin-only management screens.

Related files include:

```text
AdminDashboardScreen.js
FloatingAdminTabBar.js
RootNavigator.js
AuthContext.js
LoginScreen.js
RegisterScreen.js
admin.js
auth.js
auth middleware
seedAdmin.js
User.js
```

### IT24101110 - De Silva T.R.S

Developed Customer Management features for the mobile app, including customer registration/login, authentication context, customer dashboard, profile viewing and editing, password/security-question updates, premium membership activation, account deletion support, notification handling, and wishlist-related customer functions.

Related files include:

```text
LoginScreen.js
RegisterScreen.js
RegisterAgreementScreen.js
CustomerDashboardScreen.js
CustomerProfileScreen.js
ManageProfileScreen.js
ProfileInfoScreen.js
EditDetailsScreen.js
PremiumUpgradeScreen.js
CustomerWishlistScreen.js
AuthContext.js
customer.js
wishlist.js
User.js
Wishlist.js
```

### IT24101147 - Gajanayake H.K.D.W.R

Developed Promotion and Offer Management features for the mobile app, including promotion creation, update, status management, active promotion display, showcase promotions, promotion targeting support, customer promotion browsing, marketing dashboard features, and promotion display integration with vehicle inventory/detail pages.

Related files include:

```text
MarketingDashboardScreen.js
CustomerPromotionsScreen.js
PromotionQuickViewSheet.js
PremiumLoginOfferPopup.js
InventoryScreen.js
HomeScreen.js
VehicleDetailsShared.js
promotionUtils.js
Promotion.js
promotions.js
promotionHelpers.js
```

## Security Notes

- Do not commit `.env` files.
- Do not commit real database credentials.
- Do not commit JWT secrets.
- Do not commit Cloudinary API secrets.
- Do not commit `node_modules`.
- Do not commit runtime upload files.
- Keep `.env.example` files for setup reference only.

## Important Git Ignore Notes

The repository should ignore:

```text
node_modules/
.env
.expo/
build/
dist/
uploads/
logs/
```

## License

This project was developed for academic coursework under the SE2020 / WMT module.
```
