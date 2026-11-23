import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const github = Deno.env.get("GITHUB_TOKEN")!;
    if (!github) throw new Error("GITHUB_TOKEN secret is not configured");
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const admin = createClient(url, service);
    const { data: profile } = await admin.from("cms_profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Admin approval required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    const { submission_id } = await req.json();
    const { data: draft, error: readError } = await admin.from("cms_submissions").select("*").eq("id", submission_id).single();
    if (readError || !draft) throw new Error("Submission not found");
    if (draft.status !== "pending") throw new Error("This submission is no longer pending");
    const owner = "muhammadadnan21124-lang", repo = "Dr-Adnan-Hassann", branch = "main", path = "index.html";
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = { Authorization: `Bearer ${github}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    const current = await fetch(`${api}?ref=${branch}`, { headers });
    if (!current.ok) throw new Error(`Could not read current website from GitHub: ${current.status}`);
    const file = await current.json();
    const body = { message: `Publish approved CMS update ${draft.id}`, content: btoa(unescape(encodeURIComponent(draft.html))), sha: file.sha, branch };
    const update = await fetch(api, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await update.json();
    if (!update.ok) throw new Error(result.message || `GitHub publish failed: ${update.status}`);
    await admin.from("cms_submissions").update({ status: "published", reviewed_at: new Date().toISOString(), reviewed_by: user.id, published_commit: result.commit?.sha || null }).eq("id", draft.id);
    return new Response(JSON.stringify({ ok: true, commit: result.commit?.sha }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Publish failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});