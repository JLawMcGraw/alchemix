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
- Also add `EmailAttachment` to the type re-export in `api/src/services/email/index.ts:61`, which
  currently re-exports only `EmailProvider` and `EmailOptions`.

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

**First: add an HTML escape helper.** There is no `escapeHtml` anywhere in `api/src/utils/` or the
email service — the existing templates only ever interpolate tokens and URLs, so the need never came
up. This is the first template to inject free-form user text. Add alongside `redactForLogging`:

```ts
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

This is a **correctness** fix before it is a security one: an unescaped `&` in an everyday ingredient
line ("Bombay & Tonic") already breaks the rendered markup. Recipe text also arrives via CSV import
and AI generation, so raw tags reaching the body is a live possibility. (Blast radius is small — the
email only goes to the recipe's own owner — but the fix is one function.)

Then add `getRecipeShareEmailContent(recipe: { name; ingredients: string[]; instructions?: string; glass?: string }): { subject; html; text }`:
- Reuse the existing branded `generateEmailTemplate(content)` shell.
- Body: recipe name heading, an `<ul>` of ingredient lines, an instructions paragraph, and the glass
  chip (matching the styling idiom of `getVerificationEmailContent`). Ingredients render as a plain
  readable list (the molecular color-pips already live in the attached PNG, so no server-side
  ingredient classification is needed — avoids coupling the API to `@alchemix/recipe-molecule`).
- **Apply `escapeHtml` to every interpolated field** — name, each ingredient line, instructions,
  glass — in the `html` branch. The `subject` and `text` branches are plaintext and must NOT be
  escaped (escaping there leaks `&amp;` into what the user reads).
- Also return a `text` plaintext fallback (name, ingredients, instructions, glass).

### 4. `api/src/routes/recipes.ts` — new authed endpoint
Add `POST /api/recipes/:id/email`, mirroring the existing `POST /:id/made` handler
(`api/src/routes/recipes.ts:650`):
- Require auth: read `userId` + `email` from `req.user` (JWTPayload has both — `packages/types/src/database.ts:118`). 401 if missing.
- Validate `recipeId` (reuse the `parseInt`/`isNaN` guard pattern already in the file).
- Load the recipe **scoped to the user**: `recipeService.getById(recipeId, userId)`
  (`api/src/services/RecipeService.ts:254`). 404 if null → enforces ownership, no cross-user leakage.
- Attach the dedicated rate limiter as route middleware here (see §5), not in `server.ts`.
- Read optional `image` from body (a `data:image/png;base64,...` string). Validate it starts with
  `data:image/png;base64,`; enforce a size cap (reject if base64 payload > ~6 MB) → 400 on bad input.
  Strip the `data:` prefix to get raw base64 for the attachment. If absent, send text-only.
  The 6 MB cap fits under `express.json({ limit: '10mb' })` (`server.ts:416`), but the real payload
  size is currently **unmeasured**: the export canvas is 2160×3840 (1080×1920 at `scale = 2`,
  `RecipeDetailModal.tsx:~277`). Measure it during verification (see step 5 of Verification below);
  if it lands near the cap, render the emailed copy at `scale = 1`.
- Parse `recipe.ingredients` defensively into `string[]` (JSON.parse → array, else comma-split),
  mirroring the frontend `parseIngredients` in `src/components/modals/RecipeDetailModal.tsx:115`.
  (`getById` already runs `parseRecipeIngredients` (`RecipeService.ts:982`), but the declared type is
  `string | string[]` (`packages/types/src/domain.ts:130`) and that parse swallows failures, so the
  guard is both type-required and genuinely load-bearing.)
- Build content via `getRecipeShareEmailContent(...)` and send:
  `emailService.sendEmail({ to: req.user.email, subject, html, text, attachments })`.
- Wrap in `asyncHandler`; return `{ success: true }`.

### 5. Rate limiting — `api/src/config/rateLimiter.ts` + the route itself (NOT `server.ts`)

**Do not follow the `app.use('/api/recipes/bulk', ...)` pattern here.** Two reasons it misfires for
this route:

1. **It would key by IP, not user.** `bulkOperationsLimiter`'s keyGenerator reads `req.user?.userId`
   (`rateLimiter.ts:307`), but app-level `app.use()` mounts run *before* `router.use(authMiddleware)`
   (`recipes.ts:96`) — so `req.user` is always undefined there and it silently falls back to
   `req.ip`. That's tolerable for bulk deletes; for inbox-spam control it means every user behind one
   NAT/household IP shares a single bucket.
2. **Path-param mounts are unproven in this codebase.** Every existing app-level limiter mount is a
   literal prefix (`/api/recipes/bulk`, `/api/recipes/all`). `app.use('/api/recipes/:id/email', ...)`
   should match under Express 4, but there's no reason to take the risk.

Instead:
- Add a **dedicated** limiter in `api/src/config/rateLimiter.ts`, following the shape of
  `bulkOperationsLimiter` (`rateLimiter.ts:291`) — `windowMs: 15 * 60 * 1000`, `max: 10`,
  `skip: skipInTest`, and a keyGenerator using its **own** prefix: `` `recipe-email:${userId}` ``.
  Do not reuse `bulkOperationsLimiter` itself — its `bulk:${userId}` key is shared, so emailing
  recipes would eat into the user's bulk-delete budget.
- Attach it **inside the router**, after `router.use(authMiddleware)`:
  `router.post('/:id/email', recipeEmailLimiter, asyncHandler(async (req, res) => { ... }))`.
  `req.user` is populated by then, so it keys per user as intended.
- `api/src/server.ts` needs **no change**.

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
  `img.onload`/`logoImg.onload` async flow in a `Promise`.

  **The promise MUST settle on every branch.** `handleExport` has at least five exits today:
  the early `if (!recipe || !moleculeSvgRef.current) return`, `if (!ctx) return`, `img.onerror`
  (`:593`), `logoImg.onload` (`:575`), and `logoImg.onerror` (`:579`). Map each one:

  | branch | resolves with |
  |---|---|
  | missing recipe / molecule SVG ref | `null` |
  | `!ctx` (canvas 2D context unavailable) | `null` |
  | `img.onerror` (molecule SVG failed to load) | `null` |
  | `logoImg.onload` | `canvas.toDataURL('image/png')` |
  | `logoImg.onerror` (logo failed; canvas still valid) | `canvas.toDataURL('image/png')` |

  Add a timeout guard (~10s) that resolves `null`, since `img.onload`/`onerror` are not guaranteed to
  fire at all. **If any branch fails to settle, `handleSendToPhone` awaits forever with `isSending`
  stuck `true` and the button permanently disabled — and the `finally` below cannot rescue it,
  because the `await` never returns.** This is the single most likely way this refactor breaks.

- `handleExport` becomes: `const url = await renderRecipeImage(); if (url) { <download link> }` —
  identical existing behavior. Preserve the current toasts: success on download, and the
  `'Failed to export recipe'` error toast on the `null` path that `img.onerror` used to own.
- Add `handleSendToPhone`: set an `isSending` state, `const image = await renderRecipeImage()`
  (may be `null` → still emails text-only), `await recipeApi.emailRecipe(recipe.id, image ?? undefined)`,
  then success/error toast via the existing `useToast`. Reset `isSending` in `finally`.
  Have the success toast **name the destination address** ("Sent to you@example.com") so the user
  knows which inbox to check — this also makes the console-fallback caveat above self-evident.
- **UI:** add a **"Send to my phone"** button in the view-mode footer next to Export
  (`RecipeDetailModal.tsx:1040`), using a `lucide-react` icon (`Smartphone` or `Send`), disabled +
  spinner label ("Sending…") while `isSending`. Keep the existing Export (download) button.
- Reuse the file's existing `styles.exportBtn` (or add a sibling class) for consistent styling.

---

## Files touched (summary)
- `api/src/services/email/types.ts` — interface + `EmailAttachment`
- `api/src/services/email/index.ts` — re-export `EmailAttachment`
- `api/src/services/email/providers/{resend,smtp,console}.ts` — public `sendEmail(options)` + attachments
- `api/src/services/email/templates.ts` — `escapeHtml` + `getRecipeShareEmailContent`
- `api/src/config/rateLimiter.ts` — dedicated `recipeEmailLimiter`
- `api/src/routes/recipes.ts` — `POST /:id/email` (+ limiter as route middleware)
- `src/lib/api.ts` — `recipeApi.emailRecipe`
- `src/components/modals/RecipeDetailModal.tsx` — `renderRecipeImage` refactor + Send button

**`api/src/server.ts` is unchanged** — see §5.

## Tests to add

### `api/src/routes/recipes.test.ts` — `POST /:id/email`
Two things in this file's existing setup must be handled first, or the tests won't run:
- The `recipeService` mock (`recipes.test.ts:13–29`) is an **explicit method list** that does not
  include `getById`. **Add `getById: vi.fn()`** or the handler throws on an undefined function.
- The auth mock (`:33–39`) unconditionally sets `req.user = { userId: 1, email: 'test@example.com' }`.
  The proposed **401-unauthenticated** case therefore needs a per-test override of that mock —
  either do that explicitly, or drop the case (the guard is a two-line copy of the proven
  `POST /:id/made` pattern).

Cases: 404 for another user's recipe / unknown id (`getById` → `null`); 400 for a malformed or
oversized `image`; 200 happy path asserting `emailService.sendEmail` was called with
`to === req.user.email` and exactly one attachment. Mock the email service as the existing auth
tests do.

### `api/src/services/email/email.test.ts` — attachment pass-through (**required, not optional**)
This file already covers all three providers, so the incremental cost is small — and these are the
only tests that catch a base64-vs-`Buffer` mix-up between Resend (base64 **string**) and SMTP
(`Buffer.from(content, 'base64')`), which would otherwise surface as a corrupt attachment only in
manual testing against a live provider. Assert each provider forwards `filename`/`content` in its
own expected shape, and that Console logs the attachment count.

Also assert `getRecipeShareEmailContent` renders each ingredient line, **and** that a recipe named
`Gin & Tonic <b>` comes back escaped in `html` but unescaped in `text`/`subject`.

## Verification (end-to-end)
1. `npm run build` at repo root and in `api/` — typecheck the new interface method across providers.
2. Backend tests: run the recipes route + email suites (project `test` skill / vitest).
3. Manual: `docker compose up`, log in, open a recipe → **Send to my phone**.
   - With **no** provider configured: confirm the Console provider logs the email + attachment note
     (proves the path end-to-end without external deps).
   - With `RESEND_API_KEY` set in `docker/.env`: confirm the email arrives at the account address,
     renders ingredients/instructions/glass, and the PNG attachment opens on a phone.
4. Confirm Export (download) still works unchanged after the `renderRecipeImage` refactor.
5. **Measure the payload.** Log `image.length` (or check the request size in devtools Network) for a
   real recipe. Confirm it sits comfortably under the 6 MB cap; if not, drop the emailed copy's
   canvas `scale` to 1 and re-measure.
6. **Exercise the failure branches** of `renderRecipeImage` — the stuck-spinner risk from §7. Block
   the molecule SVG / logo requests in devtools and confirm: Send still completes (text-only email),
   the button re-enables, and Export shows its error toast rather than hanging.
