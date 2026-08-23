import { ShoppingCart, FileText } from "lucide-react";
import { useCart } from "../context/CartContext";
import { discountPct, cx } from "../lib/format";
import Price from "./ui/Price";
import RatingStars from "./ui/RatingStars";
import QuantitySelector from "./ui/QuantitySelector";
import Button from "./ui/Button";

// Works for both medicines and supplements (product.type distinguishes them).
export default function ProductCard({ product }) {
  const { getQuantity, addItem, updateItem, removeItem } = useCart();
  const qty = getQuantity(product.id, product.type);
  const pct = discountPct(product.price, product.originalPrice);
  const outOfStock = product.type === "medicine" && product.inStock === false;
  const meta = product.packSize || (product.servings ? `${product.servings} servings` : product.category);

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-surface-container-low">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={cx(
            "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
            outOfStock && "opacity-60 grayscale"
          )}
        />
        {pct > 0 && <span className="badge badge-discount absolute left-3 top-3">{pct}% OFF</span>}
        <span className="absolute right-3 top-3">
          {product.type === "medicine" ? (
            product.prescriptionRequired ? (
              <span className="badge badge-rx"><FileText className="h-3 w-3" /> Rx</span>
            ) : (
              <span className="badge badge-otc">OTC</span>
            )
          ) : product.veg ? (
            <span className="badge badge-otc text-primary">🌿 Veg</span>
          ) : null}
        </span>
        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-navy-deep/80 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">
            Out of stock
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{product.brand}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5rem] font-display text-[15px] font-bold leading-tight text-on-surface">
          {product.name}
        </h3>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <RatingStars rating={product.rating} reviews={product.reviews} />
        </div>

        {meta && <p className="mt-1 truncate text-xs text-on-surface-variant">{meta}</p>}

        {Array.isArray(product.highlights) && product.highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.highlights.slice(0, 2).map((h) => (
              <span key={h} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {h}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <Price price={product.price} mrp={product.originalPrice} size="sm" className="mb-3" />
          {outOfStock ? (
            <Button variant="outline" size="sm" fullWidth disabled>
              Notify me
            </Button>
          ) : qty > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-primary">In cart</span>
              <QuantitySelector
                size="sm"
                quantity={qty}
                onIncrease={() => updateItem(product, qty + 1)}
                onDecrease={() => updateItem(product, qty - 1)}
                onDelete={() => removeItem(product)}
              />
            </div>
          ) : (
            <Button variant="primary" size="sm" fullWidth onClick={() => addItem(product)}>
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
