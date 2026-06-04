"use client";

import React, { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  listUserProjects,
  saveProjectToCloud,
  loadProjectFromCloud,
  deleteProjectFromCloud,
} from "@/lib/cloudStorage";
import type { ProjectMeta } from "@/lib/cloudStorage";
import { useDesignStore } from "@/store/useDesignStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "list" | "save";

export function CloudModal({ open, onClose }: Props) {
  const { inputs, results, loadFromLocal, compute } = useDesignStore();
  const [mode, setMode] = useState<Mode>("list");
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [saveName, setSaveName] = useState(inputs.projectInfo.namaProyek || "");
  const [saveDesc, setSaveDesc] = useState("");
  const configured = isSupabaseConfigured();

  const fetchProjects = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    const res = await listUserProjects();
    setLoading(false);
    if ("error" in res) { setMsg("Error: " + res.error); }
    else { setProjects(res); setMsg(""); }
  }, [configured]);

  useEffect(() => {
    if (open && mode === "list") fetchProjects();
  }, [open, mode, fetchProjects]);

  async function handleSave() {
    if (!saveName.trim()) { setMsg("Nama proyek tidak boleh kosong"); return; }
    setLoading(true);
    const res = await saveProjectToCloud(inputs, results, saveName.trim(), saveDesc.trim());
    setLoading(false);
    if ("error" in res) { setMsg("Gagal: " + res.error); }
    else { setMsg("✓ Proyek tersimpan ke cloud (ID: " + res.id.slice(0, 8) + "...)"); setMode("list"); fetchProjects(); }
  }

  async function handleLoad(id: string) {
    setLoading(true);
    const res = await loadProjectFromCloud(id);
    setLoading(false);
    if ("error" in res) { setMsg("Gagal muat: " + res.error); return; }
    // Merge loaded inputs into store via localStorage trick
    try {
      const { inputs: loadedInputs } = res;
      localStorage.setItem("prestress-calc-v3", JSON.stringify({ inputs: loadedInputs }));
      loadFromLocal();
      setMsg("✓ Proyek dimuat");
      setTimeout(() => { onClose(); setMsg(""); }, 800);
    } catch { setMsg("Gagal muat ke store"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus proyek "${name}"?`)) return;
    setLoading(true);
    const res = await deleteProjectFromCloud(id);
    setLoading(false);
    if ("error" in res) { setMsg("Gagal hapus: " + res.error); }
    else { fetchProjects(); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col z-10 border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-700 text-white rounded-t-lg">
          <h2 className="font-bold text-sm">☁ Cloud Storage — Supabase</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>

        {!configured ? (
          <div className="p-5 text-sm text-gray-600 space-y-2">
            <p className="font-semibold text-orange-700">⚠ Supabase belum dikonfigurasi</p>
            <p>Buat file <code className="bg-gray-100 px-1 rounded">.env.local</code> di folder <code>prestress-calc/</code>:</p>
            <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-[10px] font-mono overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
            <p className="text-[10px] text-gray-500">Lihat file <code>.env.local.example</code> untuk panduan. Setelah diisi, restart server Next.js.</p>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 px-4 pt-3">
              {(["list", "save"] as const).map(m => (
                <button key={m}
                  onClick={() => { setMode(m); setMsg(""); }}
                  className={`mr-3 pb-1.5 text-xs font-semibold border-b-2 transition-colors ${mode === m
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                  {m === "list" ? "📂 Muat dari Cloud" : "💾 Simpan ke Cloud"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msg && (
                <p className={`text-xs px-2 py-1 rounded ${msg.startsWith("✓")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {msg}
                </p>
              )}

              {mode === "list" && (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-gray-500">Klik proyek untuk memuat, atau hapus.</p>
                    <button onClick={fetchProjects} disabled={loading}
                      className="text-[10px] text-blue-600 hover:underline disabled:opacity-50">
                      {loading ? "Memuat…" : "↻ Refresh"}
                    </button>
                  </div>
                  {projects.length === 0 && !loading && (
                    <p className="text-xs text-gray-400 italic text-center py-4">
                      Belum ada proyek tersimpan di cloud.
                    </p>
                  )}
                  {projects.map(proj => (
                    <div key={proj.id}
                      className="flex items-center gap-2 p-2.5 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{proj.name}</p>
                        {proj.description && (
                          <p className="text-[10px] text-gray-500 truncate">{proj.description}</p>
                        )}
                        <p className="text-[9px] text-gray-400">
                          {new Date(proj.updated_at).toLocaleString("id-ID")}
                          {proj.is_public && " · publik"}
                        </p>
                      </div>
                      <button onClick={() => handleLoad(proj.id)} disabled={loading}
                        className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-semibold shrink-0">
                        Muat
                      </button>
                      <button onClick={() => handleDelete(proj.id, proj.name)} disabled={loading}
                        className="text-[10px] px-1.5 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 shrink-0">
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}

              {mode === "save" && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-medium text-gray-600 uppercase">Nama Proyek *</label>
                    <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                      placeholder="e.g. Jembatan Prategang Semarang"
                      className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-medium text-gray-600 uppercase">Deskripsi (opsional)</label>
                    <input type="text" value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
                      placeholder="Catatan singkat…"
                      className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="rounded bg-blue-50 border border-blue-200 p-2 text-[10px] text-blue-700 space-y-0.5">
                    <p className="font-semibold">Data yang akan disimpan:</p>
                    <p>· Proyek: {inputs.projectInfo.namaProyek}</p>
                    <p>· Geometri: H={inputs.girder.h1+(inputs.girder.h5??0)+inputs.girder.h2+(inputs.girder.h4??0)+inputs.girder.h3} mm, L={inputs.loads.spanLength/1000} m</p>
                    <p>· Strand: {inputs.tendon.rows.reduce((s,r)=>s+r.strandCount,0)} strands, f'c={inputs.material.fc} MPa</p>
                  </div>
                  <button onClick={handleSave} disabled={loading || !saveName.trim()}
                    className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 disabled:opacity-40 transition-colors">
                    {loading ? "Menyimpan…" : "💾 Simpan ke Cloud"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
