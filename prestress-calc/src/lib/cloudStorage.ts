"use client";

import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import type { ProjectInputs, DesignResults } from "@/types";

export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

export interface CloudProject extends ProjectMeta {
  inputs: ProjectInputs;
  results: DesignResults | null;
}

// ─── Save ────────────────────────────────────────────────────

export async function saveProjectToCloud(
  inputs: ProjectInputs,
  results: DesignResults | null,
  name: string,
  description?: string
): Promise<{ id: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi" };
  try {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb
      .from("design_projects")
      .insert({
        name,
        description: description ?? "",
        inputs: inputs as unknown as Record<string, unknown>,
        results: results as unknown as Record<string, unknown> | null,
        is_public: false,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data.id as string };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Update (overwrite existing) ─────────────────────────────

export async function updateProjectInCloud(
  id: string,
  inputs: ProjectInputs,
  results: DesignResults | null
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi" };
  try {
    const sb = getSupabaseBrowser();
    const { error } = await sb
      .from("design_projects")
      .update({
        inputs:     inputs  as unknown as Record<string, unknown>,
        results:    results as unknown as Record<string, unknown> | null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { error: error.message };
    return { ok: true };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Load ────────────────────────────────────────────────────

export async function loadProjectFromCloud(
  id: string
): Promise<CloudProject | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi" };
  try {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb
      .from("design_projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return { error: error.message };
    return data as unknown as CloudProject;
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── List user projects ───────────────────────────────────────

export async function listUserProjects(): Promise<ProjectMeta[] | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi" };
  try {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb
      .from("design_projects")
      .select("id, name, description, created_at, updated_at, is_public")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return { error: error.message };
    return (data ?? []) as ProjectMeta[];
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Delete ──────────────────────────────────────────────────

export async function deleteProjectFromCloud(
  id: string
): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase belum dikonfigurasi" };
  try {
    const sb = getSupabaseBrowser();
    const { error } = await sb
      .from("design_projects")
      .delete()
      .eq("id", id);
    if (error) return { error: error.message };
    return { ok: true };
  } catch (e) {
    return { error: String(e) };
  }
}
