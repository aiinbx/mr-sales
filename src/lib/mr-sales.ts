import { mrSalesConfig } from "@/lib/config";
import { openai } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs, tool } from "ai";
import AIInbx from "aiinbx";
import { threadToLLMString } from "aiinbx/helpers";
import { EmailRetrieveResponse } from "aiinbx/resources";
import z from "zod";
import createPrompt from "./create-prompt";
import { extractCompanyName } from "./extract-company-name";
import { researchCompany } from "./research-company";

const aiInbx = new AIInbx();

export const mrSales = async ({ email }: { email: EmailRetrieveResponse }) => {
  const isSentToMrSales = email.toAddresses.some(
    (recipient) =>
      recipient.toLowerCase() === mrSalesConfig.mrSalesEmail.toLowerCase()
  );

  if (!isSentToMrSales) {
    return {
      canBeAnswered: false,
      responseHtml: "",
    };
  }

  // Get the full conversation thread with all emails in the thread
  const thread = await aiInbx.threads.retrieve(email.threadId);

  const hasAtLeastOneEmailFromUs = thread.emails.some(
    (email) =>
      email.fromAddress.toLowerCase() ===
      mrSalesConfig.mrSalesEmail.toLowerCase()
  );

  const { companyName } = await extractCompanyName({ thread });

  console.log("companyName", companyName);

  const { interestingTexts } = await researchCompany({
    companyName,
  });

  const researchContext = interestingTexts.filter(Boolean).join("\n\n---\n\n");

  const thereAreForwardContacts = mrSalesConfig.forwardContacts.length > 0;

  const forwardingRulesText = thereAreForwardContacts
    ? [
        "Forwarding rules:",
        ...mrSalesConfig.forwardContacts.map(
          ({ email, name, forwardPrompt }) =>
            `- When: ${forwardPrompt}\n  To: ${
              name ? `${name} <${email}>` : email
            }`
        ),
        "",
        "When a rule applies:",
        "- Call the forwardTool with the matching address and a concise, helpful note (one sentence) explaining the reason based on the rule and thread.",
        "- ALWAYS still produce a natural reply email to the sender.",
        "- If you forward, do NOT ask the customer any questions in your reply (no availability requests, confirmations, or follow-ups).",
        "- Keep the reply brief: acknowledge the forward and state that NAME will take over from here.",
        "- In your reply, include one sentence acknowledging the forward, e.g., 'I forwarded this to NAME — they will <short phrase derived from the rule, like \"schedule a call\">.'",
        "- If the rule does not specify an explicit action, default to: 'they will take over the conversation from there.'",
        "- Assume the forwarded person can only see the email thread up to now (not your research).",
        "- In the forwardTool note, provide a one-sentence summary and immediate next action for them, using only information from the email thread.",
        "- If multiple rules fit, pick the single best target.",
        "- Only use the addresses listed above; never invent new ones.",
      ].join("\n")
    : "";

  const system = createPrompt({
    taskContext: `You are a helpful assistant that answers emails from customers. Your name is ${mrSalesConfig.mrSalesName}.`,
    backgroundData: `Here is everything you need to know about us: ${mrSalesConfig.infoAboutOurCompany}.`,
    detailedTaskInstructions:
      [
        "Use the provided research data (if you dont have enough or not about the right company use researchCompany) to identify credible trigger(s) about the recipient (e.g., recent news, product launch, event, hiring, funding, case study mention). Weave the trigger into the email like a human would: a brief, conversational nod, not a list. Avoid keyword dumps, dates, titles, or enumerations. Do not restate obvious facts about the company; use the trigger only to personalize why we’re reaching out. If none are credible, say so briefly and continue without fabricating. Use a warm, succinct tone with contractions.",
        "",
        "About-our-company grounding rules:",
        "- Only describe our company using the exact facts in the 'Here is everything you need to know about us' section.",
        "- Never invent or infer features, services, pricing, locations, clients, team size, awards, integrations, or timelines about our company.",
        "- Do not mix recipient research into statements about our company; research is only for personalizing the message to them.",
        "- If asked about something not covered in that section, keep it generic or say you don’t have that information or forward to the appropriate person.",
      ].join("\n") + (forwardingRulesText ? `\n\n${forwardingRulesText}` : ""),
    examples: `Trigger examples: 'Attended Webflow Conf 2024', 'Launched SMS booking feature', 'Raised a seed round', 'Opened a new location in Austin'.\n\nStyle examples:\n- Bad: "Noticed you’ve been serving the SF Bay Area since 2011, handle 24/7 emergencies, and sit on the PHCC SF board."\n- Good: "Saw you’re involved with PHCC SF—that focus on standards stood out. Thought this might be useful for your team…"`,
    outputFormatting: `Return production-ready BODY HTML (no <html>, <head>, or <body> tags) similar to Gmail/Outlook. Use simple tags: p, br, strong, em, a, ul, li. Keep inline styles minimal; use font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; max-width: 600px. Keep it concise and natural. Include credible trigger(s) when available, referenced naturally.`,
  });

  const onHookSuffix = hasAtLeastOneEmailFromUs
    ? " If the thread shows they are already engaged (e.g., asking specifics, evaluating, or discussing next steps), skip prospecting triggers and CTAs; focus on answering clearly without pitching or proposing meetings unless asked."
    : "";

  const prompt = createPrompt({
    taskContext: "Here is the full conversation:",
    backgroundData: `Here is research about ${companyName} that you can reference for a relevant trigger. Use it only if credible and avoid fabrication.\n\n${researchContext}`,
    conversationHistory: threadToLLMString(thread),
    finalRequest:
      "Answer the latest inbound email naturally. Include credible trigger(s) from the research when available, but mention them subtly and in your own words—no lists, no keyword dumps, no dates, and no quoting their site. Focus on why it matters and how we can help. If none are credible, say so briefly and proceed without fabricating. When referring to our company, strictly use only the facts from the 'Here is everything you need to know about us' section; do not assert capabilities, features, pricing, locations, clients, awards, or timelines not present there. If unknown, omit or keep it generic. Return only the BODY HTML (no <html>, <head>, or <body> tags)." +
      (thereAreForwardContacts
        ? " If you decide to use the forwardTool for this message, do not ask the customer any questions in your reply. Keep it short, acknowledge the forward, and state that NAME will take over from here; avoid proposing times or confirming details — the forwarded person will handle them."
        : "") +
      onHookSuffix,
  });

  const forwardTool = tool({
    description: "A tool for forwarding the conversation to someone.",
    inputSchema: z.object({
      forwardToEmailAddress: z.string(),
      note: z
        .string()
        .describe(
          "A note to the recipient of the forwarded email. This will be shown to the recipient."
        )
        .nullable(),
    }),
    execute: async ({ forwardToEmailAddress, note }) => {
      // If the forwardToEmailAddress is not in the forwardContacts array, return
      if (
        !mrSalesConfig.forwardContacts.some(
          (forwardEmail) => forwardEmail.email === forwardToEmailAddress
        )
      ) {
        return;
      }

      console.log("forwarding to", forwardToEmailAddress);
      await aiInbx.threads.forward(email.threadId, {
        to: forwardToEmailAddress,
        note: `Forwarded by ${mrSalesConfig.mrSalesName}: ${note}`,
      });
    },
  });

  console.log("Generating reply...");
  const { experimental_output: object } = await generateText({
    model: openai("gpt-5"),
    experimental_output: Output.object({
      schema: z.object({
        responseHtml: z.string(),
      }),
    }),
    system,
    prompt,
    stopWhen: stepCountIs(10),
    tools: {
      researchCompany: tool({
        description:
          "A tool for researching a company. Use this if you want to know more about a different company.",
        inputSchema: z.object({ companyName: z.string() }),
        execute: async ({ companyName }) => {
          console.log("researching company", companyName);
          const { interestingTexts } = await researchCompany({ companyName });
          return interestingTexts.filter(Boolean).join("\n\n---\n\n");
        },
      }),
      ...(thereAreForwardContacts && { forwardTool }),
    },
  });

  return {
    canBeAnswered: true,
    responseHtml: object.responseHtml,
  };
};
