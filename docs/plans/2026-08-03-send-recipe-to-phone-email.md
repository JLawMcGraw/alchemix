# Plan: "Send recipe to my phone" (email delivery)

## Context

**Problem:** When making a cocktail from the app on a computer, the user has to pull out their
phone and photograph the screen to read the recipe at the bar. They want the recipe's
**ingredients and instructions** delivered to their phone as readable content.

**Decision (already made with the user):**
- Delivery = **email to the logged-in user's own account address** (reuses existing Resend/SMTP
  infra; no new provider, no cost, no phone-number storage, works in dev + prod).
- Content = **readable text + image**: a branded HTML email body listing ingredients,
  instructions, and glass, **plus** the existing styled recipe PNG as an attachment.

**Why email, not SMS:** The codebase has a full email service
(`api/src/services/email/`) but **no** SMS/MMS provider. Real MMS would require a paid Twilio
account, storing/verifying a phone number, and hosting the image at a public URL (the PNG is
generated client-side today and never touches a server), which only works on the Railway deploy,
not `localhost`. Email sidesteps all of that.

**Outcome:** A new **"Send to my phone"** button in the recipe detail modal. One click emails the
recipe to the account owner; open it on the phone to read ingredients/instructions and view the
attached molecular image.

---

## Important caveat to surface to the user

Delivery depends on an email provider being configured. `api/src/services/email/index.ts` selects
Resend (`RESEND_API_KEY`) → SMTP (`SMTP_HOST/USER/PASS`) → **Console fallback**. With no provider
configured (likely in local dev), the email is only logged to the console, not actually sent.
The button will still report success. To truly receive it on the phone, set `RESEND_API_KEY`
(free tier: 3,000/mo) or SMTP env vars in `docker/.env`.

---

## Backend changes

### 1. `api/src/services/email/types.ts` — extend the contract
- Add `EmailAttachment { filename: string; content: string /* base64, no data: prefix */; contentType?: string }`.
- Extend `EmailOptions` with optional `text?: string` and `attachments?: EmailAttachment[]`.
- Add a generic method to the `EmailProvider` interface: `sendEmail(options: EmailOptions): Promise<void>`.

### 2. Three providers — implement `sendEmail(options)` publicly
Each provider currently has a **private** `sendEmail(to, subject, html)`. Promote it to the public,
options-based `sendEmail(options: EmailOptions)` and update the three existing notification methods
(`sendVerificationEmail`/`sendPasswordResetEmail`/`sendPasswordChangedNotification`) to call
`this.sendEmail({ to, subject, html })`. Add attachment handling:
- **`providers/resend.ts`** — pass `text` and `attachments: attachments.map(a => ({ filename: a.filename, content: a.content }))` to `client.emails.send` (Resend accepts a base64 string for `content`).
- **`providers/smtp.ts`** — pass `text` and `attachments: attachments.map(a => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType }))` to `transporter.sendMail`.
- **`providers/console.ts`** — log recipient/subject + attachment count (no send). It has its own
  `logEmail(to, subject, html)`; add `sendEmail(options)` that logs, reusing `redactForLogging`.

### 3. `api/src/services/email/templates.ts` — recipe email content
Add `getRecipeShareEmailContent(recipe: { name; ingredients: string[]; instructions?: string; glass?: string }): { subject; html; text }`:
- Reuse the existing branded `generateEmailTemplate(content)` shell.
- Body: recipe name heading, an `<ul>` of ingredient lines, an instructions paragraph, and the glass
  chip (matching the styling idiom of `getVerificationEmailContent`). Ingredients render as a plain
  readable list (the molecular color-pips already live in the attached PNG, so no server-side
  ingredient classification is needed — avoids coupling the API to `@alchemix/recipe-molecule`).
- Also return a `text` plaintext fallback (name, ingredients, instructions, glass).

### 4. `api/src/routes/recipes.ts` — new authed endpoint
Add `POST /api/recipes/:id/email`, mirroring the existing `POST /:id/made` handler
(`api/src/routes/recipes.ts:650`):
- Require auth: read `userId` + `email` from `req.user` (JWTPayload has both — `packages/types/src/database.ts:118`). 401 if missing.
- Validate `recipeId` (reuse the `parseInt`/`isNaN` guard pattern already in the file).
- Load the recipe **scoped to the user**: `recipeService.getById(recipeId, userId)`
  (`api/src/services/RecipeService.ts:254`). 404 if null → enforces ownership, no cross-user leakage.
