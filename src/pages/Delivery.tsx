import InfoPage from '../components/InfoPage'

export default function Delivery() {
  return (
    <InfoPage
      kicker="Freshness, delivered"
      title="Fish delivered across Nairobi"
      intro="We coordinate delivery from Gikomba Market, Nairobi, with clear address details captured at checkout so every order can be planned properly."
      sections={[
        { title: 'Current delivery areas', items: ['Nairobi CBD', 'Gikomba', 'Eastlands', 'Kasarani', 'Roysambu', 'Westlands', 'Kilimani', 'Kileleshwa', 'Karen', "Lang'ata", 'Embakasi', 'Ruaka', 'Kiambu'] },
        { title: 'How delivery works', items: ['Choose your fish and quantity', 'Enter your county, town, street, landmark, and notes', 'Our team reviews the order and plans dispatch', 'Receive your carefully handled order at the provided address'] },
        { title: 'Outside Nairobi', text: 'We also accept bulk and wholesale orders throughout Kenya. Contact the team to discuss availability, timing, and a suitable delivery arrangement.' },
      ]}
      ctaLabel="Order online"
      ctaTo="/products"
    />
  )
}
