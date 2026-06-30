import sql from "@/app/api/utils/sql";
import {
  institutionError,
  requireInstitutionAccess,
} from "@/app/api/utils/institution-auth";
export async function GET(request, { params }) {
  try {
    await requireInstitutionAccess(request, params.id);
    const invoices =
      await sql`SELECT * FROM institution_invoices WHERE institution_id=${params.id} ORDER BY billing_month DESC`;
    return Response.json({ invoices });
  } catch (error) {
    return institutionError(error);
  }
}
