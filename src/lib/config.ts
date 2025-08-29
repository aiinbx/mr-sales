export type MrSalesConfig = {
  infoAboutOurCompany: string;
  mrSalesEmail: string;
  mrSalesName: string;
  forwardContacts: {
    email: string;
    name?: string;
    forwardPrompt: string;
  }[];
};

export const mrSalesConfig: MrSalesConfig = {
  infoAboutOurCompany: "<what you do>",
  mrSalesEmail: "mr-sales@yourdomain.com",
  mrSalesName: "Mr. Sales",
  forwardContacts: [
    // {
    //   email: "max.from.engineering@yourdomain.com",
    //   name: "Max",
    //   forwardPrompt:
    //     "Forward to Max if the customer has deeper technical questions you cant answer.",
    // },
  ],
};
