import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function useSEO(opts: { title: string; description?: string; canonical?: string }) {
  useEffect(() => {
    document.title = opts.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", opts.description || "");
    else if (opts.description) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = opts.description;
      document.head.appendChild(m);
    }
    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const href = opts.canonical || window.location.href;
    if (linkCanonical) linkCanonical.href = href;
    else {
      const l = document.createElement("link");
      l.rel = "canonical";
      l.href = href;
      document.head.appendChild(l);
    }
  }, [opts.title, opts.description, opts.canonical]);
}

export default function UserManagement() {
  useSEO({ title: "User Management | Aloha", description: "Manage user roles (admin, staff)" });
  const [users, setUsers] = useState<Array<{ id: string; email: string | null; roles: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [email, setEmail] = useState("");

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;
      setTimeout(async () => {
        const uid = session.user.id;
        const admin = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
        setIsAdmin(Boolean(admin.data));
      }, 0);
    }).data.subscription;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setTimeout(async () => {
          const uid = session.user!.id;
          const admin = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" as any });
          setIsAdmin(Boolean(admin.data));
        }, 0);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("roles-admin", { body: { action: "list" } });
      if (error) throw error;
      const d: any = data;
      if (!d?.ok) throw new Error(d?.error || "Failed to load users");
      setUsers(d.users || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (u: { email: string | null }, role: "admin" | "staff", grant: boolean) => {
    if (!u.email) {
      toast.error("User has no email");
      return;
    }
    try {
      const action = grant ? "grant" : "revoke";
      const { data, error } = await supabase.functions.invoke("roles-admin", { body: { action, email: u.email, role } });
      if (error) throw error;
      const d: any = data;
      if (!d?.ok) throw new Error(d?.error || "Failed");
      toast.success(grant ? `Granted ${role}` : `Revoked ${role}`);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Operation failed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b"><div className="container mx-auto px-6 py-8"><h1 className="text-2xl font-bold text-foreground">User Management</h1></div></header>
        <main className="container mx-auto px-6 py-12"><p className="text-muted-foreground">You must be an admin to view this page.</p></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
        </div>
      </header>
      <main className="container mx-auto px-6 py-12">
        <Card className="shadow-aloha mb-8">
          <CardHeader>
            <CardTitle>Grant role by email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-center">
              <Input placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={() => toggleRole({ email }, "staff", true)} disabled={!email}>Grant Staff</Button>
              <Button variant="secondary" onClick={() => toggleRole({ email }, "admin", true)} disabled={!email}>Grant Admin</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">User must exist (sign up first). Use revoke buttons in the table to remove roles.</p>
          </CardContent>
        </Card>

        <Card className="shadow-aloha">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email || <span className="text-muted-foreground">(no email)</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {(u.roles || []).map((r) => (<Badge key={r} variant="secondary">{r}</Badge>))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => toggleRole(u, "staff", true)} disabled={!u.email || (u.roles || []).includes("staff")}>Grant Staff</Button>
                      <Button variant="outline" size="sm" onClick={() => toggleRole(u, "admin", true)} disabled={!u.email || (u.roles || []).includes("admin")}>Grant Admin</Button>
                      <Button variant="destructive" size="sm" onClick={() => toggleRole(u, "staff", false)} disabled={!u.email || !(u.roles || []).includes("staff")}>Revoke Staff</Button>
                      <Button variant="destructive" size="sm" onClick={() => toggleRole(u, "admin", false)} disabled={!u.email || !(u.roles || []).includes("admin")}>Revoke Admin</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
