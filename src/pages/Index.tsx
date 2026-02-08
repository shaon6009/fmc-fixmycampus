import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Eye, Users, Bot, Settings } from "lucide-react";
import ViewTab from "@/components/ViewTab";
import GroupsTab from "@/components/GroupsTab";
import AITab from "@/components/AITab";

export default function Index() {
  const { user, loading, anonymousId, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-bold text-primary">FixMyCampus</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{anonymousId}</span>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <Tabs defaultValue="view" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="view" className="gap-1.5">
              <Eye className="h-4 w-4" />
              View
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-1.5">
              <Users className="h-4 w-4" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Bot className="h-4 w-4" />
              AI
            </TabsTrigger>
          </TabsList>
          <TabsContent value="view"><ViewTab /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="ai"><AITab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
