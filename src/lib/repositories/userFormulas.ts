import { createClient } from "@/lib/supabase/server";

export type UserFormulaRow = {
  id: string;
  user_id: string;
  title: string;
  latex_code: string;
  created_at: string;
};

export async function listUserFormulas(userId: string): Promise<UserFormulaRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_formulas")
    .select("id,user_id,title,latex_code,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load user formulas: ${error.message} (code: ${error.code ?? "n/a"})`,
    );
  }

  return (data ?? []) as UserFormulaRow[];
}

export async function createUserFormula(input: {
  userId: string;
  title: string;
  latexCode: string;
}): Promise<UserFormulaRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_formulas")
    .insert({
      user_id: input.userId,
      title: input.title,
      latex_code: input.latexCode,
    })
    .select("id,user_id,title,latex_code,created_at")
    .single();

  if (error || !data) {
    throw new Error(
      error
        ? `Failed to create formula: ${error.message} (code: ${error.code ?? "n/a"})`
        : "Failed to create formula",
    );
  }

  return data as UserFormulaRow;
}
