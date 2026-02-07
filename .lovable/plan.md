

# FixMyCampus – Smart Campus Problem Reporting System
**Daffodil International University Only**

## 1. Authentication & Identity
- Email/password signup and login restricted to **@diu.edu.bd** emails only (client + server validation)
- On first signup, auto-generate a permanent **anonymous User ID** (e.g., "Anon-7x3k9") stored in a profiles table — no real name, no profile picture, no profile editing
- User identity is never exposed; all posts and comments display only the anonymous ID
- Specific Super Admin email(s) seeded into the roles table via database migration

## 2. Role-Based Access Control (RBAC)
- **Three roles**: `user`, `admin` (moderator), `super_admin`
- Roles stored in a separate `user_roles` table with a security-definer `has_role()` function
- Row-Level Security (RLS) policies enforce permissions at the database level
- Super Admin email(s) are pre-configured; additional admins can be promoted by Super Admin

## 3. User Interface — 3 Tabs Only

### Tab 1: VIEW (Posts Feed)
- Shows only **approved** text-only posts (no images anywhere)
- Each post shows: anonymous ID, timestamp, post text, like count, comment count
- Users can **like**, **comment**, and **reply** to comments
- Users can **create new posts** — these go into a "pending approval" state
- Users **cannot edit or delete** their own posts
- Post submission form: text area + submit button, with a note that posts require approval

### Tab 2: GROUPS
- List of **public groups** created by Super Admin
- Users can **join/leave** groups
- Inside a group: text-only group posts (no approval required for group posts, or with approval — we'll keep it simple: no approval needed for group posts)
- Users **cannot create or manage groups**

### Tab 3: AI
- AI chatbot interface for DIU rules, regulations, and guidance
- **Knowledge base approach**: DIU rules/FAQs stored in a database table, relevant entries retrieved and sent to the AI (Lovable AI Gateway with Gemini) for contextual answers
- Disclaimer banner: "This AI provides informational guidance only. For official decisions, contact university administration."
- Streaming chat interface with conversation history

## 4. Admin Panel (for Admin & Super Admin)

Accessed via a separate `/admin` route (visible only to admin/super_admin roles):

### Admin (Moderator) can:
- Delete any post
- Delete any comment

### Super Admin can do everything Admin can, plus:
- **Approve/reject** pending posts (approval queue)
- **Create, update, delete** posts directly
- **Create, update, delete** public groups
- **Ban/unban** users
- **View analytics** dashboard (post counts, user counts, active groups)
- **Manage DIU knowledge base** (add/edit/delete FAQ entries for AI chatbot)
- **Assign/remove admin roles** to other users

## 5. Database Schema (Supabase/PostgreSQL)

- `profiles` — anonymous_id, user_id, is_banned, created_at
- `user_roles` — user_id, role (enum: user, admin, super_admin)
- `posts` — id, author_id, content (text only), status (pending/approved/rejected), created_at
- `post_likes` — post_id, user_id
- `comments` — id, post_id, author_id, parent_comment_id (for replies), content, created_at
- `groups` — id, name, description, created_by, created_at
- `group_members` — group_id, user_id, joined_at
- `group_posts` — id, group_id, author_id, content, created_at
- `diu_knowledge_base` — id, category, question, answer (for AI context)

## 6. AI Chatbot (Edge Function)

- Edge function that retrieves relevant knowledge base entries based on user query
- Sends retrieved context + user question to Lovable AI Gateway (Gemini model)
- Streaming response rendered in the chat UI
- Conversation history maintained in-session (not persisted)

## 7. Security

- **Email domain validation**: reject non-@diu.edu.bd emails at signup (client + edge function)
- **RLS policies** on all tables enforcing role-based access
- **Anonymous identity**: no way to discover real email from anonymous ID
- **Banned users** blocked from creating posts/comments
- **Input validation** with Zod on all forms
- **No images, no file uploads** anywhere in the system

## 8. Pages & Routes

- `/auth` — Login/Signup (email restricted to @diu.edu.bd)
- `/` — Main app with 3 tabs: View, Groups, AI
- `/admin` — Admin/Super Admin dashboard (role-gated)

