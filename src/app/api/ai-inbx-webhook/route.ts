import { mrSalesConfig } from "@/lib/config";
import { mrSales } from "@/lib/mr-sales";
import AIInbx from "aiinbx";
import { createNextRouteHandler } from "aiinbx/helpers";
import { NextResponse } from "next/server";

const aiInbx = new AIInbx();

export const POST = createNextRouteHandler({
  onInboundEmail: async ({ payload }) => {
    const { email } = payload.data;

    const { responseHtml, canBeAnswered } = await mrSales({ email });

    if (!canBeAnswered) {
      return NextResponse.json({ sent: false });
    }

    await aiInbx.emails.reply(email.id, {
      from: mrSalesConfig.mrSalesEmail,
      html: responseHtml,
      from_name: mrSalesConfig.mrSalesName,
    });

    return NextResponse.json({ sent: true });
  },
});
