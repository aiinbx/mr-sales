import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { threadToLLMString } from "aiinbx/helpers";
import { ThreadRetrieveResponse } from "aiinbx/resources";
import z from "zod";

export const extractCompanyName = async ({
  thread,
}: {
  thread: ThreadRetrieveResponse;
}) => {
  const { object } = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: z.object({
      companyName: z.string(),
    }),
    system: `Your Job is to extract the company name from the incoming emails.`,
    prompt: `Here are all emails: ${threadToLLMString(thread)}
    
pls extract the name of the company who is sending us emails. (incomming)`,
  });

  return { ...object };
};
