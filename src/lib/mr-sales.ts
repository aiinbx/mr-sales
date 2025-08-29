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

  const system = createPrompt({
    taskContext: `You are a helpful assistant that answers emails from customers. Your name is ${mrSalesConfig.mrSalesName}.`,
    backgroundData: `Here is everything you need to know about us: ${mrSalesConfig.infoAboutOurCompany}.`,
    detailedTaskInstructions:
      "Use the provided research data (if you dont have enough or not about the right company use researchCompany) to identify credible trigger(s) about the recipient (e.g., recent news, product launch, event, hiring, funding, case study mention). Weave the trigger into the email like a human would: a brief, conversational nod, not a list. Avoid keyword dumps, dates, titles, or enumerations. Do not restate obvious facts about the company; use the trigger only to personalize why we’re reaching out. If none are credible, say so briefly and continue without fabricating. Use a warm, succinct tone with contractions.",
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
      "Answer the latest inbound email naturally. Include credible trigger(s) from the research when available, but mention them subtly and in your own words—no lists, no keyword dumps, no dates, and no quoting their site. Focus on why it matters and how we can help. If none are credible, say so briefly and proceed without fabricating. Return only the BODY HTML (no <html>, <head>, or <body> tags)." +
      onHookSuffix,
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
    },
  });

  return {
    canBeAnswered: true,
    responseHtml: object.responseHtml,
  };
};
