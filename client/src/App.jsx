import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Medicines from "./pages/Medicines";
import Supplements from "./pages/Supplements";
import BabyFood from "./pages/BabyFood";
import LabTests from "./pages/LabTests";
import UploadPrescription from "./pages/UploadPrescription";
import Consult from "./pages/Consult";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/medicines" element={<Medicines />} />
          <Route path="/supplements" element={<Supplements />} />
          <Route path="/baby-food" element={<BabyFood />} />
          <Route path="/lab-tests" element={<LabTests />} />
          <Route path="/upload-prescription" element={<UploadPrescription />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/cart" element={<Navigate to="/checkout" replace />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
