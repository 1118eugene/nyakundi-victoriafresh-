"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.categoryLabels = exports.verifiedCatalog = void 0;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

// Product photos are reused only where they match the listed preparation.
var speciesProfiles = [{
  name: 'Tilapia',
  basePrice: 650,
  image: '/images/products/pexels-tilapia.jpg',
  preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fried', 'ready-to-eat', 50, 'plate'], ['Grilled', 'ready-to-eat', 100, 'plate'], ['Roasted', 'ready-to-eat', 100, 'plate'], ['Smoked', 'smoked', 150, 'kg']]
}, {
  name: 'Nile Perch (Mbuta)',
  basePrice: 850,
  image: '/images/products/fresh-nile-perch.jpg',
  preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fried', 'ready-to-eat', 50, 'plate'], ['Grilled', 'ready-to-eat', 100, 'plate'], ['Roasted', 'ready-to-eat', 100, 'plate'], ['Fillet', 'fillet', 150, 'kg']]
}, {
  name: 'Catfish (Nduma)',
  basePrice: 750,
  image: '/images/products/fresh-pexels-c.jpg',
  preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fried', 'ready-to-eat', 50, 'plate'], ['Grilled', 'ready-to-eat', 100, 'plate'], ['Roasted', 'ready-to-eat', 100, 'plate'], ['Smoked', 'smoked', 150, 'kg']]
}, {
  name: 'Omena',
  basePrice: 500,
  image: '/images/products/fish fresh.jpg',
  preparations: [['Fresh', 'fresh-whole', 0, 'kg'], ['Fried', 'ready-to-eat', 50, 'plate'], ['Dried', 'dried', 100, '500g pack']]
}];
var verifiedCatalog = speciesProfiles.flatMap(function (species) {
  return Array.from({
    length: 15
  }, function (_, productIndex) {
    var _species$preparations = _slicedToArray(species.preparations[productIndex % species.preparations.length], 4),
        preparation = _species$preparations[0],
        category = _species$preparations[1],
        priceAdjustment = _species$preparations[2],
        unit = _species$preparations[3];

    var variant = String(productIndex + 1).padStart(2, '0');
    var image = category === 'fillet' ? '/images/products/pexels-fillet.jpg' : category === 'ready-to-eat' ? '/images/products/pexels-grilled.jpg' : category === 'smoked' ? '/images/products/pexels-smoked.jpg' : species.image;
    return {
      sku: "".concat(species.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(), "-").concat(category.toUpperCase(), "-").concat(preparation.toUpperCase(), "-").concat(variant),
      name: "".concat(species.name, " ").concat(preparation, " ").concat(variant),
      description: "".concat(species.name, " prepared ").concat(preparation.toLowerCase(), " and packed carefully for your order."),
      price: species.basePrice + priceAdjustment,
      unit: unit,
      image: image,
      category: category,
      species: species.name,
      preparation: preparation,
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
