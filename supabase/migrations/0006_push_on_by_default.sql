-- Push reminders are on by default. A device only receives them once the
-- person allows notifications in their browser and it subscribes.
alter table public.notification_preferences alter column push_enabled set default true;
update public.notification_preferences set push_enabled = true where push_enabled = false;
