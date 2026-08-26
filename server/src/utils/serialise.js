// Shared catalog serializers.
//
// Public catalog ids use the committed string `id` ("m1"), NOT String(_id).
// cartService.loadRef and orderService.resolveLine resolve the catalog by
// findOne({ id }), so emitting _id would silently break every cart/order lookup.
// Prices are stored and emitted in paise.

function publicProduct(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, createdAt, updatedAt, pricePaise, mrpPaise, ...rest } = o;
  return {
    ...rest,
    id: o.id, // the committed string id — DO NOT use _id
    price: pricePaise, // paise
    originalPrice: mrpPaise, // paise
    pricePaise,
    mrpPaise,
  };
}

function publicLabTest(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, createdAt, updatedAt, pricePaise, mrpPaise, ...rest } = o;
  return {
    ...rest,
    id: o.id,
    price: pricePaise,
    originalPrice: mrpPaise,
    pricePaise,
    mrpPaise,
  };
}

module.exports = { publicProduct, publicLabTest };
