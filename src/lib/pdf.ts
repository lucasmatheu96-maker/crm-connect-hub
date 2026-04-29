import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/medcontrol-logo.png";
import { fmtMoney, fmtDate } from "@/lib/format";

type DocKind = "orcamento" | "pedido";

export interface PdfDocInput {
  kind: DocKind;
  numero: number | string;
  status?: string | null;
  created_at?: string | null;
  validade?: string | null;
  desconto?: number | null;
  total?: number | null;
  observacoes?: string | null;
  vendedorNome?: string | null;
  forma_pagamento?: string | null;
  prazo_entrega?: string | null;
  frete?: string | null;
  cliente: {
    nome?: string | null;
    empresa?: string | null;
    cpf_cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  } | null;
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }>;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateDocumentoPDF(input: PdfDocInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const titulo = input.kind === "orcamento" ? "ORÇAMENTO" : "PEDIDO";

  // ========== HEADER ==========
  // Faixa colorida
  doc.setFillColor(30, 64, 175); // azul corporativo
  doc.rect(0, 0, pageWidth, 90, "F");

  // Logo com fundo branco
  const logoData = await loadLogoDataUrl();
  if (logoData) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 18, 70, 55, 4, 4, "F");
    try { doc.addImage(logoData, "PNG", margin + 4, 22, 62, 47); } catch { /* ignore */ }
  }

  // Empresa
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MedControl", margin + 85, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("CNPJ: 10.203.274/0001-31", margin + 85, 58);

  // Título e número à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titulo, pageWidth - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Nº ${String(input.numero).padStart(6, "0")}`, pageWidth - margin, 60, { align: "right" });
  doc.setFontSize(9);
  if (input.created_at) {
    doc.text(`Emitido em ${fmtDate(input.created_at)}`, pageWidth - margin, 76, { align: "right" });
  }

  // Reset cor
  doc.setTextColor(20, 20, 20);

  let y = 120;

  // ========== STATUS BADGE ==========
  if (input.status) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    const statusText = `Status: ${String(input.status).replace(/_/g, " ").toUpperCase()}`;
    const textWidth = doc.getTextWidth(statusText) + 16;
    doc.roundedRect(margin, y - 12, textWidth, 18, 4, 4, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(statusText, margin + 8, y);
    doc.setTextColor(20, 20, 20);
    y += 20;
  }

  // ========== DADOS DO CLIENTE ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text("DADOS DO CLIENTE", margin, y);
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.8);
  doc.line(margin, y + 3, pageWidth - margin, y + 3);
  y += 18;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const c = input.cliente || {};
  const clienteRows: Array<[string, string]> = [];
  if (c.nome) clienteRows.push(["Nome", c.nome]);
  if (c.empresa) clienteRows.push(["Empresa", c.empresa]);
  if (c.cpf_cnpj) clienteRows.push(["CPF/CNPJ", c.cpf_cnpj]);
  if (c.email) clienteRows.push(["E-mail", c.email]);
  if (c.telefone) clienteRows.push(["Telefone", c.telefone]);
  const enderecoFmt = [c.endereco, c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado, c.cep && `CEP ${c.cep}`].filter(Boolean).join(" — ");
  if (enderecoFmt) clienteRows.push(["Endereço", enderecoFmt]);

  for (const [k, v] of clienteRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, pageWidth - margin * 2 - 70);
    doc.text(lines, margin + 70, y);
    y += 14 * (Array.isArray(lines) ? lines.length : 1);
  }

  y += 6;

  // ========== INFO OPERAÇÃO ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text("INFORMAÇÕES", margin, y);
  doc.line(margin, y + 3, pageWidth - margin, y + 3);
  y += 18;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoRows: Array<[string, string]> = [];
  if (input.vendedorNome) infoRows.push(["Vendedor", input.vendedorNome]);
  if (input.validade) infoRows.push(["Validade", fmtDate(input.validade)]);
  if (input.forma_pagamento) infoRows.push(["Forma de pagamento", input.forma_pagamento]);
  if (input.prazo_entrega) infoRows.push(["Prazo de entrega", input.prazo_entrega]);
  if (input.frete) infoRows.push(["Frete", input.frete]);

  for (const [k, v] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, pageWidth - margin * 2 - 140);
    doc.text(lines, margin + 140, y);
    y += 14 * (Array.isArray(lines) ? lines.length : 1);
  }

  y += 8;

  // ========== TABELA DE ITENS ==========
  const subtotal = input.itens.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição", "Qtd.", "Preço Unit.", "Subtotal"]],
    body: input.itens.map((i, idx) => [
      String(idx + 1),
      i.descricao || "Item",
      String(i.quantidade),
      fmtMoney(Number(i.preco_unitario || 0)),
      fmtMoney(Number(i.subtotal || 0)),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.4 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 90, halign: "right" },
      4: { cellWidth: 90, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  let endY = (doc as any).lastAutoTable?.finalY ?? y + 30;
  endY += 14;

  // ========== TOTAIS ==========
  const desconto = Number(input.desconto || 0);
  const total = Number(input.total ?? Math.max(0, subtotal - desconto));
  const totaisX = pageWidth - margin - 220;
  const valorX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totaisX, endY);
  doc.text(fmtMoney(subtotal), valorX, endY, { align: "right" });
  endY += 16;

  doc.text("Desconto:", totaisX, endY);
  doc.setTextColor(220, 38, 38);
  doc.text(`- ${fmtMoney(desconto)}`, valorX, endY, { align: "right" });
  doc.setTextColor(20, 20, 20);
  endY += 6;

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.6);
  doc.line(totaisX, endY + 4, valorX, endY + 4);
  endY += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 64, 175);
  doc.text("TOTAL:", totaisX, endY);
  doc.text(fmtMoney(total), valorX, endY, { align: "right" });
  doc.setTextColor(20, 20, 20);
  endY += 24;

  // ========== OBSERVAÇÕES ==========
  if (input.observacoes && input.observacoes.trim()) {
    if (endY > pageHeight - 120) { doc.addPage(); endY = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text("OBSERVAÇÕES", margin, endY);
    doc.line(margin, endY + 3, pageWidth - margin, endY + 3);
    endY += 16;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(input.observacoes, pageWidth - margin * 2);
    doc.text(obsLines, margin, endY);
    endY += 14 * (Array.isArray(obsLines) ? obsLines.length : 1);
  }

  // ========== FOOTER em todas as páginas ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("MedControl", margin, pageHeight - 24);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  const filename = `${titulo.toLowerCase()}-${String(input.numero).padStart(6, "0")}.pdf`;
  doc.save(filename);
}
