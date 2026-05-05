import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getAdminOverviewStats,
  getAdminRecentActivity,
  getAdminRecentUsers,
} from "@/lib/repositories/admin";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "berkanurekk@gmail.com";

function formatDateTime(input: string) {
  return new Date(input).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function prettyAction(action: string) {
  return action.replaceAll("_", " ");
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    redirect("/");
  }

  const [statsResult, usersResult, activityResult] = await Promise.allSettled([
    getAdminOverviewStats(),
    getAdminRecentUsers(50),
    getAdminRecentActivity(50),
  ]);

  const stats =
    statsResult.status === "fulfilled"
      ? statsResult.value
      : { totalUsers: 0, formulasGeneratedToday: 0 };
  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const activity =
    activityResult.status === "fulfilled" ? activityResult.value : [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
      <section className="space-y-1">
        <h1 className="font-h1 text-h1 text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
        <p className="font-body-md text-body-md text-slate-600 dark:text-slate-400">
          Internal analytics for user growth and activity.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{stats.totalUsers.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="font-body-sm text-body-sm text-slate-500 dark:text-slate-400">
              Registered accounts across all providers.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Formulas Generated Today</CardDescription>
            <CardTitle className="text-3xl">{stats.formulasGeneratedToday.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="font-body-sm text-body-sm text-slate-500 dark:text-slate-400">
              Counted from today&apos;s `generated_formula` events.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>Last 50 signups from Supabase Auth.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Signup Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.email ?? "unknown"}</TableCell>
                  <TableCell>{entry.provider ?? "email"}</TableCell>
                  <TableCell className="text-right">{formatDateTime(entry.created_at)}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 dark:text-slate-400">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest 50 tracked actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.email ?? entry.user_id}</TableCell>
                  <TableCell className="capitalize">{prettyAction(entry.action_type)}</TableCell>
                  <TableCell className="text-right">{formatDateTime(entry.created_at)}</TableCell>
                </TableRow>
              ))}
              {activity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 dark:text-slate-400">
                    No activity recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
