/**
 * Persiste propuesta v2 (ProposalService) + finalize/notificación para un lead.
 * Requiere viajes APPROVED y usuario admin de la misma empresa.
 * Uso: npx ts-node --transpile-only scripts/e2e-persist-proposal.ts <leadId>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { ProposalService } from '../src/modules/proposals/proposal.service';

async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Uso: … <leadId>');
    process.exit(1);
  }
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, companyId: true },
  });
  if (!lead) {
    console.error('Lead no encontrado');
    process.exit(1);
  }
  const user = await prisma.user.findFirst({
    where: { companyId: lead.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error('Sin COMPANY_ADMIN activo en el tenant');
    process.exit(1);
  }

  const svc = new ProposalService();
  const out = await svc.generateForLead(lead.companyId, lead.id, user.id, { useAiCopy: false });
  console.log('Proposal id:', out.id);
  console.log('Latest version:', out.versions[0]?.versionNumber, 'html?', !!out.versions[0]?.generatedHtml);
  console.log('PDF path:', out.versions[0]?.pdfStoragePath);

  const acts = await prisma.leadActivity.findMany({
    where: { leadId: lead.id, companyId: lead.companyId },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { activityType: true, title: true },
  });
  console.log('Activities:', JSON.stringify(acts, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
