
-- Role enum
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');

-- Post status enum
CREATE TYPE public.post_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table (anonymous identity)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  anonymous_id TEXT NOT NULL UNIQUE,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  status post_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post likes
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- Comments (with nested replies)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Group posts (no approval needed)
CREATE TABLE public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DIU Knowledge base for AI
CREATE TABLE public.diu_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- Check if user is banned
CREATE OR REPLACE FUNCTION public.is_banned(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND is_banned = true
  )
$$;

-- Generate anonymous ID
CREATE OR REPLACE FUNCTION public.generate_anonymous_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
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
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, anonymous_id)
  VALUES (NEW.id, public.generate_anonymous_id());
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger for knowledge base
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_diu_kb_updated_at
  BEFORE UPDATE ON public.diu_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles (anonymous_id only)"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- USER_ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- POSTS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (status = 'approved' OR author_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Non-banned users can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_banned(auth.uid()));

CREATE POLICY "Admins can delete posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- POST LIKES
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view likes"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

CREATE POLICY "Users can unlike posts"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- COMMENTS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Non-banned users can comment"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND NOT public.is_banned(auth.uid()));

CREATE POLICY "Admins can delete comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- GROUP MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

CREATE POLICY "Users can leave groups"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- GROUP POSTS
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view group posts"
  ON public.group_posts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_posts.group_id AND user_id = auth.uid()
  ) OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Group members can post"
  ON public.group_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND NOT public.is_banned(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_posts.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete group posts"
  ON public.group_posts FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- DIU KNOWLEDGE BASE
ALTER TABLE public.diu_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view knowledge base"
  ON public.diu_knowledge_base FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage knowledge base"
  ON public.diu_knowledge_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update knowledge base"
  ON public.diu_knowledge_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete knowledge base"
  ON public.diu_knowledge_base FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Indexes for performance
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_comments_post ON public.comments(post_id);
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_group_posts_group ON public.group_posts(group_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
