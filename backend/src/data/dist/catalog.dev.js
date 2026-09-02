"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.categoryLabels = exports.verifiedCatalog = void 0;
// Product photos are reused only where they match the listed preparation.
var speciesProfiles = [{
  name: 'Tilapia',
  basePrice: 700,
  image: '/images/products/pexels-tilapia.jpg'
}, {
  name: 'Nile Perch (Mbuta)',
  basePrice: 850,
  image: '/images/products/fresh-nile-perch.jpg'
}, {
  name: 'Catfish (Nduma)',
  basePrice: 850,
  image: '/images/products/fresh-pexels-c.jpg'
}, {
  name: 'Omena',
  basePrice: 500,
  image: '/images/products/fish fresh.jpg'
}];
var sectionProfiles = [{
  category: 'fresh-whole',
  preparation: 'Fresh whole fish',
  unit: 'kg',
  image: null,
  priceAdjustment: 0
}, {
  category: 'fillet',
  preparation: 'Fresh fillet',
  unit: 'kg',
  image: '/images/products/pexels-fillet.jpg',
  priceAdjustment: 400
}, {
  category: 'ready-to-eat',
  preparation: 'Ready to eat',
  unit: 'plate',
  image: '/images/products/pexels-grilled.jpg',
  priceAdjustment: 250
}, {
  category: 'smoked',
  preparation: 'Smoked fish',
  unit: 'kg',
  image: '/images/products/pexels-smoked.jpg',
  priceAdjustment: 350
}];
var verifiedCatalog = speciesProfiles.flatMap(function (species) {
  return Array.from({
    length: 15
  }, function (_, productIndex) {
    var section = sectionProfiles[productIndex % sectionProfiles.length];
    var variant = String(productIndex + 1).padStart(2, '0');
    var image = section.image || species.image;
    return {
      sku: "".concat(species.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(), "-").concat(section.category.toUpperCase(), "-").concat(variant),
      name: "".concat(species.name, " ").concat(section.preparation, " ").concat(variant),
      description: "".concat(species.name, " prepared as ").concat(section.preparation.toLowerCase(), ", packed fresh for your order."),
      price: species.basePrice + section.priceAdjustment + productIndex * 20,
      unit: section.unit,
      image: image,
      category: section.category,
      species: species.name,
      preparation: section.preparation,
      quantity: 15,
      inStock: true,
      featured: productIndex === 0
    };
  });
});
exports.verifiedCatalog = verifiedCatalog;
var categoryLabels = {
  'fresh-whole': 'Fresh Whole Fish',
  fillet: 'Fish Fillets',
  'ready-to-eat': 'Cooked & Ready to Eat',
  smoked: 'Smoked Fish'
};
exports.categoryLabels = categoryLabels;
//# sourceMappingURL=catalog.dev.js.map
