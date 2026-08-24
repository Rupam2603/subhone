/**
 * Merchant Regex Rules and Pattern Definitions for Order Extraction
 */

const MERCHANT_RULES = [
  {
    id: "amazon",
    name: "Amazon",
    domainMatch: /amazon\.(in|com|co\.uk|de|ca)/i,
    orderIdRegex: /(?:order\s*#?|order\s*number[:\s]*|details\s*for\s*order\s*#?\s*)([0-9]{3}-[0-9]{7}-[0-9]{7})/i,
    fallbackOrderIdRegex: /([0-9]{3}-[0-9]{7}-[0-9]{7})/,
  },
  {
    id: "flipkart",
    name: "Flipkart",
    domainMatch: /flipkart\.com/i,
    orderIdRegex: /(?:order\s*(?:id|#|number)?[:\s]*)(OD[0-9]{16,18}|[A-Z0-9]{16,20})/i,
    fallbackOrderIdRegex: /(OD[0-9]{16,18})/,
  },
  {
    id: "subhone",
    name: "SubhOne Health",
    domainMatch: /(subhone|subhonehealth|subhone\.local)/i,
    orderIdRegex: /(?:order\s*(?:reference|id|#)[:\s]*#?)([A-Z0-9-]{4,20})/i,
    fallbackOrderIdRegex: /#([A-Z0-9-]{6,16})/,
  },
  {
    id: "apple",
    name: "Apple",
    domainMatch: /apple\.com/i,
    orderIdRegex: /(?:order\s*(?:number|#)[:\s]*)(W[0-9]{8,12})/i,
    fallbackOrderIdRegex: /(W[0-9]{8,12})/,
  },
  {
    id: "swiggy",
    name: "Swiggy",
    domainMatch: /swiggy\.(in|com)/i,
    orderIdRegex: /(?:order\s*#?[:\s]*)([0-9]{9,15})/i,
  },
  {
    id: "zomato",
    name: "Zomato",
    domainMatch: /zomato\.com/i,
    orderIdRegex: /(?:order\s*(?:id|#)?[:\s]*)([0-9]{8,14})/i,
  },
  {
    id: "shopify",
    name: "Shopify Store",
    domainMatch: /(shopify|myshopify\.com)/i,
    orderIdRegex: /(?:order\s*#?\s*)(#[0-9]{4,8})/i,
  },
  {
    id: "stripe",
    name: "Stripe Receipt",
    domainMatch: /stripe\.com/i,
    orderIdRegex: /(?:receipt\s*#?[:\s]*)([0-9]{4}-[0-9]{4})/i,
  },
];

// Generic fallback patterns
const GENERIC_ORDER_ID_PATTERNS = [
  /(?:order\s*(?:number|id|#|reference|no\.?)[:\s]*)(#?[A-Z0-9-]{5,25})/i,
  /(?:invoice\s*(?:number|id|#|no\.?)[:\s]*)(#?[A-Z0-9-]{5,25})/i,
  /(?:receipt\s*(?:number|id|#|no\.?)[:\s]*)(#?[A-Z0-9-]{5,25})/i,
];

// Price extraction patterns
const PRICE_PATTERNS = [
  /(?:grand\s*total|order\s*total|amount\s*paid|total\s*amount|total)[:\s]*[₹$€£Rs\.]*\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i,
  /[₹$€£Rs\.]\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/,
];

// Tracking number patterns
const TRACKING_PATTERNS = [
  { carrier: "UPS", regex: /\b(1Z[0-9A-Z]{16})\b/i, url: "https://www.ups.com/track?tracknum=" },
  { carrier: "FedEx", regex: /\b([0-9]{12}|[0-9]{14}|[0-9]{15})\b/, url: "https://www.fedex.com/fedextrack/?trknbr=" },
  { carrier: "USPS", regex: /\b([0-9]{20,22}|[A-Z]{2}[0-9]{9}[A-Z]{2})\b/, url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=" },
  { carrier: "BlueDart", regex: /(?:waybill|tracking|awb)[:\s]*([0-9]{9,11})/i, url: "https://www.bluedart.com/tracking?trackNumber=" },
  { carrier: "Delhivery", regex: /(?:waybill|delhivery\s*tracking|awb)[:\s]*([0-9]{12,14})/i, url: "https://www.delhivery.com/track/package/" },
];

// Payment method patterns
const PAYMENT_PATTERNS = [
  { method: "Cash on Delivery", regex: /(cash\s*on\s*delivery|cod|pay\s*on\s*delivery)/i },
  { method: "UPI", regex: /(upi|gpay|google\s*pay|phonepe|paytm\s*upi|bhim)/i },
  { method: "Credit / Debit Card", regex: /(visa|mastercard|rupay|amex|card\s*ending\s*in\s*(\d{4})|ending\s*in\s*(\d{4}))/i },
  { method: "Net Banking", regex: /(net\s*banking|internet\s*banking)/i },
  { method: "PayPal", regex: /(paypal)/i },
  { method: "Stripe", regex: /(stripe)/i },
];

/**
 * Identifies merchant name and rules from email sender/body.
 */
function identifyMerchant(fromHeader = "", subject = "", bodyText = "") {
  for (const rule of MERCHANT_RULES) {
    if (rule.domainMatch.test(fromHeader) || rule.domainMatch.test(subject) || rule.domainMatch.test(bodyText)) {
      return rule;
    }
  }

  // Fallback: extract domain name or sender name
  const match = fromHeader.match(/<.*?@(?:www\.)?([^.]+)\./i) || fromHeader.match(/@([^.]+)\./i);
  if (match && match[1]) {
    const raw = match[1].toLowerCase();
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    return { id: raw, name, isGeneric: true };
  }

  return { id: "unknown", name: "Online Merchant", isGeneric: true };
}

module.exports = {
  MERCHANT_RULES,
  GENERIC_ORDER_ID_PATTERNS,
  PRICE_PATTERNS,
  TRACKING_PATTERNS,
  PAYMENT_PATTERNS,
  identifyMerchant,
};
