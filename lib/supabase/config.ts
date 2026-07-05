// Valores públicos (protegidos por RLS). Se leen de env; con fallback embebido
// para que el build de Vercel funcione aunque las env vars no estén configuradas.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rtgtczecjedkrtzkpzdm.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0Z3RjemVjamVka3J0emtwemRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjIxODUsImV4cCI6MjA5ODgzODE4NX0.ZiVIVdaYj-sNsAb85GIdZ60Fd4F92o4E-6JiOxfFwE4";
