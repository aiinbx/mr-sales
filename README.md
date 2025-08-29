## Mr Sales — AI Inbx × Firecrawl × Vercel AI SDK Starter (Next.js)

Mr Sales is a production-ready starter for building an email agent that automatically replies to inbound emails and continues multi‑turn conversations using:

- AI Inbx for inbound/outbound email + smart threading
- Firecrawl for company research (news + site scrape)
- Vercel AI SDK (OpenAI) for response generation

Useful for reply-on-inbound and follow-ups: on every new message in a thread, Mr Sales fetches the entire conversation, answers follow-up questions with full context, and continues the back-and-forth on the same thread.

---

### Features

- Inbound webhook via Next.js App Router (`/api/ai-inbx-webhook`) using `createNextRouteHandler`
- Company name extraction from the email thread
- Firecrawl search + website scrape to find credible personalization triggers
- Thread-aware, multi‑turn replies (uses the full email conversation, not just the first message)
- Prompted LLM reply → HTML body only → send via AI Inbx on the existing thread
 - Optional forwarding rules: Mr Sales can hand off threads to teammates while still replying to the sender

---

### Prerequisites

- Node.js 20+
- API keys for:
  - AI Inbx (required)
  - OpenAI (for Vercel AI SDK provider)
  - Firecrawl

---

### 0) Set up your AI Inbx account

Follow the Quickstart to get an account, verify a domain, and create an API key: [AI Inbx Quickstart](https://docs.aiinbx.com/quickstart). You can sign up at [aiinbx.com](https://aiinbx.com).

- Sign up and create your organization
- Connect and verify your domain (required to send)
- Create an API key (enable Draft Mode if you want manual approvals)

---

### 0) Set up your Firecrawl account

Sign up at [firecrawl.dev](https://firecrawl.dev) to create an account and generate an API key.

- Create an API key in your Firecrawl dashboard
- You'll reference it as `FIRECRAWL_API_KEY` in `.env.local`

---

### 0) Set up your OpenAI account

Sign up at [OpenAI Platform](https://platform.openai.com/) and create an API key.

- Create an API key in your OpenAI dashboard
- You'll reference it as `OPENAI_API_KEY` in `.env.local`

---

### 1) Configure environment

Copy `env.example` to `.env.local` in the project root:

```bash
# AI Inbx (required)
AI_INBX_API_KEY=sk_live_xxx
# Optional but recommended for webhook verification (see docs)
AI_INBX_SECRET=whsec_xxx

# Vercel AI SDK provider (OpenAI)
OPENAI_API_KEY=sk-openai-xxx

# Firecrawl
FIRECRAWL_API_KEY=fc_xxx
```

Notes:
- `AI_INBX_API_KEY` is used by the SDK client. The default client reads this from env automatically.
- If `AI_INBX_SECRET` is set, webhook requests are automatically verified by the helper.

See: [AI Inbx Docs](https://docs.aiinbx.com/) and [Webhooks](https://docs.aiinbx.com/webhooks).

---

### 2) Set up the AI Inbx webhook

1. Deploy or expose your dev server publicly (e.g., Vercel, ngrok)
2. Create a webhook in the AI Inbx dashboard: [Create a Webhook](https://aiinbx.com/start/webhooks)
3. Point it to your endpoint path: `/api/ai-inbx-webhook`
4. Enable signing and copy the secret into `AI_INBX_SECRET`

Webhook payload and verification details: [Webhooks](https://docs.aiinbx.com/webhooks)

---

### 3) Project configuration

Edit `src/lib/config.ts` to set your company info and the agent’s name and email:

```ts
export const mrSalesConfig = {
  infoAboutOurCompany: "<what you do>",
  mrSalesEmail: "mr-sales@yourdomain.com",
  mrSalesName: "Mr. Sales",
  forwardContacts: [
    // {
    //   email: "actual.sales.guy@yourdomain.com",
    //   name: "Actual Sales Guy",
    //   forwardPrompt:
    //     "Forward to Actual Sales Guy if the customer is rdy to book a call. Dont confirm any times or dates, just forward to Actual Sales Guy he will take over from there.",
    // },
  ],
};
```

This `mrSalesConfig` object now lives in `src/lib/config.ts` and controls the agent identity, basic behavior, and optional forwarding rules.

Mr Sales will only reply when the inbound email was sent to `mrSalesEmail`.

Optional forwarding rules:
- Define one or more entries in `forwardContacts` with `email`, optional `name`, and a natural-language `forwardPrompt` describing when to hand off.
- When a rule applies, the model calls an internal forward tool to send the thread to the specified address and still produces a short reply to the sender.
- If forwarded, the reply acknowledges the handoff (e.g., "I forwarded this to NAME — they will take over from here.") and avoids asking new questions; the teammate handles from there.

---

### 4) Install & run

```bash
# install
npm i

# dev
npm run dev
# or: pnpm dev / bun dev / yarn dev
```

The webhook route listens on: `/api/ai-inbx-webhook`

---

### How it works

- `src/app/api/ai-inbx-webhook/route.ts`: Next.js webhook handler using `createNextRouteHandler`. Uses `mrSalesConfig` from `src/lib/config.ts` (agent name, email, and company info). On `inbound.email.received`, it calls `mrSales` and replies on the same thread via `aiInbx.emails.reply`.
- `src/lib/mr-sales.ts`: Orchestrates the flow: verify recipient, fetch thread, extract company name, research with Firecrawl, craft prompts, generate HTML reply with the Vercel AI SDK (OpenAI), return `responseHtml`. Passes the full conversation (`threadToLLMString(thread)`) to the model, enabling follow-up answers and multi‑turn context. If `forwardContacts` are configured and a rule matches, it forwards the thread via `aiInbx.threads.forward` and still replies to the sender with a brief handoff message.
- `src/lib/extract-company-name.ts`: Uses the thread to infer the sender’s company name (considers inbound messages and handles quoted replies).
- `src/lib/research-company.ts`: Firecrawl search (news + web), optional website scrape, returns concise research context.
- `src/lib/firecrawl.ts`: Initialized Firecrawl client using `FIRECRAWL_API_KEY`.
- `src/lib/create-prompt.ts`: Simple prompt composer.

---

### Deploy

- Set the same env vars (`AI_INBX_API_KEY`, `AI_INBX_SECRET`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`) on your host (e.g., Vercel)
- After deploy, update your AI Inbx webhook URL to the production endpoint

---

### Troubleshooting

- No reply? Ensure the inbound `to` address matches `mrSalesEmail` exactly.
- 401 from webhook? Check `AI_INBX_SECRET` and that signing is enabled on the webhook.
- Empty research? Confirm `FIRECRAWL_API_KEY` and that the target company has public coverage.