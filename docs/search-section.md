# Search Bar Section — Ravisabha Attendance

Documentation of the search feature: how the UI works, how the query reaches the database, and how results are matched and returned.

**Files involved**

| Layer | File | Role |
|---|---|---|
| UI component | `components/SearchSection.tsx` | Input, dropdown, keyboard nav, "Add New User" |
| API route | `app/api/search/route.ts` | `GET /api/search?query=...` — runs the MongoDB search |
| DB model | `models/SmkDetail.ts` | Mongoose schema for the `smkdetails` collection |
| DB connection | `lib/db.ts` | Cached MongoDB connection |
| Types | `lib/types.ts` | `User` interface used by the frontend |
| Used in | `app/page.tsx`, `app/export/page.tsx` | Parent pages that receive the selected user |

---

## 1. What the user sees

- A text input with a search icon and the placeholder **"Search by name, SMK no, or mobile no..."**.
- While typing, a dropdown appears under the input with up to 10 matches. Each row shows:
  `Full Name | SMK No | Mobile No`
  (stacked vertically on mobile, inline with `|` separators on `sm:` screens and up).
- At the bottom of the dropdown (or when nothing matches) an **Add New User** button lets the user create a new person.
- A separate **Add New User / Add User** button sits beside the input.
- Picking a result hands the user to the parent page, which shows a `UserCard` where attendance is marked.

---

## 2. Component API

```tsx
interface SearchSectionProps {
  onSelectUser: (user: User) => void;  // called when a result is picked or a new user is created
  showAddUser?: boolean;               // default true; hides all "Add New User" UI when false
}
```

**Usage**

```tsx
// app/page.tsx — attendance page, can add users
<SearchSection onSelectUser={handleSelectUser} />

// app/export/page.tsx — export page, search only
<SearchSection onSelectUser={(user) => setSelectedPerson(user)} showAddUser={false} />
```

---

## 3. State

| State | Type | Purpose |
|---|---|---|
| `query` | `string` | Current text in the input |
| `results` | `User[]` | Users returned by the API |
| `isFocused` | `boolean` | Controls whether the dropdown is visible |
| `isLoading` | `boolean` | Shows "Searching..." while a request is in flight |
| `activeIndex` | `number` | Highlighted row for keyboard navigation (`-1` = none) |
| `isModalOpen` | `boolean` | Whether `AddUserModal` is open |
| `initialFirstName` | `string` | Text pre-filled into the modal's First Name |
| `inputRef` | `ref` | Used to call `blur()` (closes the mobile keyboard) |

---

## 4. How the search works, step by step

```
User types
   │
   ▼
onChange → setQuery(value), setIsFocused(true)
   │
   ▼
useEffect([query]) starts a 300 ms timer  ──(next keystroke cancels it)──┐
   │ (300 ms of no typing)                                               │
   ▼                                                                     │
axios.get('/api/search', { params: { query } })  ◄───────────────────────┘
   │
   ▼
GET /api/search?query=...   (Next.js route handler)
   │
   ▼
connectDb() → MongoDB aggregation on `smkdetails`
   │
   ▼
Map DB fields → frontend `User` shape → JSON { users: [...] }
   │
   ▼
setResults(data.users) → dropdown renders
```

### 4.1 Debounce (client)

```tsx
useEffect(() => {
  const fetchUsers = async () => {
    if (!query) { setResults([]); return; }
    setIsLoading(true);
    try {
      const { data } = await axios.get('/api/search', { params: { query } });
      setResults(data.users);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debounceTimer = setTimeout(fetchUsers, 300);
  return () => clearTimeout(debounceTimer);   // cleanup cancels the pending call
}, [query]);
```

- Every change to `query` schedules a request **300 ms** later.
- The cleanup function clears the previous timer, so only the *last* keystroke in a burst actually hits the server. Typing "mayank" fires one request instead of six.
- An empty query clears the results without calling the API.
- On error the results are cleared and the error is logged.

### 4.2 The API route (server)

`GET /api/search?query=<text>`

1. Connects to MongoDB via `connectDb()` (connection is cached across requests).
2. Reads `query` from the URL. If it is missing/empty → returns `{ users: [] }`.
3. Runs an **aggregation pipeline** with three stages:

