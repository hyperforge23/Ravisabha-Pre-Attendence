@AGENTS.md

# Ravi Sabha Attendance — Project Overview

## Purpose
Pre-attendance management web app for Ravi Sabha. Allows volunteers to search by mobile number, view all associated members, select them individually or all at once, and mark them as present.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.8 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database ORM | Mongoose 9 + mongoose-autopopulate |
| Runtime | React 19 / Node 20 |
| Deployment | Vercel (`vercel.json` configured) |

---

## Project Structure

```
/
├── app/
│   ├── layout.tsx          # Root layout — fonts, metadata, body wrapper
│   ├── page.tsx            # Main attendance page — all state lives here
│   ├── globals.css         # Tailwind base styles
│   └── api/
│       └── search/
│           └── route.ts    # Search API: prefix type-ahead & exact mobile fetch from MongoDB
│
├── components/
│   ├── Header.tsx          # Sticky top header — logo "R", title "Ravi Sabha Attendance"
│   ├── MobileSearch.tsx    # Pill-shaped type-ahead search bar (numeric only) + Mehman Count
│   └── UserCard.tsx        # Card showing matched users — checkboxes, Select All, Mehman count, Present button
│
├── types/
│   └── user.ts             # User interface + UserService contract
│
├── mock/
│   └── users.mock.ts       # Static mock dataset (multiple users per mobile number)
│
├── services/
│   └── userService.ts      # ApiUserService (connected to /api/search) & MockUserService
│
├── models/
│   ├── User.ts             # Mongoose User model
│   └── SmkDetail.ts        # Mongoose SmkDetail model (collection: smkdetails)
│
├── lib/
│   └── mongodb.ts          # Cached Mongoose connection utility (connectDb)
│
├── .env.local              # MONGODB_URI (MongoDB connection string)
└── vercel.json             # Vercel deployment config (region: iad1)
```

---

## Key Conventions

### State Management
- All UI state lives in `app/page.tsx` (`selectedMobile`, `users`, `selectedUserIds`, `mehmanCount`).
- Selected users tracked by `userId: string[]` — mapped from MongoDB `_id` or mock ID.

### Service Layer Pattern
```
UI (page.tsx / MobileSearch.tsx)
  ↓
userService (services/userService.ts)  → ApiUserService active by default
  ↓
/api/search?query=...  or  /api/search?mobile=...
  ↓
MongoDB (SmkDetail model / smkdetails collection)
```

### Search & Family (Kutumb) Fetch Behavior
- Input is strictly numeric (`/\D/g` stripped), max 10 characters.
- Search performs substring matching on `MobileNo` with 300ms debounce (e.g. typing `83936` matches `9601283936`).
- When a user/mobile number is selected, the system identifies that person's `KutumbId`.
- It then queries `/api/search?kutumbId=<KutumbId>` (or looks up all members in MongoDB by `{ KutumbId: targetKutumbId }`) to fetch all family members sharing that same `KutumbId`.
- If no `KutumbId` exists, it falls back to fetching members with matching `{ MobileNo }`.

### Mehman Counter
- Pill-shaped counter component with `[-]` and `[+]` buttons and central count display (range: 0 to 10, default 0).
- Positioned **above the UserCard and below the search bar**.
- Dynamically shifts down when search suggestions expand in document flow.
- Value included with the attendance payload when marking present.

### UserCard Layout
- Full-width responsive card layout.
- **Top Details Block**:
  - Full Name in English + Gujarati in parentheses: `FirstName MiddleName LastName (ગુજરાતી નામ)`
  - Subline: `SMK No : <SmkId>   Mobile No : <MobileNumber>`
  - Date & Time inputs: formatted as `DD-MM-YYYY` (with calendar icon) and `hh:mm A` (with clock icon).
- **Members Section Header**: `Members (<count>)` (left) | **Select All + checkbox** (right).
- **Per-user rows**: Name in English (+ Gujarati), SMK No, Mobile No (left) | Individual checkbox (right).
- Row click toggles the checkbox (stopPropagation on the checkbox itself).
- Indeterminate state handled via `useRef` on the Select All checkbox.
- **Card Action Footer**: **Present button** (right, green `#28a745`, disabled when no user selected).

---

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

---

## Environment Variables

```env
# .env.local
MONGODB_URI=mongodb://localhost:27017/next-mongo-app
# Or MongoDB Atlas connection string
```
