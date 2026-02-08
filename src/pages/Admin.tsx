import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Trash2, UserX, UserCheck, Plus, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Admin() {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/", { replace: true });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Admin Panel</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-4">
        <Tabs defaultValue={isSuperAdmin ? "pending" : "posts"}>
          <TabsList className="flex flex-wrap">
            {isSuperAdmin && <TabsTrigger value="pending">Pending</TabsTrigger>}
            <TabsTrigger value="posts">Posts</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="groups">Groups</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="kb">Knowledge Base</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
          </TabsList>
          {isSuperAdmin && <TabsContent value="pending"><PendingPosts /></TabsContent>}
          <TabsContent value="posts"><AllPosts /></TabsContent>
          {isSuperAdmin && <TabsContent value="groups"><ManageGroups /></TabsContent>}
          {isSuperAdmin && <TabsContent value="users"><ManageUsers /></TabsContent>}
          {isSuperAdmin && <TabsContent value="kb"><KnowledgeBase /></TabsContent>}
          {isSuperAdmin && <TabsContent value="analytics"><Analytics /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

function PendingPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, content, created_at, author_id, profiles!posts_author_id_fkey(anonymous_id)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setPosts(data || []);
  };
  useEffect(() => { fetch_(); }, []);

  const action = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("posts").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetch_();
  };

  return (
    <div className="space-y-3 pt-4">
      {posts.length === 0 ? <p className="text-sm text-muted-foreground">No pending posts.</p> : posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">
              {p.profiles?.anonymous_id} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
            </div>
            <p className="text-sm mb-3 whitespace-pre-wrap">{p.content}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => action(p.id, "approved")}><Check className="h-3 w-3 mr-1" />Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => action(p.id, "rejected")}><X className="h-3 w-3 mr-1" />Reject</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AllPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, content, status, created_at, profiles!posts_author_id_fkey(anonymous_id)")
      .order("created_at", { ascending: false });
    setPosts(data || []);
  };
  useEffect(() => { fetch_(); }, []);

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetch_();
  };

  return (
    <div className="space-y-3 pt-4">
      {posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex items-start justify-between pt-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {p.profiles?.anonymous_id} · {p.status} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.content}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => deletePost(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ManageGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups(data || []);
  };
  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("groups").insert({ name: name.trim(), description: desc.trim() || null, created_by: user!.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setName(""); setDesc(""); fetch_(); }
  };

  const del = async (id: string) => {
    await supabase.from("groups").delete().eq("id", id);
    fetch_();
  };

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Create Group</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button size="sm" onClick={create}><Plus className="h-3 w-3 mr-1" />Create</Button>
        </CardContent>
      </Card>
      {groups.map((g) => (
        <Card key={g.id}>
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="font-medium">{g.name}</p>
              {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => del(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ManageUsers() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data: p } = await supabase.from("profiles").select("user_id, anonymous_id, is_banned");
    const { data: r } = await supabase.from("user_roles").select("user_id, role");
    setProfiles(p || []);
    const roleMap: Record<string, string[]> = {};
    (r || []).forEach((item: any) => {
      if (!roleMap[item.user_id]) roleMap[item.user_id] = [];
      roleMap[item.user_id].push(item.role);
    });
    setRoles(roleMap);
  };
  useEffect(() => { fetch_(); }, []);

  const toggleBan = async (userId: string, currently: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_banned: !currently }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetch_();
  };

  const toggleAdmin = async (userId: string) => {
    const userRoles = roles[userId] || [];
    if (userRoles.includes("admin")) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
    }
    fetch_();
  };

  return (
    <div className="space-y-3 pt-4">
      {profiles.map((p) => (
        <Card key={p.user_id}>
          <CardContent className="flex items-center justify-between pt-4">
            <div>
              <p className="font-medium">{p.anonymous_id}</p>
              <p className="text-xs text-muted-foreground">
                Roles: {(roles[p.user_id] || ["user"]).join(", ")}
                {p.is_banned && <span className="ml-2 text-destructive font-medium">BANNED</span>}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => toggleAdmin(p.user_id)}>
                {(roles[p.user_id] || []).includes("admin") ? "Remove Admin" : "Make Admin"}
              </Button>
              <Button size="sm" variant={p.is_banned ? "default" : "destructive"} onClick={() => toggleBan(p.user_id, p.is_banned)}>
                {p.is_banned ? <><UserCheck className="h-3 w-3 mr-1" />Unban</> : <><UserX className="h-3 w-3 mr-1" />Ban</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function KnowledgeBase() {
  const [entries, setEntries] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const { toast } = useToast();

  const fetch_ = async () => {
    const { data } = await supabase.from("diu_knowledge_base").select("*").order("category");
    setEntries(data || []);
  };
  useEffect(() => { fetch_(); }, []);

  const add = async () => {
    if (!category.trim() || !question.trim() || !answer.trim()) return;
    const { error } = await supabase.from("diu_knowledge_base").insert({ category: category.trim(), question: question.trim(), answer: answer.trim() });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setCategory(""); setQuestion(""); setAnswer(""); fetch_(); }
  };

  const del = async (id: string) => {
    await supabase.from("diu_knowledge_base").delete().eq("id", id);
    fetch_();
  };

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add Knowledge Base Entry</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Category (e.g. Exams, Fees)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Textarea placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <Button size="sm" onClick={add}><Plus className="h-3 w-3 mr-1" />Add Entry</Button>
        </CardContent>
      </Card>
      {entries.map((e) => (
        <Card key={e.id}>
          <CardContent className="flex items-start justify-between pt-4">
            <div>
              <span className="text-xs font-medium text-primary">{e.category}</span>
              <p className="font-medium text-sm">{e.question}</p>
              <p className="text-sm text-muted-foreground mt-1">{e.answer}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Analytics() {
  const [stats, setStats] = useState({ posts: 0, users: 0, groups: 0, pending: 0 });

  useEffect(() => {
    (async () => {
      const [postsRes, usersRes, groupsRes, pendingRes] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({
        posts: postsRes.count || 0,
        users: usersRes.count || 0,
        groups: groupsRes.count || 0,
        pending: pendingRes.count || 0,
      });
    })();
  }, []);

  const items = [
    { label: "Total Posts", value: stats.posts },
    { label: "Total Users", value: stats.users },
    { label: "Active Groups", value: stats.groups },
    { label: "Pending Posts", value: stats.pending },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 pt-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-primary">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
