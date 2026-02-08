import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: string;
  content: string;
  status: string;
  created_at: string;
  author_id: string;
  profiles: { anonymous_id: string } | null;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
}

export default function ViewTab() {
  const { user, isBanned } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, status, created_at, author_id, profiles!posts_author_id_fkey(anonymous_id)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const postsWithCounts = await Promise.all(
      (data || []).map(async (post: any) => {
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
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleSubmitPost = async () => {
    if (!newPost.trim() || isBanned) return;
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({ author_id: user!.id, content: newPost.trim() });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewPost("");
      toast({ title: "Post submitted", description: "Your post is pending approval." });
    }
  };

  const handleLike = async (postId: string, liked: boolean) => {
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user!.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user!.id });
    }
    fetchPosts();
  };

  return (
    <div className="space-y-4 pt-4">
      {!isBanned && (
        <Card>
          <CardContent className="pt-4">
            <Textarea
              placeholder="Report a campus issue... (text only)"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              maxLength={2000}
              className="mb-2"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Posts require Super Admin approval</p>
              <Button size="sm" onClick={handleSubmitPost} disabled={submitting || !newPost.trim()}>
                <Send className="mr-1 h-3 w-3" />
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No approved posts yet.</div>
      ) : (
        posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{post.profiles?.anonymous_id || "Unknown"}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm">{post.content}</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleLike(post.id, post.user_liked)}
                  className={`flex items-center gap-1 text-xs transition-colors ${post.user_liked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                >
                  <Heart className={`h-4 w-4 ${post.user_liked ? "fill-current" : ""}`} />
                  {post.like_count}
                </button>
                <button
                  onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="h-4 w-4" />
                  {post.comment_count}
                  {expandedComments === post.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              {expandedComments === post.id && <CommentsSection postId={post.id} />}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function CommentsSection({ postId }: { postId: string }) {
  const { user, isBanned } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, author_id, parent_comment_id, profiles!comments_author_id_fkey(anonymous_id)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

  useEffect(() => { fetchComments(); }, [postId]);

  const submitComment = async (content: string, parentId: string | null = null) => {
    if (!content.trim() || isBanned) return;
    await supabase.from("comments").insert({
      post_id: postId,
      author_id: user!.id,
      content: content.trim(),
      parent_comment_id: parentId,
    });
    setNewComment("");
    setReplyTo(null);
    setReplyText("");
    fetchComments();
  };

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const replies = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {topLevel.map((c) => (
        <div key={c.id} className="space-y-1">
          <div className="rounded-md bg-muted/50 p-2 text-sm">
            <span className="text-xs font-medium">{(c as any).profiles?.anonymous_id || "Unknown"}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </span>
            <p className="mt-1">{c.content}</p>
            {!isBanned && (
              <button onClick={() => setReplyTo(c.id)} className="mt-1 text-xs text-primary hover:underline">
                Reply
              </button>
            )}
          </div>
          {replies(c.id).map((r) => (
            <div key={r.id} className="ml-6 rounded-md bg-muted/30 p-2 text-sm">
              <span className="text-xs font-medium">{(r as any).profiles?.anonymous_id || "Unknown"}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </span>
              <p className="mt-1">{r.content}</p>
            </div>
          ))}
          {replyTo === c.id && (
            <div className="ml-6 flex gap-2">
              <input
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                placeholder="Reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment(replyText, c.id)}
              />
              <Button size="sm" variant="ghost" onClick={() => submitComment(replyText, c.id)}>Send</Button>
            </div>
          )}
        </div>
      ))}
      {!isBanned && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitComment(newComment)}
          />
          <Button size="sm" variant="ghost" onClick={() => submitComment(newComment)}>Send</Button>
        </div>
      )}
    </div>
  );
}
