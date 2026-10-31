-- Laboratorio Uppy/TUS aislado. NO usar en web comercial.
-- Política endurecida para un ensayo de una sola invitación.
-- Solo Supabase Free: bucket privado; la función de control firma dos rutas.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('saber-tus-lab','saber-tus-lab',false,20971520,array['application/pdf'])
on conflict (id) do update set
 public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];

-- No permitir que un usuario anónimo suba libremente sin invitación.
drop policy if exists "saber_tus_lab_upload_own_pdf" on storage.objects;
-- No hay SELECT pública en storage.objects. La Edge Function server-side
-- utiliza su propia credencial de servicio para emitir dos tokens firmados
-- y verificar los objetos, nunca la comparte con el navegador.

create table if not exists public.lab_tus_invites (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 session_id uuid,
 object_a text,
 object_b text,
 created_at timestamptz not null default now()
);
alter table public.lab_tus_invites enable row level security;
revoke all on public.lab_tus_invites from anon,authenticated;

-- Ejecución de una sola vez:
-- 1) crear invitación aleatoria (32 bytes) y guardar únicamente SHA-256;
-- 2) Edge Function verifica enlace y vencimiento, bloquea uso siguiente;
-- 3) dos firmas TUS privadas (no objetos públicos);
-- 4) verificación independiente de SHA y páginas.