- Read optional `image` from body (a `data:image/png;base64,...` string). Validate it starts with
  `data:image/png;base64,`; enforce a size cap (reject if base64 payload > ~6 MB) → 400 on bad input.
  Strip the `data:` prefix to get raw base64 for the attachment. If absent, send text-only.
- Parse `recipe.ingredients` defensively into `string[]` (JSON.parse → array, else comma-split),
  mirroring the frontend `parseIngredients` in `src/components/modals/RecipeDetailModal.tsx:115`.
- Build content via `getRecipeShareEmailContent(...)` and send:
  `emailService.sendEmail({ to: req.user.email, subject, html, text, attachments })`.
- Wrap in `asyncHandler`; return `{ success: true }`.

### 5. Rate limiting — `api/src/server.ts`
Mount a limiter for the new route to prevent inbox-spam abuse, following the existing pattern
(`app.use('/api/recipes/bulk', bulkOperationsLimiter)` at `server.ts:538`). Add
`app.use('/api/recipes/:id/email', <limiter>)` **before** `app.use('/api/recipes', ...)`, reusing an
existing limiter from `api/src/config/rateLimiter.ts` (or a small dedicated one, e.g. ~10/15 min).
Confirm the exact export name during implementation.

---

## Frontend changes

### 6. `src/lib/api.ts` — API method
In the `recipeApi` object (`src/lib/api.ts:348`), add:
```ts
async emailRecipe(id: number, image?: string): Promise<void> {
  await apiClient.post(`/api/recipes/${id}/email`, { image });
}
```
CSRF header + credentials are handled automatically by the existing axios interceptor.

### 7. `src/components/modals/RecipeDetailModal.tsx`
- **Refactor** the canvas builder: extract the body of `handleExport` (lines ~271–599) into a
  `renderRecipeImage(): Promise<string | null>` that resolves with a PNG **data URL**
  (`canvas.toDataURL('image/png')`) instead of triggering a download. Wrap the nested
  `img.onload`/`logoImg.onload` async flow in a `Promise`. Returns `null` if the molecule SVG ref
  isn't available.
- `handleExport` becomes: `const url = await renderRecipeImage(); if (url) { <download link> }` —
  identical existing behavior.
- Add `handleSendToPhone`: set an `isSending` state, `const image = await renderRecipeImage()`
  (may be `null` → still emails text-only), `await recipeApi.emailRecipe(recipe.id, image ?? undefined)`,
  then success/error toast via the existing `useToast`. Reset `isSending` in `finally`.
- **UI:** add a **"Send to my phone"** button in the view-mode footer next to Export
  (`RecipeDetailModal.tsx:1040`), using a `lucide-react` icon (`Smartphone` or `Send`), disabled +
  spinner label ("Sending…") while `isSending`. Keep the existing Export (download) button.
- Reuse the file's existing `styles.exportBtn` (or add a sibling class) for consistent styling.

---

## Files touched (summary)
- `api/src/services/email/types.ts` — interface + `EmailAttachment`
- `api/src/services/email/providers/{resend,smtp,console}.ts` — public `sendEmail(options)` + attachments
- `api/src/services/email/templates.ts` — `getRecipeShareEmailContent`
- `api/src/routes/recipes.ts` — `POST /:id/email`
- `api/src/server.ts` — rate-limit mount
- `src/lib/api.ts` — `recipeApi.emailRecipe`
- `src/components/modals/RecipeDetailModal.tsx` — `renderRecipeImage` refactor + Send button

## Tests to add
- `api/src/routes/recipes.test.ts` — `POST /:id/email`: 401 unauthenticated; 404 for another user's
  recipe / missing id; 400 for malformed/oversized image; 200 happy path asserting
  `emailService.sendEmail` called with `to === req.user.email` and one attachment. Mock the email
  service (as existing auth tests do).
- Optionally assert `getRecipeShareEmailContent` renders each ingredient line.

## Verification (end-to-end)
1. `npm run build` at repo root and in `api/` — typecheck the new interface method across providers.
2. Backend tests: run the recipes route + email suites (project `test` skill / vitest).
3. Manual: `docker compose up`, log in, open a recipe → **Send to my phone**.
   - With **no** provider configured: confirm the Console provider logs the email + attachment note
     (proves the path end-to-end without external deps).
   - With `RESEND_API_KEY` set in `docker/.env`: confirm the email arrives at the account address,
     renders ingredients/instructions/glass, and the PNG attachment opens on a phone.
4. Confirm Export (download) still works unchanged after the `renderRecipeImage` refactor.
