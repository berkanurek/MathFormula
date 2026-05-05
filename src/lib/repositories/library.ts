import { createClient } from "@/lib/supabase/server";

export type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type SavedFormulaRow = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  folder_id: string | null;
  is_favorite: boolean;
  created_at: string;
};

export async function fetchFolders(userId: string): Promise<FolderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .select("id,user_id,name,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  return (data ?? []) as FolderRow[];
}

export async function fetchSavedFormulas(input: {
  userId: string;
  folderId?: string | null;
  favoritesOnly?: boolean;
}): Promise<SavedFormulaRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("saved_formulas")
    .select("id,user_id,content,image_url,folder_id,is_favorite,created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false });

  if (input.favoritesOnly) {
    query = query.eq("is_favorite", true);
  }
  if (typeof input.folderId !== "undefined") {
    query = input.folderId ? query.eq("folder_id", input.folderId) : query.is("folder_id", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch formulas: ${error.message}`);
  }

  return (data ?? []) as SavedFormulaRow[];
}

export async function createFolder(input: {
  userId: string;
  name: string;
}): Promise<FolderRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: input.userId,
      name: input.name,
    })
    .select("id,user_id,name,created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create folder.");
  }

  return data as FolderRow;
}

export async function toggleFormulaFavorite(input: {
  userId: string;
  formulaId: string;
  isFavorite: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_formulas")
    .update({ is_favorite: input.isFavorite })
    .eq("id", input.formulaId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to update favorite: ${error.message}`);
  }
}

export async function moveFormulaToFolder(input: {
  userId: string;
  formulaId: string;
  folderId: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_formulas")
    .update({ folder_id: input.folderId })
    .eq("id", input.formulaId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to move formula: ${error.message}`);
  }
}
