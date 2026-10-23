import InfoPage from '../components/InfoPage'

export default function Wholesale() {
  return (
    <InfoPage
      kicker="Bulk enquiries"
      title="Ask about larger orders"
      intro="For quantities or product combinations not shown in the online catalogue, send the team an enquiry to confirm current options, prices and delivery coverage."
      sections={[
        { title: 'What to include', text: 'Tell the team which products you are interested in, the quantities and your delivery town. The team can confirm whether the request is available.' },
        { title: 'Pricing and delivery', text: 'Bulk pricing, delivery areas, fees and timing are not promised here. Contact us to confirm those details before placing an order.' },
        { title: 'Place an enquiry', text: 'Use the contact form and include a phone number so the team can respond. Do not send payment PINs or passwords.' },
      ]}
      ctaLabel="Contact the team"
      ctaTo="/contact"
      imageSrc="/images/products/pexels-grilled.jpg"
      imageAlt="Grilled fish prepared for a business meal"
    />
  )
}
