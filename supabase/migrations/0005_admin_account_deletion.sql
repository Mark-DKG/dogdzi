-- Super admins may permanently delete a user's account (server-side only, audited).
insert into public.admin_permissions (permission, description, is_write) values
  ('accounts:delete', 'Permanently delete a user account and all of its data', true)
on conflict (permission) do nothing;

insert into public.role_permissions (role, permission) values
  ('super_admin', 'accounts:delete')
on conflict do nothing;
