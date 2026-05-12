"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  calculateDocument,
  formatINR,
  numberToIndianWords,
} from "@/lib/utils";
import { generateDocumentPDF } from "@/lib/pdfGenerator";

const quotationTerms = `1. This quotation is valid for a period of 30 days from the date of issue. Prices and terms are subject to change after this period.
2. Advance Payment: 40% upfront payment is required to initiate the Project.
3. Final Payment: The remaining 60% of the payment will be due upon completion and approval of the final deliverables, after which the remaining payment will be released.
4. Confidentiality: Both parties must keep project details confidential.
5. Any additional work outside the defined scope will be charged separately.
6. The project will be executed based on the agreed scope.`;

const invoiceTerms = `1. A 40% advance payment inclusive of applicable GST is required to initiate the project.
2. The remaining 60% of the total amount must be paid upon project completion or before final delivery.
3. Any additional work or changes beyond the agreed scope will be charged separately.
4. Payment due within 4-7 days from the date of invoice.

Bank Details:
Luminexa Technologies Private Limited
HDFC Bank, RR Nagara Bangalore
Bank Account Number: 50200113435220
IFSC Code: HDFC0001039

Kindly make the payment to the mentioned bank account.

Note: All payments should be made in favor of Luminexa Technologies Private Limited only.`;

const emptyItem = {
  remark: "",
  itemName: "Information Technology (IT) Design and Development",
  description: "",
  hsnCode: "998314",
  quantity: 1,
  rate: 0,
  gstPercent: 18,
  optionDiscount: "",
};

function getCounterId(type) {
  if (type === "Quotation") return "quotation";
  if (type === "Proforma Invoice") return "proforma_invoice";
  return "invoice";
}

function getPrefix(type) {
  if (type === "Quotation") return "Q26-27";
  if (type === "Proforma Invoice") return "PR26-27";
  return "INV26-27";
}

function buildDocumentNumber(type, number) {
  return `${getPrefix(type)}-${String(number).padStart(3, "0")}`;
}

