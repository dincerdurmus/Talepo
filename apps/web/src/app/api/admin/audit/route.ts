import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";
import { assertMfaSession } from "@/server/admin/mfa";

export async function GET(request:Request){try{const admin=await requirePlatformAdmin("audit.view");assertMfaSession(request,admin.id);const url=new URL(request.url);const page=Math.max(1,Number(url.searchParams.get("page")||1));const pageSize=25;const [items,total]=await Promise.all([prisma.adminAuditLog.findMany({orderBy:{createdAt:"desc"},skip:(page-1)*pageSize,take:pageSize,select:{id:true,action:true,reason:true,before:true,after:true,createdAt:true,actor:{select:{name:true,email:true}},targetUser:{select:{name:true,email:true,membershipNumber:true}}}}),prisma.adminAuditLog.count()]);return NextResponse.json({ok:true,items:items.map(x=>({...x,createdAt:x.createdAt.toISOString()})),pagination:{page,total,totalPages:Math.max(1,Math.ceil(total/pageSize))}});}catch(error){console.error("[admin/audit]",error);return NextResponse.json({ok:false,message:"Denetim kayıtları alınamadı."},{status:403});}}
