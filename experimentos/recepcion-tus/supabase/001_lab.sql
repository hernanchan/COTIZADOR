-- SOLO para un proyecto Supabase Free NUEVO y SEPARADO. No ejecutar en producción.
-- No habilitar acceso público de lectura. No contiene claves.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('saber-tus-lab','saber-tus-lab',false,20971520,array['application/pdf'])
on conflict (id) do update set
 public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];

drop policy if exists "saber_tus_lab_upload_own_pdf" on storage.objects;
create policy "saber_tus_lab_upload_own_pdf"
on storage.objects for insert to authenticated
with check (
 bucket_id='saber-tus-lab'
 and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'
);
-- No crear políticas públicas de SELECT. La función verifica identidad y descarga
-- con service_role que nunca se comparte con el navegador.