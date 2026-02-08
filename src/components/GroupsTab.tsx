import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function GroupsTab() {
  const { user, isBanned } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    const [groupsRes, membersRes] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id").eq("user_id", user!.id),
    ]);
    setGroups(groupsRes.data || []);
    setMemberships((membersRes.data || []).map((m: any) => m.group_id));
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const joinGroup = async (groupId: string) => {
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user!.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchGroups();
  };

  const leaveGroup = async (groupId: string) => {
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user!.id);
    fetchGroups();
    if (selectedGroup?.id === groupId) setSelectedGroup(null);
  };

  const openGroup = async (group: any) => {
    setSelectedGroup(group);
    const { data } = await supabase
      .from("group_posts")
      .select("id, content, created_at, author_id, profiles!group_posts_author_id_fkey(anonymous_id)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });
    setGroupPosts(data || []);
  };

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
      openGroup(selectedGroup);
    }
  };

  if (selectedGroup) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
        </div>
        {memberships.includes(selectedGroup.id) && !isBanned && (
          <Card>
            <CardContent className="flex gap-2 pt-4">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Write something..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGroupPost()}
              />
              <Button size="sm" onClick={submitGroupPost} disabled={!newPost.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        )}
        {groupPosts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No posts in this group yet.</p>
        ) : (
          groupPosts.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{(p as any).profiles?.anonymous_id || "Unknown"}</span>
                  <span className="ml-2">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{p.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading groups...</p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No groups available yet.</p>
      ) : (
        groups.map((g) => (
          <Card key={g.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => memberships.includes(g.id) && openGroup(g)}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                {g.name}
              </CardTitle>
              {g.description && <CardDescription>{g.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              {memberships.includes(g.id) ? (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); leaveGroup(g.id); }}>
                  Leave
                </Button>
              ) : (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); joinGroup(g.id); }}>
                  Join
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
