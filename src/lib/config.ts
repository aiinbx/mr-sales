export type MrSalesConfig = {
  infoAboutOurCompany: string;
  mrSalesEmail: string;
  mrSalesName: string;
  forwardEmails: {
    email: string;
    name?: string;
    forwardPrompt: string;
  }[];
};

export const mrSalesConfig = {
  infoAboutOurCompany: "<what you do>",
  mrSalesEmail: "mr-sales@yourdomain.com",
  mrSalesName: "Mr. Sales",
  forwardEmails: [
    // {
    //   email: "actual.sales.guy@yourdomain.com",
    //   name: "Actual Sales Guy",
    //   forwardPrompt:
    //     "Forward to Actual Sales Guy if the customer is rdy to book a call. Dont confirm any times or dates, just forward to Actual Sales Guy he will take over from there.",
    // },
  ],
};
