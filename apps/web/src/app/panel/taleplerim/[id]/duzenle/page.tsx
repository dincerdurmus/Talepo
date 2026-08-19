import { notFound, redirect } from "next/navigation";

import {
  EditRequestForm,
  type EditRequestInitial,
} from "@/components/panel/EditRequestForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { canEditRequestStatus } from "@/server/request/update-request";

export default async function EditMyRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yeni?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const request = await prisma.request.findFirst({
    where: {
      id,
      createdById: user.id,
      deletedAt: null,
    },
    include: {
      category: { select: { slug: true, name: true } },
      fieldValues: {
        include: { field: { select: { key: true } } },
      },
    },
  });

  if (!request) notFound();

  if (!canEditRequestStatus(request.status)) {
    redirect(`/panel/taleplerim/${request.id}`);
  }

  const fieldValues: Record<string, string> = {};
  for (const value of request.fieldValues) {
    if (value.textValue) {
      fieldValues[value.field.key] = value.textValue;
    } else if (value.numberValue !== null && value.numberValue !== undefined) {
      fieldValues[value.field.key] = String(value.numberValue);
    } else if (value.booleanValue !== null) {
      fieldValues[value.field.key] = value.booleanValue ? "Evet" : "Hayır";
    }
  }

  const initial: EditRequestInitial = {
    id: request.id,
    title: request.title,
    description: request.description,
    professionalDescription: request.professionalDescription,
    city: request.city,
    budget: request.budgetMin ? String(Number(request.budgetMin)) : null,
    isUrgent: request.isUrgent,
    categorySlug: request.category.slug,
    fieldValues,
  };

  return (
    <EditRequestForm
      initial={initial}
      cloneSuccess={query.yeni === "1"}
    />
  );
}
