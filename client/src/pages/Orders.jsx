import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, RefreshCw } from "lucide-react";
import api from "../lib/api";
import { inr } from "../lib/format";
import Button from "../components/ui/Button";
import { EmptyState, SectionHeader, Spinner } from "../components/ui/Feedback";

function OrderCard({ order }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-on-surface">{order.id}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {new Date(order.placedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {order.status}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-outline-variant pt-4">
        <p className="text-sm text-on-surface-variant">
          {order.items.length} {order.items.length === 1 ? "item" : "items"}
        </p>
        <p className="text-lg font-extrabold text-on-surface">{inr(order.total)}</p>
      </div>
    </Link>
  );
}

function OrderDetail({ order }) {
  return (
    <div className="space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <SectionHeader eyebrow="Order details" title={order.id} subtitle={order.eta} />
      <div className="card p-5">
        <div className="space-y-4">
          {order.timeline?.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${stage.done ? "bg-primary" : "bg-outline-variant"}`} />
              <span className={stage.current ? "font-bold text-primary" : "text-on-surface-variant"}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="card divide-y divide-outline-variant p-5">
        {order.items.map((item) => (
          <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="font-semibold text-on-surface">{item.name}</p>
              <p className="text-sm text-on-surface-variant">Qty {item.quantity}</p>
            </div>
            <p className="font-bold text-on-surface">{inr(item.price * item.quantity)}</p>
          </div>
        ))}
        <div className="flex justify-between pt-4 text-lg font-extrabold text-on-surface">
          <span>Total</span>
          <span>{inr(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const { id } = useParams();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const load = id ? api.getOrder(id) : api.getOrders();
    load
      .then((data) => {
        if (!active) return;
        if (id) setSelectedOrder(data);
        else setOrders(data || []);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return <div className="container-max flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }

  if (status === "error") {
    return (
      <div className="container-max py-12">
        <EmptyState
          icon={Package}
          title="Orders are unavailable"
          message="We couldn't load your order information right now."
          action={<Button onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Try again</Button>}
        />
      </div>
    );
  }

  if (id) {
    return <main className="container-max py-8 sm:py-12">{selectedOrder && <OrderDetail order={selectedOrder} />}</main>;
  }

  return (
    <main className="container-max py-8 sm:py-12">
      <SectionHeader eyebrow="Your account" title="My orders" subtitle="Track your recent SubhOne purchases." />
      {orders.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div>
      ) : (
        <EmptyState className="mt-8" icon={Package} title="No orders yet" message="Your completed purchases will appear here." action={<Button as={Link} to="/medicines">Browse medicines</Button>} />
      )}
    </main>
  );
}
