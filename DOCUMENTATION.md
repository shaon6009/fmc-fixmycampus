# FixMyCampus — Complete Project Documentation

> **Smart Campus Problem Reporting System for Daffodil International University (DIU)**
> 
> Version: 1.0 | Last Updated: February 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication & Identity System](#4-authentication--identity-system)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Database Schema](#6-database-schema)
7. [Database Functions & Triggers](#7-database-functions--triggers)
8. [Row-Level Security (RLS) Policies](#8-row-level-security-rls-policies)
9. [Frontend — File-by-File Breakdown](#9-frontend--file-by-file-breakdown)
10. [Backend — Edge Functions](#10-backend--edge-functions)
11. [Design System & Theming](#11-design-system--theming)
12. [Application Routes](#12-application-routes)
13. [User Flows](#13-user-flows)
14. [Admin Credentials](#14-admin-credentials)
15. [Environment Variables & Secrets](#15-environment-variables--secrets)
16. [How to Extend / Modify](#16-how-to-extend--modify)

---

## 1. Project Overview

**FixMyCampus** is a fully anonymous campus problem reporting system exclusively for Daffodil International University. Students and staff can:

- Report campus issues anonymously (text-only posts)
- Like and comment on posts
- Join and participate in groups
- Ask an AI chatbot about DIU rules and regulations

All user identities are protected behind auto-generated anonymous IDs (e.g., `Anon-7x3k9`). No real names or profile pictures are ever exposed.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Anonymous-only identity | Encourages honest feedback without fear of reprisal |
| Text-only (no images) | Simplifies moderation and prevents misuse |
| Post approval system | Super Admin must approve posts before they're visible |
| @diu.edu.bd email restriction | Ensures only DIU members can participate |
| Email confirmation (link-based) | Regular users must verify email; admins are pre-confirmed |

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first CSS |
| **shadcn/ui** | Pre-built accessible UI components |
| **React Router v6** | Client-side routing |
| **TanStack React Query** | Server state management (available, lightly used) |
| **Lucide React** | Icon library |
| **date-fns** | Date formatting |
| **Zod** | Schema validation |
| **react-markdown** | Markdown rendering for AI responses |

### Backend (Lovable Cloud / Supabase)
| Technology | Purpose |
|---|---|
| **PostgreSQL** | Relational database |
| **Supabase Auth** | User authentication (email/password) |
| **Row-Level Security (RLS)** | Data access control at DB level |
| **Edge Functions (Deno)** | Serverless backend logic |
| **Lovable AI Gateway** | AI chatbot (Gemini model) |

---

## 3. Project Structure

```
├── .lovable/
│   └── plan.md                          # Project plan/spec
│
├── public/
│   ├── favicon.ico                      # App icon
│   ├── placeholder.svg                  # Placeholder image
│   └── robots.txt                       # SEO robots file
│
├── src/
│   ├── main.tsx                         # App entry point
│   ├── App.tsx                          # Root component with routing
│   ├── App.css                          # Global styles (minimal)
│   ├── index.css                        # Tailwind + design tokens
│   ├── vite-env.d.ts                    # Vite type declarations
│   │
│   ├── pages/
│   │   ├── Index.tsx                    # Main app (3 tabs: View, Groups, AI)
│   │   ├── Auth.tsx                     # Login/Signup page
│   │   ├── Admin.tsx                    # Admin dashboard (role-gated)
│   │   └── NotFound.tsx                 # 404 page
│   │
│   ├── components/
│   │   ├── ViewTab.tsx                  # Posts feed + comments
│   │   ├── GroupsTab.tsx                # Groups list + group posts
│   │   ├── AITab.tsx                    # AI chatbot interface
│   │   ├── NavLink.tsx                  # Wrapper for React Router NavLink
│   │   └── ui/                          # shadcn/ui components (40+ files)
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx                  # Auth context & provider
│   │   ├── use-mobile.tsx               # Mobile detection hook
│   │   └── use-toast.ts                 # Toast notification hook
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts                # Supabase client (auto-generated, DO NOT EDIT)
│   │       └── types.ts                 # Database types (auto-generated, DO NOT EDIT)
│   │
│   ├── lib/
│   │   └── utils.ts                     # Utility functions (cn() for classnames)
│   │
│   └── test/
│       ├── setup.ts                     # Test setup
│       └── example.test.ts              # Example test
│
├── supabase/
│   ├── config.toml                      # Edge function configuration
│   └── functions/
│       ├── diu-chat/
│       │   └── index.ts                 # AI chatbot edge function
│       ├── seed-admins/
│       │   └── index.ts                 # Admin account seeding
│       └── manage-admin-user/
│           └── index.ts                 # Admin credential management
│
├── index.html                           # HTML entry point
├── vite.config.ts                       # Vite configuration
├── tailwind.config.ts                   # Tailwind configuration
├── tsconfig.json                        # TypeScript config (root)
├── tsconfig.app.json                    # TypeScript config (app)
├── tsconfig.node.json                   # TypeScript config (node)
├── vitest.config.ts                     # Vitest test config
├── components.json                      # shadcn/ui config
├── postcss.config.js                    # PostCSS config
└── eslint.config.js                     # ESLint config
```

---

## 4. Authentication & Identity System

### File: `src/hooks/useAuth.tsx`

This is the central authentication module. It provides a React Context that wraps the entire app.

#### How it works (line by line):

```
Lines 1-3: Import React hooks, Supabase types, and the Supabase client
Lines 5: Define the UserRole type — "user" | "admin" | "super_admin"
Lines 7-19: Define the AuthContextType interface with all auth-related state and methods
Line 21: Create the AuthContext with an empty default value
```

#### AuthProvider Component (Lines 23-115)

**State Variables (Lines 24-29):**
- `user` — The Supabase User object (or null if logged out)
- `session` — The Supabase Session object (contains JWT token)
- `loading` — Boolean, true while auth state is being determined
- `roles` — Array of UserRole ("user", "admin", "super_admin")
- `anonymousId` — The user's anonymous display name (e.g., "Anon-7x3k9")
- `isBanned` — Whether the user is banned from posting/commenting

**Auth State Listener (Lines 31-58):**
- `onAuthStateChange` subscribes to auth events (login, logout, token refresh)
- When a user is detected, `fetchUserData()` is called (with `setTimeout(0)` to avoid Supabase deadlocks)
- On logout, all state is reset
- `getSession()` runs on mount to check for an existing session

**fetchUserData (Lines 60-79):**
- Runs two parallel queries:
  1. Fetches the user's profile (anonymous_id, is_banned) from `profiles` table
  2. Fetches the user's roles from `user_roles` table
- Sets state accordingly and marks loading as false

**signUp (Lines 81-91):**
- Validates email ends with `@diu.edu.bd` (client-side check)
- Calls Supabase Auth `signUp` with `emailRedirectTo` for confirmation link
- Returns any error to the caller

**signIn (Lines 93-99):**
- Same email domain validation
- Uses `signInWithPassword` — standard email/password auth

**signOut (Lines 101-103):**
- Simply calls `supabase.auth.signOut()`

**Computed Properties (Lines 105-106):**
- `isAdmin` — true if roles include "admin" OR "super_admin"
- `isSuperAdmin` — true if roles include "super_admin"

**Provider Render (Lines 108-114):**
- Wraps children in AuthContext.Provider, exposing all state and methods

**useAuth Hook (Line 117):**
- Convenience hook to consume the AuthContext

### How New Users Are Created

When a user signs up via Supabase Auth, a **database trigger** (`handle_new_user`) automatically:
1. Creates a row in `profiles` with a randomly generated `anonymous_id`
2. Assigns the default `"user"` role in `user_roles`

---

## 5. Role-Based Access Control (RBAC)

### Three Roles

| Role | Permissions |
|---|---|
| `user` | View approved posts, like, comment, join groups, use AI chat |
| `admin` | All user permissions + delete any post/comment |
| `super_admin` | All admin permissions + approve/reject posts, manage groups, ban users, manage knowledge base, manage admin credentials, view analytics |

### How RBAC is Enforced

1. **Database Level (RLS Policies)** — PostgreSQL Row-Level Security policies use helper functions (`has_role()`, `is_admin_or_super()`, `is_banned()`) to check permissions on every query
2. **UI Level** — Components check `isAdmin` and `isSuperAdmin` from `useAuth()` to show/hide admin features
3. **Edge Function Level** — The `manage-admin-user` function verifies the caller's `super_admin` role before processing

---

## 6. Database Schema

### Table: `profiles`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | References the auth user (NOT a FK to auth.users) |
| `anonymous_id` | TEXT | — | Auto-generated display name (e.g., "Anon-7x3k9") |
| `is_banned` | BOOLEAN | `false` | Whether user is banned |
| `created_at` | TIMESTAMPTZ | `now()` | Account creation timestamp |

### Table: `user_roles`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | — | The user this role belongs to |
| `role` | `app_role` enum | — | One of: `user`, `admin`, `super_admin` |

### Table: `posts`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `author_id` | UUID | — | References `profiles.user_id` |
| `content` | TEXT | — | Post text content |
| `status` | `post_status` enum | `'pending'` | One of: `pending`, `approved`, `rejected` |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

### Table: `post_likes`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `post_id` | UUID | — | References `posts.id` |
| `user_id` | UUID | — | The user who liked |
| `created_at` | TIMESTAMPTZ | `now()` | Like timestamp |

### Table: `comments`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `post_id` | UUID | — | References `posts.id` |
| `author_id` | UUID | — | References `profiles.user_id` |
| `parent_comment_id` | UUID (nullable) | — | References `comments.id` for replies |
| `content` | TEXT | — | Comment text |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

### Table: `groups`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `name` | TEXT | — | Group name |
| `description` | TEXT (nullable) | — | Group description |
| `created_by` | UUID (nullable) | — | User who created the group |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

### Table: `group_members`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `group_id` | UUID | — | References `groups.id` |
| `user_id` | UUID | — | The member |
| `joined_at` | TIMESTAMPTZ | `now()` | Join timestamp |

### Table: `group_posts`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `group_id` | UUID | — | References `groups.id` |
| `author_id` | UUID | — | References `profiles.user_id` |
| `content` | TEXT | — | Post text |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |

### Table: `diu_knowledge_base`
| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `category` | TEXT | — | Category (e.g., "Exams", "Fees") |
| `question` | TEXT | — | FAQ question |
| `answer` | TEXT | — | FAQ answer |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | `now()` | Last update timestamp |

### Enums

- **`app_role`**: `'user'` | `'admin'` | `'super_admin'`
- **`post_status`**: `'pending'` | `'approved'` | `'rejected'`

---

## 7. Database Functions & Triggers

### `generate_anonymous_id()` — Returns TEXT
Generates a unique anonymous ID like `"Anon-7x3k9"`:
- Creates a random 5-char hex string from `md5(random())`
- Loops until the generated ID doesn't exist in `profiles`

### `handle_new_user()` — Trigger Function
Fires on `INSERT` into `auth.users`:
1. Inserts a new row in `profiles` with the user's ID and a generated `anonymous_id`
2. Inserts a `'user'` role into `user_roles`

### `has_role(_user_id UUID, _role app_role)` — Returns BOOLEAN
Checks if a specific user has a specific role. Used in RLS policies. Defined as `SECURITY DEFINER` so it bypasses RLS on the `user_roles` table.

### `is_admin_or_super(_user_id UUID)` — Returns BOOLEAN
Checks if user has either `admin` or `super_admin` role. Used in RLS policies for admin-level operations.

### `is_banned(_user_id UUID)` — Returns BOOLEAN
Checks if user is banned by looking at `profiles.is_banned`. Used in RLS policies to prevent banned users from posting.

### `update_updated_at_column()` — Trigger Function
Updates the `updated_at` column to `now()`. Used on `diu_knowledge_base`.

---

## 8. Row-Level Security (RLS) Policies

Every table has RLS enabled. Here's a summary:

### `profiles`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone can view | `true` (anonymous IDs are safe to expose) |
| UPDATE | Own profile only | `auth.uid() = user_id` |
| INSERT | ❌ Blocked | Handled by trigger only |
| DELETE | ❌ Blocked | Not allowed |

### `user_roles`
| Operation | Policy | Rule |
|---|---|---|
| SELECT (own) | Users see own roles | `auth.uid() = user_id` |
| SELECT (all) | Super admins see all | `has_role(auth.uid(), 'super_admin')` |
| INSERT | Super admins only | `has_role(auth.uid(), 'super_admin')` |
| DELETE | Super admins only | `has_role(auth.uid(), 'super_admin')` |
| UPDATE | ❌ Blocked | Not allowed |

### `posts`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Approved + own + admin | `status = 'approved' OR author_id = auth.uid() OR is_admin_or_super(auth.uid())` |
| INSERT | Non-banned users | `auth.uid() = author_id AND NOT is_banned(auth.uid())` |
| UPDATE | Super admins only | `has_role(auth.uid(), 'super_admin')` |
| DELETE | Admins | `is_admin_or_super(auth.uid())` |

### `post_likes`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone | `true` |
| INSERT | Non-banned users | `auth.uid() = user_id AND NOT is_banned(auth.uid())` |
| DELETE | Own likes only | `auth.uid() = user_id` |

### `comments`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone | `true` |
| INSERT | Non-banned users | `auth.uid() = author_id AND NOT is_banned(auth.uid())` |
| DELETE | Admins only | `is_admin_or_super(auth.uid())` |

### `groups`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone | `true` |
| INSERT/UPDATE/DELETE | Super admins | `has_role(auth.uid(), 'super_admin')` |

### `group_members`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone | `true` |
| INSERT | Non-banned users (own) | `auth.uid() = user_id AND NOT is_banned(auth.uid())` |
| DELETE | Own membership | `auth.uid() = user_id` |

### `group_posts`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Group members + admins | Must be a member of the group OR admin |
| INSERT | Group members, non-banned | Must be member + not banned |
| DELETE | Admins | `is_admin_or_super(auth.uid())` |

### `diu_knowledge_base`
| Operation | Policy | Rule |
|---|---|---|
| SELECT | Anyone | `true` |
| INSERT/UPDATE/DELETE | Super admins | `has_role(auth.uid(), 'super_admin')` |

---

## 9. Frontend — File-by-File Breakdown

### `src/main.tsx`
**Purpose:** Application entry point. Renders the `<App />` component into the DOM root.

### `src/App.tsx`
**Purpose:** Root component that sets up all providers and routing.

**Line-by-line:**
- Lines 1-5: Import UI providers (Toaster, Sonner, Tooltip), React Query, React Router
- Line 6: Import `AuthProvider` from `useAuth` hook
- Lines 7-10: Import page components
- Line 12: Create a QueryClient instance for React Query
- Lines 14-31: App component renders:
  - `QueryClientProvider` — enables React Query throughout the app
  - `TooltipProvider` — enables tooltips from shadcn/ui
  - `Toaster` + `Sonner` — two toast notification systems
  - `BrowserRouter` — enables client-side routing
  - `AuthProvider` — wraps all routes with auth context
  - `Routes` — defines 4 routes: `/`, `/auth`, `/admin`, `*`

### `src/pages/Auth.tsx`
**Purpose:** Login and signup page restricted to @diu.edu.bd emails.

**Key sections:**
- **Lines 11-14:** Zod validation schemas — email must end with `@diu.edu.bd`, password min 6 chars
- **Lines 25-28:** If user is already logged in, redirect to `/`
- **Lines 30-51:** `handleSubmit` — validates input with Zod, calls `signIn` or `signUp`, shows toast on success/error
- **Lines 54-100:** UI — centered card with Shield icon, email input, password input, submit button, toggle between login/signup

### `src/pages/Index.tsx`
**Purpose:** Main app page with 3 tabs (View, Groups, AI).

**Key sections:**
- **Lines 15-17:** Redirect to `/auth` if not logged in
- **Lines 31-46:** Header — shows "FixMyCampus" title, anonymous ID, admin settings button (if admin), logout button
- **Lines 48-67:** Three tabs using shadcn Tabs component, each rendering its respective component

### `src/pages/Admin.tsx`
**Purpose:** Admin dashboard with multiple management tabs. Access restricted to admin/super_admin roles.

**Contains 7 sub-components:**

#### `Admin` (main, Lines 14-57)
- Redirects non-admins to `/`
- Renders tabbed interface; Super Admin sees all tabs, regular Admin sees only "Posts"

#### `PendingPosts` (Lines 59-97)
- Fetches posts with `status = 'pending'`
- Shows Approve/Reject buttons for each post
- Calls `supabase.from("posts").update({ status })` on action

#### `AllPosts` (Lines 99-135)
- Shows all posts regardless of status
- Admin can delete any post

#### `ManageGroups` (Lines 137-185)
- Create new groups (name + optional description)
- Delete existing groups

#### `ManageUsers` (Lines 187-246)
- Lists all profiles with their roles
- Toggle admin role on/off
- Ban/unban users

#### `KnowledgeBase` (Lines 248-298)
- Add new FAQ entries (category, question, answer)
- Delete existing entries
- These entries feed the AI chatbot

#### `ManageCredentials` (Lines 300-377)
- Lists admin/super_admin users
- Edit email or password via `manage-admin-user` edge function
- No current password verification required (by design)

#### `Analytics` (Lines 379-418)
- Shows 4 stat cards: Total Posts, Total Users, Active Groups, Pending Posts
- Uses `count: "exact", head: true` for efficient counting

### `src/components/ViewTab.tsx`
**Purpose:** Main posts feed showing approved posts with likes and comments.

**Key sections:**
- **Lines 32-58:** `fetchPosts` — Fetches approved posts with author profiles, then for each post fetches like count, comment count, and whether current user has liked it (3 parallel queries per post)
- **Lines 62-73:** `handleSubmitPost` — Inserts new post (status defaults to `'pending'`), shows confirmation toast
- **Lines 75-82:** `handleLike` — Toggles like (insert or delete from `post_likes`)
- **Lines 84-144:** Post feed UI — textarea for new posts, list of post cards with like/comment buttons

#### `CommentsSection` (Lines 147-235)
- Nested component rendered when user expands comments on a post
- **Lines 154-161:** Fetches all comments for a post with author profiles
- **Lines 165-177:** `submitComment` — Inserts comment, supports replies via `parent_comment_id`
- **Lines 179-180:** Separates top-level comments from replies
- **Lines 182-234:** Renders threaded comments with reply functionality

### `src/components/GroupsTab.tsx`
**Purpose:** Groups list and individual group view.

**Key sections:**
- **Lines 20-28:** `fetchGroups` — Fetches all groups and current user's memberships in parallel
- **Lines 32-36:** `joinGroup` — Inserts into `group_members`
- **Lines 38-42:** `leaveGroup` — Deletes from `group_members`
- **Lines 44-52:** `openGroup` — Fetches group posts with author profiles
- **Lines 54-67:** `submitGroupPost` — Inserts post into `group_posts`
- **Lines 69-111:** Group detail view — back button, post input (if member), list of posts
- **Lines 113-144:** Group list view — cards with join/leave buttons

### `src/components/AITab.tsx`
**Purpose:** AI chatbot interface for DIU rules and regulations.

**Key sections:**
- **Line 9:** `CHAT_URL` — Constructed from `VITE_SUPABASE_URL` + edge function path
- **Lines 21-92:** `send` — The core streaming chat function:
  - Adds user message to state
  - Sends POST to `diu-chat` edge function with conversation history
  - Reads SSE (Server-Sent Events) stream from response
  - Parses each `data:` line as JSON, extracts `choices[0].delta.content`
  - Progressively updates the assistant message in state
  - Handles errors gracefully
- **Lines 94-159:** Chat UI — disclaimer banner, scrollable message area with bot/user avatars, input field with Enter-to-send

### `src/components/NavLink.tsx`
**Purpose:** Wrapper around React Router's `NavLink` that integrates with the `cn()` utility for conditional classNames. Supports `activeClassName` and `pendingClassName` props.

### `src/hooks/use-mobile.tsx`
**Purpose:** Custom hook that returns `true` if viewport width < 768px. Used for responsive behavior.

### `src/hooks/use-toast.ts`
**Purpose:** Toast notification hook (shadcn/ui implementation).

### `src/lib/utils.ts`
**Purpose:** Contains the `cn()` function — merges Tailwind classes using `clsx` + `tailwind-merge`. Used throughout all components.

### `src/integrations/supabase/client.ts` ⚠️ AUTO-GENERATED
**Purpose:** Creates and exports the Supabase client. Uses env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. **Never edit this file.**

### `src/integrations/supabase/types.ts` ⚠️ AUTO-GENERATED
**Purpose:** TypeScript types generated from the database schema. Defines all table Row/Insert/Update types, enums, and function signatures. **Never edit this file.**

---

## 10. Backend — Edge Functions

Edge functions run on Deno (serverless) and are deployed automatically.

### `supabase/functions/diu-chat/index.ts`
**Purpose:** AI chatbot endpoint that answers DIU-related questions.

**Configuration:** `verify_jwt = false` (accessible without auth token, uses API key in header)

**How it works:**
1. **Line 14:** Extracts `messages` array from request body
2. **Lines 15-16:** Gets `LOVABLE_API_KEY` from environment
3. **Lines 19-21:** Creates Supabase admin client
4. **Lines 23-26:** Fetches up to 100 knowledge base entries from `diu_knowledge_base`
5. **Lines 28-32:** Formats entries as context string: `[Category] Q: ... A: ...`
6. **Lines 34-44:** Constructs system prompt with rules (DIU-only, honest, concise) + knowledge base context
7. **Lines 46-57:** Sends request to Lovable AI Gateway (`ai.gateway.lovable.dev`) with Gemini model, streaming enabled
8. **Lines 59-78:** Error handling for rate limits (429), credit exhaustion (402), and generic errors
9. **Lines 80-82:** Returns the streaming response body directly to the client

### `supabase/functions/seed-admins/index.ts`
**Purpose:** Creates or updates the pre-configured admin accounts.

**Configuration:** `verify_jwt = false` (callable without auth)

**How it works:**
1. **Lines 21-24:** Defines admin accounts with hardcoded emails and passwords
2. **Lines 28-68:** For each admin:
   - Checks if user already exists in auth system
   - If exists: updates password and confirms email
   - If new: creates user with confirmed email
   - Ensures the correct role exists in `user_roles`
3. Returns results summary

### `supabase/functions/manage-admin-user/index.ts`
**Purpose:** Allows Super Admin to update admin credentials (email/password).

**Configuration:** `verify_jwt = true` (requires authenticated request)

**How it works:**
1. **Lines 22-36:** Verifies the caller:
   - Extracts JWT from Authorization header
   - Gets user from token
   - Checks if caller has `super_admin` role
2. **Lines 38-51:** Processes `update_credentials` action:
   - Accepts `userId`, optional `email`, optional `password`
   - Uses Supabase Admin API to update the user
   - No current password verification (by design for admin management)

### `supabase/config.toml`
**Purpose:** Configuration for edge functions.

```toml
[functions.diu-chat]
verify_jwt = false          # No JWT needed (uses API key instead)

[functions.seed-admins]
verify_jwt = false          # Callable without auth

[functions.manage-admin-user]
verify_jwt = true           # Requires valid JWT (super admin only)
```

---

## 11. Design System & Theming

### File: `src/index.css`

Uses CSS custom properties (HSL format) for a consistent design system.

**Primary Color:** Green (`hsl(152, 60%, 36%)`) — represents DIU's identity

**Light Mode (Lines 6-50):**
- Background: Light gray-blue (`210 20% 98%`)
- Cards: Pure white
- Primary: Green
- Accent: Light green
- Destructive: Red

**Dark Mode (Lines 52-94):**
- Background: Dark blue-gray (`220 20% 7%`)
- Cards: Slightly lighter dark
- Primary: Brighter green (`152 55% 45%`)

**Usage in Components:**
- Never use raw colors — always use semantic tokens like `bg-primary`, `text-muted-foreground`, etc.
- Tailwind is configured to use these CSS variables

### File: `tailwind.config.ts`
- Extends default Tailwind with the CSS custom property tokens
- Configures border-radius using `--radius`
- Sets up shadcn/ui compatible theming

---

## 12. Application Routes

| Route | Component | Access | Description |
|---|---|---|---|
| `/` | `Index.tsx` | Authenticated users | Main app with 3 tabs |
| `/auth` | `Auth.tsx` | Public | Login/Signup |
| `/admin` | `Admin.tsx` | Admin/Super Admin | Admin dashboard |
| `*` | `NotFound.tsx` | Public | 404 page |

**Navigation Flow:**
- Unauthenticated users → redirected to `/auth`
- Authenticated users on `/auth` → redirected to `/`
- Non-admin users on `/admin` → redirected to `/`

---

## 13. User Flows

### Regular User Flow
1. Visit `/auth` → Sign up with `@diu.edu.bd` email
2. Receive email confirmation link → Click to verify
3. Sign in → Redirected to `/` with auto-generated anonymous ID
4. **View Tab:** See approved posts, like/comment, submit new posts (pending approval)
5. **Groups Tab:** Browse groups, join/leave, post in joined groups
6. **AI Tab:** Ask questions about DIU rules

### Admin Flow
1. Sign in with admin credentials
2. See Settings gear icon in header → Navigate to `/admin`
3. **Posts Tab:** View all posts, delete inappropriate ones

### Super Admin Flow
1. Sign in with super admin credentials
2. Navigate to `/admin`
3. **Pending Tab:** Approve or reject user-submitted posts
4. **Posts Tab:** View/delete all posts
5. **Groups Tab:** Create/delete groups
6. **Users Tab:** Ban/unban users, assign/remove admin roles
7. **Credentials Tab:** Update admin/super admin email and password
8. **Knowledge Base Tab:** Add/delete FAQ entries for AI chatbot
9. **Analytics Tab:** View platform statistics

---

## 14. Admin Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `shaon23105341012@diu.edu.bd` | `shaon0188` |
| Admin | `utsho0242310005341112@diu.edu.bd` | `utsho1112` |

These accounts are created/updated by calling the `seed-admins` edge function. They are pre-confirmed (no email verification needed).

The Super Admin can change these credentials from the **Credentials** tab in the admin panel.

---

## 15. Environment Variables & Secrets

### Frontend (.env — auto-generated, DO NOT EDIT)
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

### Backend Secrets (Edge Functions)
| Secret | Description |
|---|---|
| `SUPABASE_URL` | Same as frontend URL |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) |
| `SUPABASE_DB_URL` | Direct database connection string |
| `LOVABLE_API_KEY` | Key for Lovable AI Gateway (used by diu-chat) |

---

## 16. How to Extend / Modify

### Adding a New Database Table
1. Use the Lovable migration tool to write SQL
2. Include RLS policies for security
3. The `types.ts` file will auto-update after migration

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link where appropriate

### Adding a New Admin Feature
1. Create a new function component inside `src/pages/Admin.tsx`
2. Add a new `TabsTrigger` and `TabsContent` in the `Admin` component
3. Guard with `{isSuperAdmin && ...}` if needed

### Adding New Knowledge Base Entries
1. Go to Admin Panel → Knowledge Base tab
2. Add category, question, and answer
3. The AI chatbot will automatically include these in its responses

### Modifying the AI System Prompt
Edit `supabase/functions/diu-chat/index.ts`, lines 34-44. The system prompt defines the AI's behavior and rules.

### Adding New RLS Policies
Use the Lovable migration tool with SQL like:
```sql
CREATE POLICY "policy_name" ON public.table_name
FOR SELECT USING (your_condition);
```

---

## Appendix: Key Patterns Used

### Pattern 1: Parallel Data Fetching
```typescript
const [res1, res2] = await Promise.all([
  supabase.from("table1").select("*"),
  supabase.from("table2").select("*"),
]);
```
Used throughout to minimize load times.

### Pattern 2: Optimistic Count Queries
```typescript
supabase.from("table").select("id", { count: "exact", head: true })
```
Returns only the count without fetching actual rows — efficient for analytics.

### Pattern 3: Security Definer Functions
Database functions marked `SECURITY DEFINER` run with the function creator's permissions, bypassing RLS. Used for role-checking functions so RLS policies can check roles without circular dependencies.

### Pattern 4: Streaming AI Responses
The AI chat uses Server-Sent Events (SSE) streaming. The edge function proxies the stream from the AI gateway directly to the client, enabling real-time token-by-token display.

---

*This documentation was generated for the FixMyCampus project. For questions, refer to the plan at `.lovable/plan.md`.*
