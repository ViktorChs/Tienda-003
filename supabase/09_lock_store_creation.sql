revoke execute on function public.create_store(text,text,bigint) from public, anon, authenticated;
grant execute on function public.create_store(text,text,bigint) to service_role;
