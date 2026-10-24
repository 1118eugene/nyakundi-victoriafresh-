import PolicyPage from './PolicyPage'

export default function TermsOfService() {
  return (
    <PolicyPage
      title="Terms of service"
      summary="These draft terms describe the website and order flow. The owner must review them and provide the business identity and operational details before accepting customer orders."
      sections={[
        {
          title: 'Catalogue and prices',
          paragraphs: ['Products, availability, confirmed prices and quantities are provided by the active catalogue. An unconfirmed price or unavailable item cannot be checked out. The backend determines the payable product prices and stock; a total shown by a customer device is not authoritative. The team may contact you if an order needs clarification.'],
        },
        {
          title: 'Orders and payment',
          paragraphs: ['Submitting checkout sends an order request and is not a guarantee of fulfilment until the business confirms the order. Available payment choices are shown during checkout and may depend on the delivery area and service configuration. Cash on delivery and M-Pesa after delivery must be confirmed by the owner as available for each service area. M-Pesa prompts are only available when the live payment integration is configured.'],
        },
        {
          title: 'Delivery and customer details',
          paragraphs: ['Delivery availability and any configured fee are presented at checkout. You are responsible for providing a reachable phone number and complete delivery details. The owner must confirm service areas, delivery estimates, fees, opening hours and order-change or cancellation rules.'],
        },
        {
          title: 'Website use and contact',
          paragraphs: ['Use the website lawfully and provide accurate information. Do not attempt to interfere with the service, access protected administration features, or submit false orders. For order help or to raise a concern, use the contact options published on the contact page.'],
        },
        {
          title: 'Business details and governing terms',
          paragraphs: ['The legal business name, registration details, physical or service address, applicable dispute process and governing-law wording are owner-supplied facts and are intentionally not invented in this draft. They must be reviewed and confirmed before publication.'],
        },
      ]}
    />
  )
}
