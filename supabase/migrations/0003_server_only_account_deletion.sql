-- Account deletion goes only through /api/account/delete, which re-checks the password
-- and then calls purge_user_data with the service role.
revoke execute on function public.delete_my_account() from authenticated;
drop function if exists public.delete_my_account();
