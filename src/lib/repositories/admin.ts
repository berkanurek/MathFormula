import { createClient } from "@/lib/supabase/server";

export type AdminOverviewStats = {
  totalUsers: number;
  formulasGeneratedToday: number;
};

export type AdminRecentUser = {
  id: string;
  email: string | null;
  provider: string | null;
  created_at: string;
};

export type AdminActivityRow = {
  id: number;
  user_id: string;
  email: string | null;
  action_type: "generated_formula" | "scanned_image";
  created_at: string;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview_stats");
  if (error) {
    throw new Error(`Failed to load admin stats: ${error.message}`);
  }
  const row = (data?.[0] ?? null) as
    | { total_users: number; formulas_generated_today: number }
    | null;
  return {
    totalUsers: row?.total_users ?? 0,
    formulasGeneratedToday: row?.formulas_generated_today ?? 0,
  };
}

export async function getAdminRecentUsers(limit = 50): Promise<AdminRecentUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_recent_users", { p_limit: limit });
  if (error) {
    throw new Error(`Failed to load recent users: ${error.message}`);
  }
  return (data ?? []) as AdminRecentUser[];
}

export async function getAdminRecentActivity(limit = 50): Promise<AdminActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_recent_activity", { p_limit: limit });
  if (error) {
    throw new Error(`Failed to load recent activity: ${error.message}`);
  }
  return (data ?? []) as AdminActivityRow[];
}
