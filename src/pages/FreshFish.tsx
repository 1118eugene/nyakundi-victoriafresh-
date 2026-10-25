import InfoPage from '../components/InfoPage'

export default function FreshFish() {
  return (
    <InfoPage
      kicker="Catalogue guide"
      title="Explore fish and seafood"
      intro="Browse the active catalogue for fish, seafood, cooked meals and processing services. Product price confirmation and stock are shown on each listing."
      sections={[
        { title: 'Catalogue categories', items: ['Fresh whole fish', 'Fillets', 'Dried fish and seafood', 'Smoked fish', 'Small fish', 'Coastal seafood', 'Ready-to-eat meals', 'Fish-processing services'] },
        { title: 'Before ordering', text: 'Check the listed unit, confirmed price and current stock. An item marked “Price to be confirmed” cannot be ordered online yet.' },
        { title: 'Delivery and payment', text: 'Enter your county and town to check coverage and any configured delivery fee. Checkout offers Cash on Delivery and M-Pesa on delivery where available.' },
      ]}
      ctaLabel="Shop fresh fish"
      ctaTo="/products"
      imageSrc="/images/products/nile-perch-wikimedia.jpg"
      imageAlt="Fresh Nile perch from Lake Victoria"
    />
  )
}
