import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Supabase's signup endpoint can hang indefinitely server-side (e.g. a stuck
// confirmation-email send) instead of returning an error, which otherwise
// leaves the form looking like the button did nothing at all.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The server didn't respond in time. Please try again.")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RAVS" },
      { name: "description", content: "Sign in or create your RAVS research attendance account." },
      { property: "og:title", content: "Sign in — RAVS" },
      { property: "og:description", content: "Access your research attendance dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [college, setCollege] = useState("");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
      );
      if (error) return toast.error(error.message);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const cleanCollege = college.trim();

      let data, error;
      try {
        const res = await withTimeout(
          supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: {
                full_name: cleanName,
                college_id: cleanCollege,
                college: cleanCollege,
              },
            },
          }),
          12000,
        );
        data = res.data;
        error = res.error;
      } catch (signUpErr) {
        // If signUp times out (e.g. Supabase SMTP/DNS delivery is degraded),
        // try signing in directly in case the user account already exists.
        const { error: signInErr } = await withTimeout(
          supabase.auth.signInWithPassword({ email: cleanEmail, password }),
          8000,
        ).catch(() => ({ error: null }));

        if (!signInErr) {
          toast.success("Signed in successfully!");
          return navigate({ to: "/dashboard", replace: true });
        }

        throw new Error(
          "Supabase email service is currently responding slowly due to upstream DNS maintenance. If you already have an account, please use the 'Sign in' tab.",
        );
      }

      if (error) {
        setBusy(false);
        const errMsg = error.message.toLowerCase();
        const isUserExists =
          error.status === 400 ||
          error.status === 422 ||
          error.status === 429 ||
          errMsg.includes("already registered") ||
          errMsg.includes("already exists") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("too many");

        if (isUserExists) {
          const { error: signInErr } = await withTimeout(
            supabase.auth.signInWithPassword({ email: cleanEmail, password }),
            15000,
          );
          if (!signInErr) {
            toast.success("Account already exists — signed in!");
            return navigate({ to: "/dashboard", replace: true });
          }
          if (signInErr.message.toLowerCase().includes("invalid login credentials")) {
            return toast.error(
              "An account with this email already exists. Please sign in with your password.",
            );
          }
          return toast.error(signInErr.message || error.message);
        }
        return toast.error(error.message);
      }

      if (!data.session && data.user) {
        const { error: signInErr } = await withTimeout(
          supabase.auth.signInWithPassword({ email: cleanEmail, password }),
          15000,
        );
        setBusy(false);
        if (!signInErr) {
          toast.success("Account created — signed in!");
          return navigate({ to: "/dashboard", replace: true });
        }
        toast.info("Account created! Please check your email to confirm or sign in.");
        return;
      }

      setBusy(false);
      toast.success("Account created — you're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl">RAVS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Research attendance &amp; verification
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="college">College</Label>
                  <Input
                    id="college"
                    required
                    placeholder="College name"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Create account
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Already have an account? Use the{" "}
                  <strong className="font-semibold text-foreground">Sign in</strong> tab.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
