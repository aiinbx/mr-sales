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
    //   email: "max.from.engineering@yourdomain.com",
    //   name: "Max",
    //   forwardPrompt:
    //     "Forward to Max if the customer has deeper technical questions you cant answer.",
    // },
  ],
};