async function confirmAndIncrementDocumentNumber(type, currentNumber) {
  const counterId = getCounterId(type);
  const counterRef = doc(db, "documentCounters", counterId);

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const nextNumber = snap.exists() ? Number(snap.data().nextNumber || 1) : 1;

    const expectedNumber = buildDocumentNumber(type, nextNumber);
    const finalNumber = currentNumber?.trim() || expectedNumber;

    if (finalNumber === expectedNumber) {
      transaction.set(
        counterRef,
        {
          lastNumber: finalNumber,
          nextNumber: nextNumber + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return finalNumber;
  });
}

export default function CreateDocumentPage() {
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  const [successPopup, setSuccessPopup] = useState(false);
  const [savedDocumentNumber, setSavedDocumentNumber] = useState("");

  const [form, setForm] = useState({
    documentType: "Quotation",
    quotationMode: "total",
    documentNumber: "",
    date: new Date().toISOString().slice(0, 10),
    clientId: "",
    placeOfSupply: "Karnataka",
    enableAdvanceAmount: false,
    advanceAmount: "",
    items: [{ ...emptyItem }],
    discount: "",
    discountPercent: "",
    amountInWords: "",
    notes: "",
    terms: quotationTerms,
  });

  const isQuotation = form.documentType === "Quotation";
  const isInvoice = form.documentType === "Invoice";

  const isOptionsQuotation = isQuotation && form.quotationMode === "options";

  useEffect(() => {
    async function loadData() {
      const clientQuery = query(
        collection(db, "clients"),
        orderBy("createdAt", "desc")
      );

      const clientSnap = await getDocs(clientQuery);
      setClients(clientSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const settingsSnap = await getDocs(collection(db, "settings"));

      if (!settingsSnap.empty) {
        setSettings({
          id: settingsSnap.docs[0].id,
          ...settingsSnap.docs[0].data(),
        });
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function previewNextDocumentNumber() {
      const counterId = getCounterId(form.documentType);
      const counterRef = doc(db, "documentCounters", counterId);

      const snap = await getDoc(counterRef);
      const nextNumber = snap.exists() ? Number(snap.data().nextNumber || 1) : 1;

      setForm((prev) => ({
        ...prev,
        documentNumber: buildDocumentNumber(prev.documentType, nextNumber),
      }));
    }

    previewNextDocumentNumber();
  }, [form.documentType]);

  const calculation = useMemo(() => {
    const itemsForCalculation = form.items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const optionDiscount = Number(item.optionDiscount || 0);

      return {
        ...item,
        gstPercent: isQuotation ? 0 : Number(item.gstPercent || 0),
        amount: isOptionsQuotation
          ? Math.max(quantity * rate - optionDiscount, 0)
          : quantity * rate,
      };
    });

    if (isOptionsQuotation) {
      const items = itemsForCalculation.map((item) => ({
        ...item,
        amount: Number(item.amount || 0),
      }));

      return {
        items,
        subtotal: 0,
        discount: 0,
        baseTotalAfterDiscount: 0,
        gstTotal: 0,
        grandTotal: 0,
      };
    }

    return calculateDocument(
      itemsForCalculation,
      Number(form.discount || 0),
      form.discountPercent
    );
  }, [
    form.items,
    form.discount,
    form.discountPercent,
    isQuotation,
    isOptionsQuotation,
  ]);

  const advanceAmount =
    isInvoice && form.enableAdvanceAmount ? Number(form.advanceAmount || 0) : 0;

  const balanceAmount = Math.max(calculation.grandTotal - advanceAmount, 0);

  useEffect(() => {
    if (isOptionsQuotation) {
      setForm((prev) => ({
        ...prev,
        amountInWords: "",
      }));
      return;
    }

    const words = numberToIndianWords(balanceAmount);

    setForm((prev) => ({
      ...prev,
      amountInWords: words ? `Rupees ${words} Only` : "",
    }));
  }, [balanceAmount, isOptionsQuotation]);

  const selectedClient = clients.find((client) => client.id === form.clientId);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "documentType") {
      const nextType = value;

      setForm({
        ...form,
        documentType: nextType,
        quotationMode: "total",
        documentNumber: "",
        enableAdvanceAmount: false,
        advanceAmount: "",
        discount: "",
        discountPercent: "",
        terms: nextType === "Quotation" ? quotationTerms : invoiceTerms,
      });

      return;
    }

    if (name === "quotationMode") {
      setForm({
        ...form,
        quotationMode: value,
        discount: "",
        discountPercent: "",
      });

      return;
    }

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function handleItemChange(index, field, value) {
    const updatedItems = [...form.items];

    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    setForm({
      ...form,
      items: updatedItems,
    });
  }

  function addItem() {
    setForm({
      ...form,
      items: [...form.items, { ...emptyItem }],
    });
  }

  function removeItem(index) {
    const updatedItems = form.items.filter((_, i) => i !== index);

    setForm({
      ...form,
      items: updatedItems.length ? updatedItems : [{ ...emptyItem }],
    });
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!selectedClient) {
      alert("Please select a client");
      return;
    }

    setLoading(true);

    try {
      const finalDocumentNumber = await confirmAndIncrementDocumentNumber(
        form.documentType,
        form.documentNumber
      );

      const documentData = {
        documentType: form.documentType,
        quotationMode: form.quotationMode,
        documentNumber: finalDocumentNumber,
        date: form.date,
        clientId: form.clientId,
        placeOfSupply: form.placeOfSupply || "Karnataka",
        clientSnapshot: selectedClient,

        items: calculation.items,
        subtotal: isOptionsQuotation ? 0 : calculation.subtotal,
        discount: isOptionsQuotation ? 0 : calculation.discount,
        discountPercent: isOptionsQuotation ? "" : form.discountPercent,
        baseTotalAfterDiscount: isOptionsQuotation
          ? 0
          : calculation.baseTotalAfterDiscount,
        gstTotal: isQuotation ? 0 : calculation.gstTotal,
        grandTotal: isOptionsQuotation ? 0 : calculation.grandTotal,

        enableAdvanceAmount: form.enableAdvanceAmount,
        advanceAmount,
        balanceAmount: isOptionsQuotation ? 0 : balanceAmount,
        amountInWords: isOptionsQuotation ? "" : form.amountInWords,

        notes: form.notes,
        terms: form.terms,

        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "documents"), documentData);

      await generateDocumentPDF({
        documentData,
        client: selectedClient,
        settings,
      });

      setSavedDocumentNumber(finalDocumentNumber);
      setSuccessPopup(true);

      setForm({
        documentType: "Quotation",
        quotationMode: "total",
        documentNumber: "",
        date: new Date().toISOString().slice(0, 10),
        clientId: "",
        placeOfSupply: "Karnataka",
        enableAdvanceAmount: false,
        advanceAmount: "",
        items: [{ ...emptyItem }],
        discount: "",
        discountPercent: "",
        amountInWords: "",
        notes: "",
        terms: quotationTerms,
      });
    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h1>Create Document</h1>
        <p>Create quotation, proforma invoice or invoice.</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="card">
          <h2>Document Details</h2>

          <div className="grid">
            <div className="form-group">
              <label>Document Type</label>
              <select
                name="documentType"
                value={form.documentType}
                onChange={handleChange}
              >
                <option value="Quotation">Quotation</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
                <option value="Invoice">Invoice</option>
              </select>
            </div>

            {isQuotation && (
              <div className="form-group">
                <label>Quotation Type</label>
                <select
                  name="quotationMode"
                  value={form.quotationMode}
                  onChange={handleChange}
                >
                  <option value="total">Total Amount Quotation</option>
                  <option value="options">Options Quotation</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Document Number</label>
              <input
                name="documentNumber"
                value={form.documentNumber}
                onChange={handleChange}
                placeholder={`${getPrefix(form.documentType)}-001`}
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Place of Supply</label>
              <input
                name="placeOfSupply"
                value={form.placeOfSupply}
                onChange={handleChange}
                placeholder="Karnataka"
              />
            </div>

            {isInvoice && (
              <>
                <div className="form-group">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginTop: "30px",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="enableAdvanceAmount"
                      checked={form.enableAdvanceAmount}
                      onChange={handleChange}
                      style={{
                        width: "16px",
                        height: "16px",
                      }}
                    />
                    Include Advance Amount
                  </label>
                </div>

                {form.enableAdvanceAmount && (
                  <div className="form-group">
                    <label>Advance Amount</label>
                    <input
                      type="number"
                      name="advanceAmount"
                      value={form.advanceAmount}
                      onChange={handleChange}
                      placeholder="Example: 10000"
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label>Client</label>
              <select
                name="clientId"
                value={form.clientId}
                onChange={handleChange}
                required
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName || client.contactName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex-between mb-20">
            <div>
              <h2>Items / Services</h2>
              {isOptionsQuotation && (
                <p className="option-quotation-note">
                  Options quotation shows item-wise discount and does not show
                  final totals.
                </p>
              )}
            </div>

            <button type="button" className="btn secondary" onClick={addItem}>
              Add Item
            </button>
          </div>

          {form.items.map((item, index) => {
            const quantity = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const optionDiscount = Number(item.optionDiscount || 0);
            const optionAmount = Math.max(quantity * rate - optionDiscount, 0);

            return (
              <div
                className={`item-row ${
                  isOptionsQuotation ? "option-item-row" : ""
                }`}
                key={index}
              >
                <div className="form-group">
                  <label>Remark</label>
                  <input
                    value={item.remark}
                    onChange={(e) =>
                      handleItemChange(index, "remark", e.target.value)
                    }
                    placeholder="Website - 5 Pages and Enquiry Form"
                  />
                </div>

                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    value={item.itemName}
                    onChange={(e) =>
                      handleItemChange(index, "itemName", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label>HSN Code</label>
                  <input
                    value={item.hsnCode}
                    onChange={(e) =>
                      handleItemChange(index, "hsnCode", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Qty</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Rate</label>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) =>
                      handleItemChange(index, "rate", e.target.value)
                    }
                  />
                </div>

                {isOptionsQuotation && (
                  <>
                    <div className="form-group">
                      <label>Discount</label>
                      <input
                        type="number"
                        value={item.optionDiscount || ""}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "optionDiscount",
                            e.target.value
                          )
                        }
                        placeholder="Example: 5000"
                      />
                    </div>

                    <div className="form-group">
                      <label>Final Amount</label>
                      <input value={formatINR(optionAmount)} readOnly />
                    </div>
                  </>
                )}

                {!isQuotation && (
                  <div className="form-group">
                    <label>GST %</label>
                    <input
                      type="number"
                      value={item.gstPercent}
                      onChange={(e) =>
                        handleItemChange(index, "gstPercent", e.target.value)
                      }
                    />
                  </div>
                )}

                <button
                  type="button"
                  className="btn danger"
                  onClick={() => removeItem(index)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        {!isOptionsQuotation && (
          <div className="card">
            <h2>Discount, Amount Words & Terms</h2>

            <div className="grid">
              <div className="form-group">
                <label>Discount Percentage</label>
                <input
                  type="number"
                  name="discountPercent"
                  value={form.discountPercent}
                  onChange={handleChange}
                  placeholder="Example: 10"
                />
              </div>

              <div className="form-group">
                <label>Discount Amount</label>
                <input
                  type="number"
                  name="discount"
                  value={
                    form.discountPercent
                      ? calculation.discount.toFixed(2)
                      : form.discount
                  }
                  onChange={handleChange}
                  placeholder="Example: 1000"
                  readOnly={!!form.discountPercent}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Amount In Words</label>
              <input
                name="amountInWords"
                value={form.amountInWords}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Terms & Conditions</label>
              <textarea
                name="terms"
                value={form.terms}
                onChange={handleChange}
                style={{ minHeight: "180px" }}
              />
            </div>
          </div>
        )}

        {isOptionsQuotation && (
          <div className="card">
            <h2>Terms & Conditions</h2>

            <div className="form-group">
              <label>Terms & Conditions</label>
              <textarea
                name="terms"
                value={form.terms}
                onChange={handleChange}
                style={{ minHeight: "180px" }}
              />
            </div>
          </div>
        )}

        {!isOptionsQuotation && (
          <div className="card">
            <div className="summary-box">
              <div className="summary-line">
                <span>Base Total</span>
                <strong>Rs. {formatINR(calculation.subtotal)}</strong>
              </div>

              <div className="summary-line">
                <span>
                  Discount{" "}
                  {form.discountPercent ? `(${form.discountPercent}%)` : ""}
                </span>
                <strong>Rs. {formatINR(calculation.discount)}</strong>
              </div>

              <div className="summary-line">
                <span>Base Total After Discount</span>
                <strong>
                  Rs. {formatINR(calculation.baseTotalAfterDiscount)}
                </strong>
              </div>

              {!isQuotation && (
                <div className="summary-line">
                  <span>GST</span>
                  <strong>Rs. {formatINR(calculation.gstTotal)}</strong>
                </div>
              )}

              {isQuotation && (
                <div className="summary-line">
                  <span>GST Note</span>
                  <strong style={{ fontSize: "12px", textAlign: "right" }}>
                    18% GST applicable on final base price
                  </strong>
                </div>
              )}

              <div className="summary-line total">
                <span>Grand Total</span>
                <strong>Rs. {formatINR(calculation.grandTotal)}</strong>
              </div>

              {isInvoice && form.enableAdvanceAmount && advanceAmount > 0 && (
                <>
                  <div className="summary-line">
                    <span>Advance Amount</span>
                    <strong>Rs. {formatINR(advanceAmount)}</strong>
                  </div>

                  <div className="summary-line total">
                    <span>Balance Amount</span>
                    <strong>Rs. {formatINR(balanceAmount)}</strong>
                  </div>
                </>
              )}
            </div>

            <br />

            <button className="btn" disabled={loading}>
              {loading ? "Saving & Downloading..." : "Save & Download PDF"}
            </button>
          </div>
        )}

        {isOptionsQuotation && (
          <div className="card">
            <button className="btn" disabled={loading}>
              {loading ? "Saving & Downloading..." : "Save & Download PDF"}
            </button>
          </div>
        )}
      </form>

      {successPopup && (
        <div className="modal-overlay">
          <div
            className="modal-card"
            style={{
              maxWidth: "420px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "#e8f5e9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
                fontSize: "34px",
                color: "#1b8f3a",
                fontWeight: "bold",
              }}
            >
              ✓
            </div>

            <h2 className="success-popup-title">
              Document Created Successfully
            </h2>

            <p className="success-popup-text">{savedDocumentNumber}</p>

            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button
                className="btn"
                onClick={() => {
                  setSuccessPopup(false);
                  setSavedDocumentNumber("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}