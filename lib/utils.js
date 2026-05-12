export function formatINR(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export function calculateDocument(items = [], discount = 0, discountPercent = "") {
  let subtotal = 0;

  const calculatedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const gstPercent = Number(item.gstPercent || 0);

    const amount = quantity * rate;
    subtotal += amount;

    return {
      ...item,
      quantity,
      rate,
      gstPercent,
      amount,
    };
  });

  const percent = Number(discountPercent || 0);
  let discountAmount = Number(discount || 0);

  if (percent > 0) {
    discountAmount = (subtotal * percent) / 100;
  }

  discountAmount = Math.min(discountAmount, subtotal);

  const baseTotalAfterDiscount = subtotal - discountAmount;

  let gstTotal = 0;

  const finalItems = calculatedItems.map((item) => {
    const itemShare = subtotal > 0 ? item.amount / subtotal : 0;
    const itemDiscount = discountAmount * itemShare;
    const taxableAmount = item.amount - itemDiscount;
    const gstAmount = (taxableAmount * item.gstPercent) / 100;

    gstTotal += gstAmount;

    return {
      ...item,
      discountAmount: itemDiscount,
      taxableAmount,
      gstAmount,
      total: taxableAmount + gstAmount,
    };
  });

  const grandTotal = baseTotalAfterDiscount + gstTotal;

  return {
    items: finalItems,
    subtotal,
    discount: discountAmount,
    baseTotalAfterDiscount,
    gstTotal,
    grandTotal,
  };
}

export function numberToIndianWords(value) {
  let number = Math.round(Number(value || 0));

  if (number === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function belowHundred(n) {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
  }

  function belowThousand(n) {
    if (n < 100) return belowHundred(n);

    return `${ones[Math.floor(n / 100)]} Hundred ${belowHundred(
      n % 100
    )}`.trim();
  }

  let words = "";

  const crore = Math.floor(number / 10000000);
  number %= 10000000;

  const lakh = Math.floor(number / 100000);
  number %= 100000;

  const thousand = Math.floor(number / 1000);
  number %= 1000;

  if (crore) words += `${belowThousand(crore)} Crore `;
  if (lakh) words += `${belowThousand(lakh)} Lakh `;
  if (thousand) words += `${belowThousand(thousand)} Thousand `;
  if (number) words += belowThousand(number);

  return words.trim();
}