```ts
const aggregationPipeline: PipelineStage[] = [
  {
    $addFields: {
      mobileStr: { $toString: "$MobileNo" }      // number → string so regex can run on it
    }
  },
  {
    $match: {
      $or: [
        { FirstName:  { $regex: query, $options: 'i' } },
        { MiddleName: { $regex: query, $options: 'i' } },
        { LastName:   { $regex: query, $options: 'i' } },
        { SmkId:      { $regex: query, $options: 'i' } },
        { mobileStr:  { $regex: query, $options: 'i' } }
      ]
    }
  },
  { $limit: 10 }
];

const users = await SmkDetail.aggregate(aggregationPipeline);
```

| Stage | What it does |
|---|---|
| `$addFields` | Creates a temporary string field `mobileStr` from `MobileNo`. Needed because `MobileNo` is stored as a **Number** in the schema, and `$regex` only works on strings. |
| `$match` + `$or` | Keeps a document if **any** of the five fields matches the query. |
| `$limit: 10` | Returns at most 10 documents, to keep the dropdown small and fast. |

### 4.3 What "matching" means

- **Substring match, not prefix match.** `$regex: "ayan"` matches "Mayank" — the text can appear anywhere in the field.
- **Case-insensitive** (`$options: 'i'`).
- **One box, five fields.** The same text is tried against first name, middle name, last name, SMK ID and mobile number, so the user never has to choose a search type:

| User types | Likely matches via |
|---|---|
| `patel` | `LastName` (or `MiddleName`) |
| `may` | `FirstName` |
| `SMK1234` / `1234` | `SmkId` |
| `93274` | `mobileStr` (any part of the phone number) |

- **Single-term only.** The whole input is treated as one pattern against *individual* fields. A full name such as `"Mayank Patel"` will **not** match, because no single field contains that string. Users search one word at a time (e.g. `mayank`, then pick from the list).
- **English fields only.** Only `FirstName`, `MiddleName`, `LastName`, `SmkId` and `MobileNo` are searched. The Gujarati name fields (`FirstNameGuj`, etc.) are returned but not searched.

### 4.4 Response mapping

The DB uses PascalCase field names; the frontend uses camelCase. The route converts each document:

```ts
const formattedUsers = users.map((user: any) => ({
  id: user._id.toString(),
  firstName: user.FirstName,
  middleName: user.MiddleName,
  lastName: user.LastName,
  smkNo: user.SmkId,
  mobileNo: user.MobileNo ? user.MobileNo.toString() : '',
  firstNameGuj: user.FirstNameGuj,
  middleNameGuj: user.MiddleNameGuj,
  lastNameGuj: user.LastNameGuj,
  gender: user.Gender?.toString(),
}));

return NextResponse.json({ users: formattedUsers });
```

| DB field (`smkdetails`) | Frontend `User` field |
|---|---|
| `_id` | `id` |
| `FirstName` / `MiddleName` / `LastName` | `firstName` / `middleName` / `lastName` |
| `SmkId` | `smkNo` |
| `MobileNo` (number) | `mobileNo` (string) |
| `FirstNameGuj` / `MiddleNameGuj` / `LastNameGuj` | `firstNameGuj` / `middleNameGuj` / `lastNameGuj` |
| `Gender` (number) | `gender` (string) |

**Error handling:** any exception is logged and the route returns `500 { message: 'Internal server error' }`. The client catches this and shows an empty result list.

---

## 5. Dropdown behaviour

The dropdown is rendered only when `isFocused && query` is truthy, and shows one of three states:

| Condition | UI |
|---|---|
| `isLoading` | "Searching..." |
| `results.length > 0` | Scrollable list (`max-h-60`) + an "Add New User" footer button (if `showAddUser`) |
| otherwise | "No users found." + a prominent blue "Add New User" button (if `showAddUser`) |

### Focus/blur handling

```tsx
onBlur={() => setTimeout(() => setIsFocused(false), 200)}
```

The blur is delayed by 200 ms so a click on a result isn't swallowed by the dropdown disappearing first. In addition, result rows and the Add button use `onMouseDown` with `e.preventDefault()` — this stops the input from losing focus, so the selection fires reliably (including on touch devices).

---

## 6. Keyboard navigation

Handled by `handleKeyDown` (does nothing if there are no results):

| Key | Action |
|---|---|
| `↓` | Move highlight down (stops at last item) |
| `↑` | Move highlight up (stops at first item) |
| `Enter` | Select the highlighted row (only if one is highlighted) |
| `Esc` | Close the dropdown |

- Mouse hover also updates `activeIndex`, so mouse and keyboard share one highlight.
- `activeIndex` resets to `-1` every time `results` changes.

---

## 7. Selecting a user

