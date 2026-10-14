import InfoPage from '../components/InfoPage'

export default function Delivery() {
  return (
    <InfoPage
      kicker="Freshness, delivered"
      title="Fish delivered across Nairobi"
      intro="We coordinate delivery from Gikomba Market, Nairobi, with clear address details captured at checkout so every order can be planned properly."
      sections={[
        { title: 'Current delivery areas', text: "Nairobi CBD, Gikomba, Eastlands, Kasarani, Roysambu, Westlands, Kilimani, Kileleshwa, Karen, Lang'ata, Embakasi, Ruaka, and nearby Kiambu. Contact us to confirm availability and timing for your address." },
        { title: 'How delivery works', items: ['Choose your fish and quantity', 'Enter your county, town, street, landmark, and notes', 'Our team reviews the order and plans dispatch', 'Follow the private tracking link for order updates and any temporary shared location', 'Pay after delivery using the method selected at checkout'] },
        { title: 'Outside Nairobi', text: 'Bulk and wholesale arrangements outside the listed areas are subject to availability and timing. Contact the team before placing an order so the delivery arrangement can be confirmed.' },
      ]}
      ctaLabel="Order online"
      ctaTo="/products"
      imageSrc="/images/products/pexels-10039794.jpg"
      imageAlt="Fresh fish prepared for careful delivery"
    />
  )
}
