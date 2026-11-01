# North Huddle email templates

Paste each file into Supabase → Authentication → Emails → Templates (copy the whole file into the "Message body" source box).

| Template | File | Subject |
|---|---|---|
| Confirm signup | confirm-signup.html | Confirm your North Huddle account |
| Reset password | reset-password.html | Reset your North Huddle password |
| Magic link | magic-link.html | Your North Huddle sign-in link |
| Change email address | change-email.html | Confirm your new North Huddle email |

After you get your own domain, update the north-huddle.pages.dev links in these files, and set up custom SMTP
(Supabase → Authentication → Emails → SMTP settings) so emails come from an address like hello@yourdomain.
