import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, FileText, CheckCircle2, AlertCircle, X, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import Button from "../components/ui/Button";
import api from "../lib/api";
import { cx } from "../lib/format";
import { sendPrescriptionNotification } from "../lib/emailjs";

export default function UploadPrescription() {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Please upload a valid image (JPG, PNG, WEBP) or PDF file.");
      return;
    }
    if (selectedFile.size > 8 * 1024 * 1024) {
      setError("File is too large. Maximum size is 8MB.");
      return;
    }
    setFile(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("prescription", file);
      if (notes) formData.append("notes", notes);

      await api.uploadPrescription(formData);
      setSuccess(true);

      // Asynchronously notify via EmailJS if configured
      sendPrescriptionNotification({
        fileName: file.name,
        notes,
      }).catch((err) => console.debug("[Prescription EmailJS]", err));
    } catch (err) {
      setError(err.message || "Failed to upload prescription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container-max flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-vibrant/20 text-emerald-vibrant">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold text-on-surface">Prescription Received!</h1>
        <p className="mt-3 max-w-md text-on-surface-variant">
          Our pharmacists are reviewing your prescription. You will receive an SMS and an email with a link to checkout once your order is built.
        </p>
        <div className="mt-8 flex gap-4">
          <Button onClick={() => navigate("/")} variant="outline" size="lg">
            Back to Home
          </Button>
          <Button as={Link} to="/orders" variant="primary" size="lg">
            View My Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-max max-w-4xl py-8 sm:py-12 animate-fade-in">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-on-surface sm:text-4xl">Upload Prescription</h1>
        <p className="mt-3 text-on-surface-variant">
          Upload a valid prescription and we'll arrange the medicines for you.
        </p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              className={cx(
                "relative flex min-h-[280px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest",
                error ? "border-error" : ""
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={handleChange}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                title=""
              />
              
              {!file ? (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-on-surface">Drag & drop your file here</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    or click to browse from your device
                  </p>
                  <p className="mt-4 text-xs font-semibold text-on-surface-variant">
                    Supported formats: JPG, PNG, WEBP, PDF (Max 8MB)
                  </p>
                </>
              ) : (
                <div className="z-20 flex w-full max-w-md items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-on-surface">{file.name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="relative z-30 shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-surface-container-highest hover:text-error"
                    aria-label="Remove file"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-error/10 p-4 text-sm font-semibold text-error">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="notes" className="mb-2 block text-sm font-bold text-on-surface">
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific instructions for the pharmacist?"
                className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
              />
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={!file || loading}>
              {loading ? "Uploading..." : "Upload & Continue"}
              {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-surface-container-low p-6">
            <h3 className="font-display text-lg font-bold text-on-surface">How it works</h3>
            <ul className="mt-4 space-y-4 text-sm text-on-surface-variant">
              <li className="flex gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary">1</div>
                <p>Upload a clear photo or PDF of your valid prescription.</p>
              </li>
              <li className="flex gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary">2</div>
                <p>Our pharmacists review and digitize it within 30 minutes.</p>
              </li>
              <li className="flex gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary">3</div>
                <p>Review the final cart and proceed to checkout.</p>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl bg-surface-container-low p-6">
            <h3 className="font-display text-lg font-bold text-on-surface">Valid Prescription Guide</h3>
            <ul className="mt-4 space-y-3 text-sm text-on-surface-variant">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-vibrant" /> Doctor's details and signature
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-vibrant" /> Patient details and date
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-vibrant" /> Clear and legible
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
