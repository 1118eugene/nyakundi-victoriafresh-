import InfoPage from '../components/InfoPage'

export default function Wholesale() {
  return (
    <InfoPage
      kicker="For growing businesses"
      title="Reliable wholesale fish supply"
      intro="Victoria Fresh Fish Kenya supports restaurants, hotels, supermarkets, schools, hospitals, and food businesses with dependable Lake Victoria fish supply."
      sections={[
        { title: 'Built for larger orders', text: 'Tell us the fish type, preparation, quantity, and delivery location. Our team will help plan a practical order around your schedule.' },
        { title: 'What businesses receive', items: ['Competitive wholesale and retail pricing', 'Hygienically cleaned and packaged fish', 'Sourcing and quality-control support', 'Delivery planning for repeat orders'] },
        { title: 'Start a conversation', text: 'Call or WhatsApp Moses or David with your requirements. We accept bulk and wholesale orders throughout Kenya.' },
      ]}
      ctaLabel="Contact the team"
      ctaTo="/contact"
    />
  )
}
