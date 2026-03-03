# Part 1: Authentication Module & Core Functional Requirements

## FixMyCampus – Smart Campus Problem Reporting System
**Daffodil International University**

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Authentication Module (Compulsory)](#2-authentication-module-compulsory)
3. [Core Feature 1: Posts Feed with Likes & Comments](#3-core-feature-1-posts-feed-with-likes--comments)
4. [Core Feature 2: Groups System](#4-core-feature-2-groups-system)
5. [Database Schema & Interaction](#5-database-schema--interaction)
6. [File Structure](#6-file-structure)
7. [How to Run](#7-how-to-run)

---

## 1. Project Overview

FixMyCampus is a campus problem reporting web application exclusively for Daffodil International University (DIU). It allows students to anonymously report campus issues, interact with posts through likes and comments, join groups, and chat with an AI assistant about university rules.

**Technology Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL, Auth, Edge Functions, RLS)
- UI Library: shadcn/ui (Radix UI primitives)
- Validation: Zod

---

## 2. Authentication Module (Compulsory)

### 2.1 User Registration

**File:** `src/pages/Auth.tsx` (Lines 16-101)

The registration system restricts signups to `@diu.edu.bd` email addresses only.

```typescript
// Auth.tsx - Registration form with validation
const emailSchema = z.string().email("Invalid email").refine(
  (e) => e.endsWith("@diu.edu.bd"),
  { message: "Only @diu.edu.bd emails are allowed" }
);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
```

**Registration Flow:**
1. User enters email and password on the `/auth` page
2. Client-side validation checks:
   - Email must be valid format (Zod `.email()`)
   - Email must end with `@diu.edu.bd` (Zod `.refine()`)
   - Password must be at least 6 characters (Zod `.min(6)`)
3. If validation passes, `signUp()` is called from the `useAuth` hook
4. Server creates the user in `auth.users` table
5. A database trigger (`handle_new_user`) automatically:
   - Creates a profile with a unique anonymous ID (e.g., "Anon-7x3k9")
   - Assigns the default "user" role
6. User receives an email confirmation link
7. After confirming, user can log in

**Anonymous ID Generation (Database Function):**
```sql
-- Generates unique anonymous IDs like "Anon-a1b2c"
CREATE FUNCTION public.generate_anonymous_id() RETURNS text AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := 'Anon-' || substr(md5(random()::text), 1, 5);
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE anonymous_id = new_id) INTO id_exists;
    EXIT WHEN NOT id_exists;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Login Functionality

**File:** `src/hooks/useAuth.tsx` (Lines 93-99)

```typescript
const signIn = async (email: string, password: string) => {
  // Double-check domain restriction at login too
  if (!email.endsWith("@diu.edu.bd")) {
    return { error: { message: "Only @diu.edu.bd email addresses are allowed." } };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
};
```

**Login Flow:**
1. User enters credentials on `/auth` page (same page, toggled via `isLogin` state)
2. Client validates email domain and password length
3. `signInWithPassword()` authenticates against Supabase Auth
4. On success, `onAuthStateChange` listener fires and:
   - Sets the `user` and `session` state
   - Fetches user profile (anonymous_id, is_banned) and roles from database
5. User is redirected to the main page (`/`)

### 2.3 Proper Validation

Validation occurs at **three levels**:

**Level 1 - Client-side (Zod schemas in Auth.tsx):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    toast({ title: "Error", description: emailResult.error.errors[0].message, variant: "destructive" });
    return;
  }
  const passResult = passwordSchema.safeParse(password);
  if (!passResult.success) {
    toast({ title: "Error", description: passResult.error.errors[0].message, variant: "destructive" });
    return;
  }
  // ... proceed with auth
};
```

**Level 2 - Auth hook (useAuth.tsx):**
```typescript
const signUp = async (email: string, password: string) => {
  if (!email.endsWith("@diu.edu.bd")) {
    return { error: { message: "Only @diu.edu.bd email addresses are allowed." } };
  }
  // ... proceed with Supabase signUp
};
```

**Level 3 - Database (Row-Level Security policies):**
All database tables have RLS policies that check `auth.uid()` ensuring only authenticated users can perform operations, and specific roles are required for admin operations.

### 2.4 Secure Password Handling

- **No hardcoded passwords** in client-side code
- Passwords are handled by **Supabase Auth** which uses:
  - bcrypt hashing (passwords never stored in plaintext)
  - JWT tokens for session management
  - Secure HTTP-only cookies
- Session persistence via `localStorage` with auto-refresh tokens:
```typescript
// client.ts - Supabase client configuration
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### 2.5 Session Management & Auth State

**File:** `src/hooks/useAuth.tsx` (Lines 31-58)

```typescript
useEffect(() => {
  // Listen for auth state changes (login, logout, token refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setRoles([]);
        setAnonymousId(null);
        setIsBanned(false);
        setLoading(false);
      }
    }
  );

  // Check for existing session on app load
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      fetchUserData(session.user.id);
    } else {
      setLoading(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

### 2.6 Role-Based Access Control (RBAC)

Three roles: `user`, `admin`, `super_admin`

```typescript
// Derived role checks
const isAdmin = roles.includes("admin") || roles.includes("super_admin");
const isSuperAdmin = roles.includes("super_admin");
```

**Database security function:**
```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 2.7 Route Protection

**File:** `src/pages/Index.tsx` (Lines 15-17)
```typescript
useEffect(() => {
  if (!loading && !user) navigate("/auth", { replace: true });
}, [loading, user, navigate]);
```

**File:** `src/pages/Admin.tsx` (Lines 18-20)
```typescript
useEffect(() => {
  if (!loading && (!user || !isAdmin)) navigate("/", { replace: true });
}, [loading, user, isAdmin, navigate]);
```

---

## 3. Core Feature 1: Posts Feed with Likes & Comments

**File:** `src/components/ViewTab.tsx`

### 3.1 Creating Posts

Users can submit text posts that go into a "pending" approval state:

```typescript
const handleSubmitPost = async () => {
  if (!newPost.trim() || isBanned) return;
  setSubmitting(true);
  const { error } = await supabase
    .from("posts")
    .insert({ author_id: user!.id, content: newPost.trim() });
  // Post status defaults to 'pending' in the database
  setSubmitting(false);
  if (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  } else {
    setNewPost("");
    toast({ title: "Post submitted", description: "Your post is pending approval." });
  }
};
```

**Database Interaction:** Inserts into `posts` table. The `status` column defaults to `'pending'`. Only Super Admins can change status to `'approved'` or `'rejected'`.

### 3.2 Viewing Approved Posts

Only approved posts are shown in the feed:

```typescript
const fetchPosts = async () => {
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, status, created_at, author_id, profiles!posts_author_id_fkey(anonymous_id)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // For each post, fetch like count, comment count, and user's like status
  const postsWithCounts = await Promise.all(
    (data || []).map(async (post) => {
      const [likesRes, commentsRes, userLikeRes] = await Promise.all([
        supabase.from("post_likes").select("id", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
      ]);
      return {
        ...post,
        like_count: likesRes.count || 0,
        comment_count: commentsRes.count || 0,
        user_liked: !!userLikeRes.data,
      };
    })
  );
  setPosts(postsWithCounts);
};
```

**Database Interaction:** 
- Reads from `posts` table (filtered by status = 'approved')
- Joins with `profiles` table to get anonymous_id
- Counts from `post_likes` and `comments` tables
- Checks `post_likes` for current user's like status

### 3.3 Like/Unlike Posts

```typescript
const handleLike = async (postId: string, liked: boolean) => {
  if (liked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user!.id);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: user!.id });
  }
  fetchPosts(); // Refresh to show updated counts
};
```

**Database Interaction:** Inserts/deletes from `post_likes` table. RLS policies ensure users can only like/unlike for themselves and cannot like if banned.

### 3.4 Comments & Replies

```typescript
// CommentsSection component (ViewTab.tsx, Lines 147-235)
const submitComment = async (content: string, parentId: string | null = null) => {
  if (!content.trim() || isBanned) return;
  await supabase.from("comments").insert({
    post_id: postId,
    author_id: user!.id,
    content: content.trim(),
    parent_comment_id: parentId, // null for top-level, comment ID for replies
  });
  fetchComments();
};
```

**Database Interaction:** Inserts into `comments` table. The `parent_comment_id` enables threaded replies. Comments are fetched with a join to profiles for anonymous_id display.

### 3.5 RLS Policies for Posts

```sql
-- Only approved posts visible to regular users (authors see their own, admins see all)
CREATE POLICY "Anyone can view approved posts" ON posts FOR SELECT
USING (status = 'approved' OR author_id = auth.uid() OR is_admin_or_super(auth.uid()));

-- Non-banned users can create posts
CREATE POLICY "Non-banned users can create posts" ON posts FOR INSERT
WITH CHECK (auth.uid() = author_id AND NOT is_banned(auth.uid()));

-- Only super admins can approve/reject (update status)
CREATE POLICY "Super admins can update posts" ON posts FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'));

-- Admins can delete any post
CREATE POLICY "Admins can delete posts" ON posts FOR DELETE
USING (is_admin_or_super(auth.uid()));
```

---

## 4. Core Feature 2: Groups System

**File:** `src/components/GroupsTab.tsx`

### 4.1 Viewing & Joining Groups

```typescript
const fetchGroups = async () => {
  const [groupsRes, membersRes] = await Promise.all([
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
    supabase.from("group_members").select("group_id").eq("user_id", user!.id),
  ]);
  setGroups(groupsRes.data || []);
  setMemberships((membersRes.data || []).map((m) => m.group_id));
};

const joinGroup = async (groupId: string) => {
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: user!.id });
  if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  else fetchGroups();
};

const leaveGroup = async (groupId: string) => {
  await supabase.from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user!.id);
  fetchGroups();
};
```

**Database Interaction:**
- Reads from `groups` table (all groups are public)
- Reads from `group_members` to determine user's current memberships
- Inserts/deletes from `group_members` for join/leave

### 4.2 Group Posts

Members can post directly in groups (no approval required):

```typescript
const submitGroupPost = async () => {
  if (!newPost.trim() || isBanned || !selectedGroup) return;
  const { error } = await supabase.from("group_posts").insert({
    group_id: selectedGroup.id,
    author_id: user!.id,
    content: newPost.trim(),
  });
  if (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  } else {
    setNewPost("");
    openGroup(selectedGroup); // Refresh posts
  }
};
```

**Database Interaction:** Inserts into `group_posts`. RLS policy verifies the user is a member of the group before allowing the insert.

### 4.3 RLS Policies for Groups

```sql
-- Anyone can view groups
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);

