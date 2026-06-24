import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign In — KeywordForge" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Akun dibuat. Cek email untuk verifikasi.");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "Gagal sign in dengan Google");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Toaster richColors position="top-center" />
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">KeywordForge</h1>
          <p className="text-sm text-muted-foreground">Sign in untuk mengakses workspace Anda</p>
        </div>

        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Lanjutkan dengan Google"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">atau email</span></div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-3">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3">
              <Input placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password (min 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Buat Akun"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
