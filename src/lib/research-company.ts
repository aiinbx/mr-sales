import { openai } from "@ai-sdk/openai";
import type { SearchResultWeb } from "@mendable/firecrawl-js";
import { generateObject } from "ai";
import z from "zod";
import { firecrawl } from "./firecrawl";

export const researchCompany = async ({
  companyName,
}: {
  companyName: string;
}) => {
  const news = await firecrawl.search(`latest news about "${companyName}"`, {
    sources: ["news", "web"],
    scrapeOptions: {
      formats: ["summary"],
    },
  });

  const newsSummaries = [
    ...(news.news?.map((n) => ("summary" in n ? n.summary : "")) ?? []),
    ...(news.web?.map((n) => ("summary" in n ? n.summary : "")) ?? []),
  ];

  const websiteRes = await firecrawl.search(companyName);
  const candidates = websiteRes.web
    ?.filter((w): w is SearchResultWeb => "url" in w)
    .map((w) => ({
      url: w.url,
      title: w.title,
      description: w.description,
    }));

  console.log(candidates);

  const {
    object: { websiteUrl },
  } = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: z.object({
      websiteUrl: z.string(),
    }),
    prompt: `Pls return the website url of ${companyName}, here are the results from google search: ${JSON.stringify(
      candidates
    )}`,
  });

  console.log(websiteUrl);

  const websiteMarkdown =
    websiteUrl &&
    (
      await firecrawl.scrape(websiteUrl, {
        formats: ["markdown"],
      })
    ).markdown;

  return {
    interestingTexts: [...newsSummaries, websiteMarkdown],
    websiteUrl,
  };
};
