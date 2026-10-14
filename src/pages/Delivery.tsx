import InfoPage from '../components/InfoPage'

export default function Delivery() {
  return (
    <InfoPage
      kicker="Freshness, delivered"
      title="Delivery availability"
      intro="Delivery coverage, fees, minimums, and timing depend on the service area configured by our team. Check your town at checkout before placing an order."
      sections={[
        { title: 'Check your address', text: 'Enter your county and town at checkout. The order quote will show whether delivery is available and any configured fee, minimum order, and delivery window. If no service area is configured for your address, checkout cannot be completed.' },
        { title: 'How delivery works', items: ['Choose your fish and quantity', 'Enter your county, town, street, landmark, and notes', 'Our team reviews the order and plans dispatch', 'Follow the private tracking link for order updates and any temporary shared location', 'Pay after delivery using the method selected at checkout'] },
        { title: 'Need help?', text: 'Contact our team before ordering if your location is not covered or you need to discuss a delivery arrangement.' },
      ]}
      ctaLabel="Order online"
      ctaTo="/products"
      imageSrc="/images/products/pexels-10039794.jpg"
      imageAlt="Fresh fish prepared for careful delivery"
    />
  )
}
