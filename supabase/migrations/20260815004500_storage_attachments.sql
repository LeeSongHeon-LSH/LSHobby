-- CS 본문 이미지용 Storage 버킷 (§8.1) — private + authenticated 전용 (SEC-04)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- storage.objects RLS 정책: attachments 버킷은 authenticated 전부 허용 (#33과 동일 정책)
create policy attachments_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
