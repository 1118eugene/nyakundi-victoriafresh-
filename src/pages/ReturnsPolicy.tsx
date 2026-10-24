import PolicyPage from './PolicyPage'

export default function ReturnsPolicy() {
  return (
    <PolicyPage
      title="Delivery, returns and refunds"
      summary="Delivery availability and fees shown at checkout are based on current configured service areas. The business owner must confirm delivery commitments and the remedies available for order problems before publication."
      sections={[
        {
          title: 'Delivery',
          paragraphs: ['Enter your county and town at checkout to see whether a delivery zone and fee are configured for your location. If the checkout cannot confirm availability or a fee, contact the team before relying on delivery. No delivery time estimate is promised here because the owner has not confirmed one.'],
        },
        {
          title: 'If there is a problem with an order',
          paragraphs: ['If an order is missing, incorrect, delayed or does not meet expectations, contact the team promptly using a verified contact option on the contact page and include your order number. Keep the order details available so the team can investigate.'],
        },
        {
          title: 'Returns, cancellations and refunds',
          paragraphs: ['The owner has not supplied the rules for returns, cancellations, replacements or refunds. This draft does not promise a particular remedy or time limit. Confirm the applicable rules, including how perishable products are handled and what evidence may be requested, before accepting customer orders.'],
        },
        {
          title: 'Owner confirmation required',
          paragraphs: ['Confirm delivery areas, delivery times, fees, order-change and cancellation cut-offs, customer support hours, refund or replacement criteria, and payment reversal procedure. These facts are tracked in docs/OWNER_TO_CONFIRM.md.'],
        },
      ]}
    />
  )
}
