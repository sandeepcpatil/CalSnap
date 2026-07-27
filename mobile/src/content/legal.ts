// CalSnap legal content — single source for the in-app Terms & Privacy screens.
// NOTE: This is a good-faith template, not legal advice. Have it reviewed by a
// lawyer and fill in the bracketed fields ([ ]) before you rely on it.

export interface LegalSection {
  title: string;
  body: string;
}

export const LEGAL_LAST_UPDATED = "12 July 2026";
export const SUPPORT_EMAIL = "calsnap.support@gmail.com"; // TODO: replace with your real support email
export const LEGAL_ENTITY = "CalSnap"; // TODO: replace with your registered legal entity name

export const TERMS: LegalSection[] = [
  {
    title: "1. Acceptance of these Terms",
    body: `By creating an account or using CalSnap ("the App"), you agree to these Terms of Service. If you do not agree, please do not use the App.`,
  },
  {
    title: "2. Eligibility",
    body: `You must be at least 16 years old to use CalSnap. The App is not intended for children. By using it, you confirm you meet this requirement.`,
  },
  {
    title: "3. What CalSnap does",
    body: `CalSnap uses artificial intelligence to estimate the calories and macronutrients of food from photos you take, and helps you log and track your nutrition over time. Estimates are approximate and generated automatically.`,
  },
  {
    title: "4. Not medical or nutritional advice",
    body: `CalSnap provides estimates for general informational and educational purposes only. It is NOT a medical device and does not provide medical, dietary, or nutritional advice, diagnosis, or treatment. Calorie and macro figures are estimates and may be inaccurate. Always consult a qualified doctor or dietitian before making decisions about your diet, health, or any medical condition. Do not rely on CalSnap for medical purposes.`,
  },
  {
    title: "5. Your account",
    body: `You sign in using a third-party provider (such as Google). You are responsible for keeping your account secure and for all activity under it. Notify us promptly of any unauthorized use.`,
  },
  {
    title: "6. Free trial, subscriptions & billing",
    body: `New users receive a 7-day free trial. After the trial, free accounts may perform a limited number of scans per day. CalSnap Pro is a paid auto-renewing subscription (monthly or annual) with a generous daily fair-use scan limit.

Payment is charged to your Apple App Store or Google Play account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. You manage or cancel your subscription in your App Store or Google Play account settings — not in the App. Refunds are handled by Apple or Google under their policies; we do not separately process refunds.`,
  },
  {
    title: "7. Acceptable use",
    body: `You agree not to misuse the App, including: automating or abusing the scanning service, exceeding fair-use limits through technical means, reselling or redistributing the service, reverse-engineering it, or uploading unlawful content. We may suspend accounts that abuse the service.`,
  },
  {
    title: "8. Your content",
    body: `You retain ownership of the food photos and information you submit. You grant CalSnap a limited licence to process this content to provide the service (including sending images to our AI provider for analysis). Food images are automatically deleted after 90 days; your nutrition logs remain until you delete them or your account.`,
  },
  {
    title: "9. Intellectual property",
    body: `The App, its design, and its content (excluding your content) are owned by ${LEGAL_ENTITY} and protected by law. You may not copy, modify, or create derivative works without permission.`,
  },
  {
    title: "10. Third-party services",
    body: `CalSnap relies on third parties including Supabase (hosting & authentication), Google (sign-in and AI analysis via Gemini), and RevenueCat (subscription management). Your use of the App is also subject to their terms.`,
  },
  {
    title: "11. Disclaimers & limitation of liability",
    body: `The App is provided "as is" without warranties of any kind. To the maximum extent permitted by law, CalSnap and its operators are not liable for any indirect, incidental, or consequential damages, or for any decisions you make based on the App's estimates.`,
  },
  {
    title: "12. Termination",
    body: `You may stop using CalSnap and delete your account at any time. We may suspend or terminate access if you breach these Terms.`,
  },
  {
    title: "13. Changes to these Terms",
    body: `We may update these Terms from time to time. Material changes will be notified in the App. Continued use after changes means you accept the updated Terms.`,
  },
  {
    title: "14. Governing law",
    body: `These Terms are governed by the laws of India, and any disputes are subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka, India.`,
  },
  {
    title: "15. Contact",
    body: `Questions about these Terms? Contact us at ${SUPPORT_EMAIL}.`,
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: "1. Introduction",
    body: `This Privacy Policy explains how CalSnap collects, uses, and protects your information. By using the App, you agree to this policy.`,
  },
  {
    title: "2. Information we collect",
    body: `• Account information: your email address, name, and profile photo from your sign-in provider.
• Health & profile data you provide: weight, height, age, gender, activity level, and goals — used to calculate your targets.
• Food data: the photos you scan and the resulting food logs (name, calories, macros, meal type, time).
• Subscription information: your subscription status and history, via RevenueCat and the app stores. We do not receive or store your card details.
• Basic usage and device information needed to run and improve the App.`,
  },
  {
    title: "3. How we use your information",
    body: `We use your information to: provide food analysis and tracking, calculate your nutrition targets, manage your subscription and trial, provide support, keep the App secure, and improve the service.`,
  },
  {
    title: "4. AI processing of your photos",
    body: `To estimate nutrition, the food images you scan are sent to our AI provider, Google (Gemini API), for analysis. We send only what is needed for the estimate. Please review Google's applicable terms for how they handle API data. Images are deleted from our storage after 90 days.`,
  },
  {
    title: "5. How we share information",
    body: `We do not sell your personal data. We share it only with service providers that help us run CalSnap: Supabase (secure hosting and authentication), Google (sign-in and AI analysis), and RevenueCat (subscription management). We may disclose information if required by law.`,
  },
  {
    title: "6. Data retention",
    body: `Food images are automatically deleted 90 days after upload. Your account and nutrition logs are retained until you delete your account. You can request deletion at any time.`,
  },
  {
    title: "7. Your rights & choices",
    body: `You can access and correct your profile in the App. You can delete your account and associated data by contacting us at ${SUPPORT_EMAIL} (or via the in-app delete option, where available). Depending on your location, you may have additional rights under applicable data protection laws.`,
  },
  {
    title: "8. Security",
    body: `We use industry-standard measures to protect your data, including encryption in transit and access controls. No method of transmission or storage is 100% secure, but we work to protect your information.`,
  },
  {
    title: "9. Children",
    body: `CalSnap is not directed to children under 16 and we do not knowingly collect their data. If you believe a child has provided us information, contact us and we will delete it.`,
  },
  {
    title: "10. International transfers",
    body: `Your information may be processed on servers located outside your country (for example, by our hosting and AI providers). We take steps to ensure appropriate protection for such transfers.`,
  },
  {
    title: "11. Changes to this policy",
    body: `We may update this Privacy Policy. Material changes will be notified in the App, and the "last updated" date below will change.`,
  },
  {
    title: "12. Contact",
    body: `For privacy questions or requests, contact us at ${SUPPORT_EMAIL}.`,
  },
];
