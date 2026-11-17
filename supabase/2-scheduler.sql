-- Dex reminders clock. Run AFTER the app is live on Vercel.
-- Replace the two placeholders below before running:
--   YOUR-APP-URL   e.g. https://ak-desk.vercel.app
--   YOUR-CRON-SECRET  the same value you put in Vercel as CRON_SECRET

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('dex-tick')
where exists (select 1 from cron.job where jobname = 'dex-tick');

select cron.schedule(
  'dex-tick',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'YOUR-APP-URL/api/cron/tick',
    headers := jsonb_build_object('x-cron-key', 'YOUR-CRON-SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);
