// Aggregator — keeps `require('./data/seedData')` working across the app.
const { medicines } = require("./medicines");
const { supplements } = require("./supplements");
const { babyFood } = require("./babyFood");
const { labTests } = require("./labTests");
const { doctors } = require("./doctors");
const { banners, categories, wellnessGuides, flashSale, coupons } = require("./content");

module.exports = {
  medicines,
  supplements,
  babyFood,
  labTests,
  doctors,
  banners,
  categories,
  wellnessGuides,
  flashSale,
  coupons,
};