```tsx
const handleSelect = (user: User) => {
  onSelectUser(user);   // 1. tell the parent
  setQuery('');         // 2. clear the input
  setResults([]);       // 3. clear the list
  setIsFocused(false);  // 4. close the dropdown
  setActiveIndex(-1);
  inputRef.current?.blur();  // 5. close the mobile keyboard
};
```

In `app/page.tsx` the parent stores the user and bumps a `selectionKey`, which re-mounts `<UserCard key={selectionKey} user={selectedUser} ... />` so the card starts fresh for every selection. The card is where attendance (Present/Absent) is recorded.

---

## 8. Add New User flow

Available only when `showAddUser` is `true`.

1. User clicks **Add New User** (top button, dropdown footer, or the "No users found" button).
2. `handleAddNewUser(searchQuery?)` opens `AddUserModal`.
   - From the **"No users found"** button, the typed query is passed in and pre-fills the modal's **First Name**.
   - From the other two buttons, no text is passed and the form starts empty.
3. The modal submits `POST /api/users`.
4. On success it calls `onUserAdded(user)` → `handleUserAdded`, which calls `onSelectUser(user)` and clears the search. The new person is therefore selected immediately and can be marked present without searching again.

---

## 9. Data model reference (`smkdetails`)

Fields relevant to search are in bold.

| Field | Type | Notes |
|---|---|---|
| **`FirstName`** | String (required) | Searched |
| **`MiddleName`** | String | Searched |
| **`LastName`** | String (required) | Searched |
| **`SmkId`** | String (required) | Searched (shown as "SMK No") |
| **`MobileNo`** | Number | Searched via `$toString` |
| `FirstNameGuj`, `MiddleNameGuj`, `LastNameGuj` | String | Returned, not searched |
| `Gender`, `age`, `BhaktId`, `KutumbId` | Number | Not searched |
| `PresentVillageEng/Guj`, `NativeEng/Guj`, `ZoneName(+Guj)`, `SubZoneName(+Guj)` | String | Not searched |

---

## 10. Known limitations and suggested improvements

These are observations from reading the code, not bugs that have been reproduced.

1. **Unescaped regex input.** `query` goes straight into `$regex`. Characters like `(`, `[`, `*` or `+` are treated as regex syntax and can cause a MongoDB error (→ 500) or very slow patterns (ReDoS-style). Escape it first:
   ```ts
   const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   ```
2. **No indexes can be used.** Case-insensitive, non-anchored regex plus `$toString` on every document forces a full collection scan on each search. This is fine for small data; for a large member list, consider a `$text` index, an Atlas Search index, or storing a pre-computed lowercase/string search field (e.g. `searchText`) and a prefix-anchored search.
3. **Full-name queries don't match.** `"mayank patel"` fails because each field is checked separately. Split the query on whitespace and require every word to match some field (an `$and` of `$or`s).
4. **No sorting.** `$limit: 10` is applied with no `$sort`, so which 10 matches are returned is arbitrary, and exact/prefix matches are not ranked first. Add a `$sort` (e.g. by `FirstName`) before `$limit`.
5. **Out-of-order responses.** The debounce prevents most extra calls, but an older, slower request can still resolve after a newer one and overwrite `results`. Use an `AbortController` (axios `signal`) or ignore stale responses.
6. **"No users found" flash.** After the first keystroke, `results` is `[]` and `isLoading` is still `false` for the 300 ms debounce, so "No users found" can flash before "Searching..." appears. Setting `isLoading` to `true` as soon as `query` changes avoids this.
7. **Enter with nothing highlighted does nothing.** Optionally auto-select the first result (or highlight index `0` by default).
8. **Gujarati names aren't searchable**, even though they are stored. Add `FirstNameGuj`, `MiddleNameGuj` and `LastNameGuj` to the `$or` list if Gujarati search is wanted.
9. **No auth check in this route file.** `app/api/search/route.ts` doesn't verify a session itself; if member data should be private, confirm protection exists elsewhere (e.g. middleware) or add it here.
10. **Minimum length.** A single character (e.g. `a`) triggers a search matching a large part of the collection. A 2-character minimum would cut needless queries.

---

## 11. Quick summary

> The user types in one box. After a 300 ms pause, the component calls `GET /api/search?query=…`. The server converts `MobileNo` to a string, then finds any member whose first name, middle name, last name, SMK ID or mobile number **contains** the text (case-insensitive), returns the first 10, and maps them to the frontend `User` shape. The dropdown shows them with keyboard and mouse selection; picking one passes it to the parent page to mark attendance, and if nobody matches, the user can add a new member straight from the dropdown.
