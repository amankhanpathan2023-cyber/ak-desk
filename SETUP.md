# Setting up Dex

About 30 minutes, once. Keep your private note open: you'll paste keys from it into Vercel and Supabase, never into chat.

## 1. Fresh keys
- **Bot token:** in Telegram, BotFather, send `/revoke`, pick Dex. Save the new token in your note.
- **Groq key:** console.groq.com, then API Keys. Delete the old key, create a new one, and save it.

## 2. Supabase (your new account)
1. Create the project `ak-desk` in the Mumbai region.
2. Open **SQL Editor**, then **New query**. Paste everything from `supabase/1-schema.sql` and click **Run**.
3. Open **Project Settings**, then **API**. Copy into your note:
   - Project URL → this is `SUPABASE_URL`
   - `service_role` secret key → this is `SUPABASE_SERVICE_ROLE_KEY` (this one is powerful, keep it private)

## 3. Calendar links
In Google Calendar on the web, open Settings, click your calendar on the left, scroll to **Integrate calendar**, and copy **Secret address in iCal format**. Do this for both Pratham and TFI.
If you don't see that option, the organisation has turned it off. Tell Claude and we'll use another way.

## 4. Vercel
Claude will put the project on your Vercel account. Then go to **Project, Settings, Environment Variables** and add each one:

| Name | Value |
|---|---|
| TELEGRAM_BOT_TOKEN | new token from BotFather |
| TELEGRAM_WEBHOOK_SECRET | make up any long random word, e.g. `dex-river-7419-mango` |
| TELEGRAM_CHAT_ID | leave empty for now (step 6) |
| GROQ_API_KEY | new Groq key |
| SUPABASE_URL | from step 2 |
| SUPABASE_SERVICE_ROLE_KEY | from step 2 |
| CAL_URL_1 | Pratham secret iCal link |
| CAL_NAME_1 | Pratham |
| CAL_URL_2 | TFI secret iCal link |
| CAL_NAME_2 | TFI |
| APP_URL | your app address, e.g. `https://ak-desk.vercel.app` |
| APP_PASSWORD | the password you'll type to open the app |
| CRON_SECRET | another long random word, different from the first |

Then **Deployments**, the three dots on the latest one, then **Redeploy**.

## 5. Connect Telegram
Open this in your browser (with your values):
`https://YOUR-APP.vercel.app/api/setup?key=YOUR_CRON_SECRET`
You should see `"ok": true` near the top.

## 6. Tell Dex it's you
Send `hi` to your bot. It replies with your chat ID. Add it in Vercel as `TELEGRAM_CHAT_ID`, then redeploy once more. From now on Dex only answers you.

## 7. Turn on reminders
In Supabase SQL Editor, open `supabase/2-scheduler.sql`, replace `YOUR-APP-URL` and `YOUR-CRON-SECRET`, and run it. Dex now checks every 10 minutes.

## 8. Put the app on your phone
Open your app address in Chrome on your phone, log in, then menu, **Add to Home screen**.

## Check it works
Send these to Dex:
- `CT block report due Friday`
- `paid 450 auto Satara`
- a voice note: "Shankar ko Friday tak attendance sheet bhejna hai"
- `/today`

## What runs when (India time)
- **8:00 am:** morning brief with calendar and top 3
- **8:00 pm:** day wrap with buttons for what's left
- **Sunday 7:00 pm:** weekly review, money and a backup download link
- **Reminders:** 9 am on the due day (or 1 hour before timed tasks). None between 10 pm and 7 am.
