import InfoPage from '../components/InfoPage'

export default function FreshFish() {
  return (
    <InfoPage
      kicker="From Lake Victoria"
      title="Fresh fish for every table"
      intro="We source quality fish from Lake Victoria and prepare it with care for households, hotels, restaurants, supermarkets, schools, hospitals, and businesses."
      sections={[
        { title: 'What we supply', items: ['Nile Perch (Mbuta)', 'Tilapia', 'Catfish (Nduma)', 'Omena', 'Fish fillets', 'Fish steaks', 'Smoked fish', 'Whole fish', 'Fish heads', 'Fish frames'] },
        { title: 'Prepared with care', text: 'Every order is hygienically cleaned, carefully packaged, and handled to protect freshness from sourcing through delivery.' },
        { title: 'Retail and wholesale', text: 'Choose convenient household quantities from the shop or contact us for bulk pricing and recurring business orders.' },
      ]}
      ctaLabel="Shop fresh fish"
      ctaTo="/products"
      imageSrc="/images/products/fresh-nile-perch.jpg"
      imageAlt="Fresh Nile perch from Lake Victoria"
    />
  )
}
