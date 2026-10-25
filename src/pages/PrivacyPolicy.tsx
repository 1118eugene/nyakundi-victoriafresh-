import PolicyPage from './PolicyPage'

export default function PrivacyPolicy() {
  return (
    <PolicyPage
      title="Privacy policy"
      summary="This draft explains the personal information used to provide ordering and customer-account features in the context of Kenya’s Data Protection Act, 2019. The business controller’s identity, contact, retention schedule and final procedures must be confirmed by the owner before launch."
      sections={[
        {
          title: 'Information we collect',
          paragraphs: ['When you place an order or create an account, the service may collect your name, phone number, email address if supplied, delivery county, town, address and landmark, order contents, quantities, prices, payment method, order status and delivery instructions. Account credentials are handled by the backend; passwords are stored as password hashes rather than readable passwords.'],
          items: ['Order and account details you submit.', 'Technical records needed to operate and protect the service, such as authentication and request metadata.', 'Cart, account-session and display-preference data stored in your browser storage.'],
        },
        {
          title: 'How information is used',
          paragraphs: ['Information is used to process and fulfil orders, contact you about an order, manage payment and delivery, provide account access, answer support requests, prevent abuse, and keep business records. Do not submit information that is not needed for these purposes.'],
        },
        {
          title: 'Storage, sharing and retention',
          paragraphs: ['Order and account records are stored in the service database hosted by the operator’s configured PostgreSQL provider. Browser storage is used for cart and customer-session functionality. The service may share the minimum relevant order details with personnel who fulfil orders and with infrastructure or payment providers when those services are configured. The owner must confirm provider names, access controls, retention periods, deletion procedures and any transfers outside Kenya before publication.'],
        },
        {
          title: 'Your choices and rights',
          paragraphs: ['You may request access to or correction of your personal data, ask questions about its use, or raise an objection or deletion request, subject to applicable legal and operational record-keeping requirements. Contact the business using a verified contact method on the contact page. The owner must supply a contact for privacy requests and confirm the process for responding to them. You may also contact Kenya’s Office of the Data Protection Commissioner where appropriate.'],
        },
        {
          title: 'Cookies and analytics',
          paragraphs: ['The application currently uses browser local storage for cart, account-session and preference functionality. No analytics integration or advertising cookie was identified in the source inspected for this draft. This is not a guarantee about third-party hosting behavior; the owner should re-check the deployed services and update this notice if analytics, cookies or additional tracking are enabled.'],
        },
      ]}
    />
  )
}
