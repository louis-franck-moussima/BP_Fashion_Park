import type { CustomerRequest } from './customer-request.model';

async function imageData(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const blob = await fetch(url).then((response) => {
      if (!response.ok) throw new Error('Image unavailable');
      return response.blob();
    });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function createRequestPdf(request: CustomerRequest): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 16;
  const pricedItems = request.items.filter(
    (item) => typeof item.unitPrice === 'number' && item.priceMode !== 'on-request',
  );
  const merchandiseTotal = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice! * item.quantity,
    0,
  );
  const currency = pricedItems[0]?.currency || 'EUR';
  const money = (value: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  const totalIsEstimate = request.items.some(
    (item) => item.priceMode === 'from' || item.priceMode === 'on-request' || item.negotiable,
  );
  let y = 18;

  document.setFillColor(33, 29, 26);
  document.rect(0, 0, pageWidth, 30, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(17);
  document.text('BP FASHION PARK', margin, 14);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Availability request · ${request.reference}`, margin, 22);

  y = 40;
  document.setTextColor(33, 29, 26);
  document.setFontSize(10);
  document.text(`Customer: ${request.name}`, margin, y);
  document.text(`Phone: ${request.phone}`, margin, y + 6);
  document.text(`City: ${request.city}`, margin, y + 12);
  y += 23;
  document.setDrawColor(215, 206, 197);
  document.line(margin, y, pageWidth - margin, y);
  y += 9;

  for (const item of request.items) {
    if (y > 250) {
      document.addPage();
      y = 18;
    }
    const image = await imageData(item.imageUrl);
    if (image) document.addImage(image, margin, y, 36, 36, undefined, 'FAST');
    else {
      document.setFillColor(238, 232, 225);
      document.rect(margin, y, 36, 36, 'F');
    }
    const x = margin + 44;
    document.setFont('helvetica', 'bold');
    document.setFontSize(11);
    document.text(document.splitTextToSize(item.name, 105), x, y + 6);
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text(`Color: ${item.color}`, x, y + 17);
    document.text(`Size: ${item.size || 'Not specified'}`, x, y + 23);
    document.text(`Quantity: ${item.quantity}`, x, y + 29);
    document.setFont('helvetica', 'bold');
    const linePrice = typeof item.unitPrice === 'number' && item.priceMode !== 'on-request'
      ? `${item.priceLabel} × ${item.quantity} = ${money(item.unitPrice * item.quantity)}`
      : item.priceLabel;
    document.text(linePrice, pageWidth - margin, y + 17, { align: 'right' });
    y += 45;
  }

  if (request.message) {
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text('Customer message:', margin, y + 3);
    document.text(document.splitTextToSize(request.message, pageWidth - margin * 2), margin, y + 9);
    y += 22;
  }
  if (y > 245) {
    document.addPage();
    y = 20;
  }
  y += 4;
  document.setFillColor(245, 240, 234);
  document.roundedRect(margin, y, pageWidth - margin * 2, totalIsEstimate ? 38 : 32, 2, 2, 'F');
  document.setTextColor(33, 29, 26);
  document.setFont('helvetica', 'bold');
  document.setFontSize(10);
  document.text(totalIsEstimate ? 'Estimated merchandise total' : 'Merchandise total', margin + 6, y + 9);
  document.setFontSize(14);
  document.text(pricedItems.length ? money(merchandiseTotal) : 'To be confirmed', pageWidth - margin - 6, y + 10, { align: 'right' });
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(104, 86, 75);
  if (totalIsEstimate)
    document.text('The final product price is subject to confirmation by BP Fashion Park.', margin + 6, y + 18);
  document.setFont('helvetica', 'bold');
  document.setTextColor(151, 68, 45);
  document.text('Delivery fees are separate and must be paid by the customer.', margin + 6, y + (totalIsEstimate ? 27 : 21));
  y += totalIsEstimate ? 42 : 36;
  document.setFontSize(8);
  document.setFont('helvetica', 'normal');
  document.setTextColor(110, 100, 92);
  document.text(
    'This document is an availability request, not proof of payment or a confirmed order.',
    margin,
    Math.min(y + 10, 282),
  );

  return new File([document.output('blob')], `${request.reference}.pdf`, {
    type: 'application/pdf',
  });
}
