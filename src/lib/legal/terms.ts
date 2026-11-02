/**
 * DOGDZI Terms of Service. Bump TERMS_VERSION whenever the text changes in a
 * way people must re-accept; the app will ask everyone to accept again.
 *
 * DRAFT: have this reviewed by a qualified lawyer before launch.
 */

export const TERMS_VERSION = "2026-11-02";
export const TERMS_UPDATED = "2 November 2026";

export interface TermsSection {
  id: string;
  title: string;
  body: (string | { list: string[] })[];
}

export const TERMS: TermsSection[] = [
  {
    id: "agreement",
    title: "1. Agreement to these terms",
    body: [
      "These Terms of Service (the “Terms”) are a binding agreement between you and 9DEVs, the developer and operator of DOGDZI (“9DEVs”, “we”, “us”, “our” or “management”). They govern your use of the DOGDZI website, web app and any related services (together, the “Service”).",
      "By ticking “I agree”, creating an account, or using the Service in any way, including as a guest, you confirm that you have read, understood and accepted these Terms and our Privacy Notice. If you do not agree, do not use the Service.",
    ],
  },
  {
    id: "minors",
    title: "2. Age requirements and minors",
    body: [
      "You must be at least 18 years old to use the Service on your own. Young people aged 13 to 17 may use the Service only with the knowledge, consent and supervision of a parent or legal guardian, who accepts these Terms on their behalf. The Service is not intended for children under 13, who must not use it.",
      "Parents and guardians are fully responsible for a minor’s access to and use of the Service, including the content they create and the decisions they make.",
      "To the fullest extent permitted by law, 9DEVs and its management are not responsible or liable for any use of the Service by a minor, whether or not that use complies with this section. If you are a parent or guardian and believe a child under 13 is using the Service, contact us and we will close the account.",
    ],
  },
  {
    id: "service",
    title: "3. What DOGDZI is (and isn’t)",
    body: [
      "DOGDZI is a personal planning and accountability tool. It helps you plan actions, receive reminders, review what you missed and plan a recovery. It is provided for general personal productivity only.",
      "DOGDZI is not medical, mental-health, legal, financial or other professional advice, and it is not an emergency or safety service. Do not rely on it for anything where a missed reminder could cause harm, such as taking medication, caring for someone, or meeting a legal or financial deadline.",
      "Reminders and notifications depend on your device, browser, settings, connection and third-party services. We do not guarantee that any reminder will be delivered, or delivered on time.",
    ],
  },
  {
    id: "accounts",
    title: "4. Guest mode and accounts",
    body: [
      "In guest mode your data is stored only in your browser on that device. It is not backed up or synced, and it can be lost if you clear your browser data, change device, or use private browsing. You are responsible for that data.",
      "If you create an account, you must give accurate information, keep your password secure, and tell us promptly about any unauthorised use. You are responsible for everything that happens under your account.",
    ],
  },
  {
    id: "content",
    title: "5. Your content",
    body: [
      "You own the actions, notes, goals, reasons and other content you add (“Your Content”). You give us permission to store, process and display Your Content only as needed to run the Service for you, as described in our Privacy Notice.",
      "You are responsible for Your Content. Do not add anything unlawful, or information about other people that you do not have the right to share.",
    ],
  },
  {
    id: "use",
    title: "6. Acceptable use",
    body: [
      "You agree not to:",
      {
        list: [
          "break any law, or use the Service to harm, harass or deceive anyone;",
          "try to access accounts, data or systems that are not yours, or to bypass security or usage limits;",
          "interfere with, overload, scrape, copy, resell or reverse-engineer the Service, except where the law expressly allows it;",
          "upload malicious code or use automated means to create accounts or content.",
        ],
      },
    ],
  },
  {
    id: "availability",
    title: "7. Availability and changes to the Service",
    body: [
      "We may change, suspend or stop any part of the Service at any time, including features available to guests or accounts. We aim to keep the Service available, but we do not promise that it will be uninterrupted, secure or error-free, or that data will never be lost. Keep your own copies of anything important. You can export your data from Settings.",
    ],
  },
  {
    id: "warranty",
    title: "8. No warranties",
    body: [
      "To the fullest extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. You use the Service at your own risk, and you are responsible for your own time, choices and results.",
    ],
  },
  {
    id: "liability",
    title: "9. Limitation of liability",
    body: [
      "To the fullest extent permitted by law, 9DEVs, its management, owners, employees, contractors and partners will not be liable for any indirect, incidental, special, consequential or punitive loss or damage, or for any loss of time, productivity, opportunity, data, income or goodwill, arising from or connected with the Service, however caused.",
      "To the fullest extent permitted by law, our total liability for all claims relating to the Service is limited to the greater of (a) the amount you paid us for the Service in the 12 months before the claim, or (b) the equivalent of USD 50.",
    ],
  },
  {
    id: "release",
    title: "10. Release and agreement not to sue",
    body: [
      "By agreeing to these Terms you consent to use the Service on this basis. To the fullest extent permitted by law, you release 9DEVs and its management, owners, employees, contractors and partners from all claims, demands and liabilities arising from or connected with your use of the Service or the time you spend on it, and you agree, now and at any time in the future, not to bring or join any legal action against them in relation to those matters.",
      "This release covers claims that are known or unknown at the time you accept these Terms. It does not apply to any claim or right that cannot lawfully be waived or limited.",
    ],
  },
  {
    id: "indemnity",
    title: "11. Indemnity",
    body: [
      "To the extent permitted by law, you agree to indemnify and hold harmless 9DEVs and its management against any claims, losses and costs (including reasonable legal fees) arising from your breach of these Terms, Your Content, or your misuse of the Service.",
    ],
  },
  {
    id: "termination",
    title: "12. Suspension and termination",
    body: [
      "You may stop using the Service and delete your account at any time from Settings. We may suspend or close your access if you breach these Terms, if required by law, or to protect the Service or other users. Sections 8 to 11 and 14 continue to apply after your access ends.",
    ],
  },
  {
    id: "changes",
    title: "13. Changes to these Terms",
    body: [
      "We may update these Terms from time to time. If we make material changes, we will ask you to review and accept the new version in the app. If you do not accept, you must stop using the Service.",
    ],
  },
  {
    id: "law",
    title: "14. Governing law and disputes",
    body: [
      "These Terms are governed by the laws of the Republic of Ghana. Before starting any formal proceedings, you agree to contact us first and try in good faith to resolve the issue informally within 30 days. Subject to section 10, any dispute that cannot be resolved informally will be subject to the jurisdiction of the courts of Ghana.",
    ],
  },
  {
    id: "rights",
    title: "15. Your statutory rights",
    body: [
      "Nothing in these Terms excludes or limits any liability or right that cannot be excluded or limited under applicable law, including liability for fraud, or for death or personal injury caused by negligence, or your rights as a consumer where those rights cannot be waived. If any part of these Terms is found unenforceable, that part is limited to the minimum extent necessary and the rest remains in force.",
    ],
  },
  {
    id: "general",
    title: "16. General",
    body: [
      "These Terms, together with the Privacy Notice, are the entire agreement between you and us about the Service. If we do not enforce a right, that is not a waiver of it. You may not transfer your rights under these Terms; we may transfer ours as part of a reorganisation or sale of the Service.",
    ],
  },
  {
    id: "contact",
    title: "17. Contact",
    body: ["Questions about these Terms? Contact the DOGDZI team at 9DEVs."],
  },
];

export function hasAcceptedCurrentTerms(version: string | null | undefined): boolean {
  return version === TERMS_VERSION;
}