-- Only super admins can create/update/delete groups
CREATE POLICY "Super admins can create groups" ON groups FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Only group members can view group posts
CREATE POLICY "Group members can view group posts" ON group_posts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_members
  WHERE group_members.group_id = group_posts.group_id
  AND group_members.user_id = auth.uid()
) OR is_admin_or_super(auth.uid()));

-- Only group members who are not banned can post
CREATE POLICY "Group members can post" ON group_posts FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND NOT is_banned(auth.uid())
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_posts.group_id
    AND group_members.user_id = auth.uid()
  )
);
```

---

## 5. Database Schema & Interaction

### 5.1 Tables Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | Anonymous user identity | `user_id`, `anonymous_id`, `is_banned` |
| `user_roles` | RBAC role assignments | `user_id`, `role` (enum: user/admin/super_admin) |
| `posts` | Campus issue reports | `author_id`, `content`, `status` (enum: pending/approved/rejected) |
| `post_likes` | Like tracking | `post_id`, `user_id` (unique constraint) |
| `comments` | Post comments & replies | `post_id`, `author_id`, `parent_comment_id` |
| `groups` | Public groups | `name`, `description`, `created_by` |
| `group_members` | Group membership | `group_id`, `user_id` |
| `group_posts` | Posts within groups | `group_id`, `author_id`, `content` |
| `diu_knowledge_base` | AI chatbot knowledge | `category`, `question`, `answer` |

### 5.2 Database Triggers

```sql
-- Auto-create profile and assign 'user' role on signup
CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, anonymous_id)
  VALUES (NEW.id, public.generate_anonymous_id());
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger: AFTER INSERT ON auth.users → handle_new_user()
```

### 5.3 Security Functions

| Function | Purpose |
|----------|---------|
| `has_role(_user_id, _role)` | Check if user has a specific role |
| `is_admin_or_super(_user_id)` | Check if user is admin or super_admin |
| `is_banned(_user_id)` | Check if user is banned |
| `generate_anonymous_id()` | Generate unique "Anon-xxxxx" ID |

All security functions use `SECURITY DEFINER` to bypass RLS and prevent recursive policy checks.

---

## 6. File Structure

```
├── src/
│   ├── pages/
│   │   ├── Auth.tsx          ← Login/Signup page (Section 2)
│   │   ├── Index.tsx         ← Main app with 3 tabs
│   │   ├── Admin.tsx         ← Admin panel (role-gated)
│   │   └── NotFound.tsx      ← 404 page
│   ├── hooks/
│   │   ├── useAuth.tsx       ← Auth context, session mgmt, RBAC (Section 2)
│   │   └── use-toast.ts     ← Toast notifications
│   ├── components/
│   │   ├── ViewTab.tsx       ← Posts feed, likes, comments (Section 3)
│   │   ├── GroupsTab.tsx     ← Groups, join/leave, group posts (Section 4)
│   │   ├── AITab.tsx         ← AI chatbot interface
│   │   └── ui/              ← shadcn/ui components
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts     ← Supabase client (auto-generated)
│   │       └── types.ts      ← Database types (auto-generated)
│   ├── App.tsx               ← Root component with routing
│   └── main.tsx              ← Entry point
├── supabase/
│   ├── functions/
│   │   ├── diu-chat/         ← AI chatbot edge function
│   │   ├── seed-admins/      ← Admin account seeding
│   │   └── manage-admin-user/ ← Credential management
│   └── config.toml           ← Edge function configuration
└── part-1/                   ← This documentation folder
    └── README.md
```

---

## 7. How to Run

```bash
# Install dependencies
npm install

# Set environment variables (.env file)
VITE_SUPABASE_URL=<your_supabase_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your_supabase_anon_key>

# Start development server
npm run dev

# The app runs on http://localhost:5173
```

**Pre-configured Accounts:**
- Super Admin: `shaon23105341012@diu.edu.bd` / `shaon0188`
- Admin: `utsho0242310005341112@diu.edu.bd` / `utsho1112`

**Regular User Flow:**
1. Go to `/auth`
2. Sign up with any `@diu.edu.bd` email
3. Confirm email via link
4. Log in and use the app

---

*This document covers Part 1 requirements: Authentication Module + Two Core Functional Requirements (Posts System & Groups System) with demonstrated database interaction.*
