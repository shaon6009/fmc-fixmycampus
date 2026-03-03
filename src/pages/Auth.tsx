import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Shield } from "lucide-react";

const emailSchema = z.string().email("Invalid email").refine((e) => e.endsWith("@diu.edu.bd"), {
  message: "Only @diu.edu.bd emails are allowed",
});
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({ title: "Error", description: emailResult.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Check your @diu.edu.bd email for the reset link." });
      setIsForgot(false);
    }
  };

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

    setSubmitting(true);
    const { error } = isLogin ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (!isLogin) {
      toast({ title: "Success", description: "Check your @diu.edu.bd email to confirm your account." });
    }
  };

  if (isForgot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your @diu.edu.bd email to receive a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input
                type="email"
                placeholder="your.email@diu.edu.bd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button type="button" onClick={() => setIsForgot(false)} className="text-primary hover:underline">
                Back to login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">FixMyCampus</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to your account" : "Create a new account"}
            <br />
            <span className="text-xs text-muted-foreground">Only @diu.edu.bd emails</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="your.email@diu.edu.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-1">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline block mx-auto"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
            {isLogin && (
              <button
                type="button"
                onClick={() => setIsForgot(true)}
                className="text-muted-foreground hover:text-primary hover:underline block mx-auto text-xs"
              >
                Forgot password?
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
